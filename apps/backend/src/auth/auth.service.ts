import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  private static readonly EMAIL_VERIFICATION_HOURS = 24;
  private static readonly PASSWORD_RESET_HOURS = 2;

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private createRawToken() {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeToken(token: string) {
    return token.trim();
  }

  private addHours(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private getAppBaseUrl() {
    return process.env.APP_BASE_URL ?? 'http://localhost:5173';
  }

  private async sendVerificationEmail(email: string, token: string) {
    const verifyUrl = `${this.getAppBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mail.sendEmail({
      to: email,
      subject: 'TradeGame: confirm your email',
      text: `Welcome to TradeGame! Confirm your email by opening this link: ${verifyUrl}`,
      html: `<p>Welcome to TradeGame!</p><p>Confirm your email: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  }

  private async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${this.getAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mail.sendEmail({
      to: email,
      subject: 'TradeGame: reset password',
      text: `Reset your password using this link: ${resetUrl}`,
      html: `<p>Password reset requested for your TradeGame account.</p><p>Reset link: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) throw new BadRequestException('Email is already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = this.createRawToken();
    const verificationTokenHash = this.hashToken(verificationToken);
    const verificationExpiresAt = this.addHours(
      AuthService.EMAIL_VERIFICATION_HOURS,
    );

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName,
        role: Role.BUYER,
        emailVerificationTokenHash: verificationTokenHash,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });

    await this.sendVerificationEmail(user.email, verificationToken);

    return {
      user,
      emailVerificationRequired: true,
      message: 'Registration successful. Please verify your email.',
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Please verify your email before signing in',
      );
    }

    if (user.isBannedPermanent) {
      throw new UnauthorizedException(
        user.banReason
          ? `Account is banned: ${user.banReason}`
          : 'Account is banned',
      );
    }

    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      const untilText = user.bannedUntil.toLocaleString();
      throw new UnauthorizedException(
        user.banReason
          ? `Account is temporarily banned until ${untilText}: ${user.banReason}`
          : `Account is temporarily banned until ${untilText}`,
      );
    }

    const accessToken = await this.signAccessToken(
      user.id,
      user.email,
      user.role,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
    };
  }

  async verifyEmail(token: string) {
    const normalizedToken = this.normalizeToken(token);
    const tokenHash = this.hashToken(normalizedToken);
    const now = new Date();

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
      },
      select: {
        id: true,
        emailVerificationExpiresAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerificationExpiresAt < now) {
      throw new BadRequestException('Verification token has expired');
    }

    if (user.emailVerifiedAt) {
      return { ok: true, alreadyVerified: true };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: now,
      },
    });

    return { ok: true, alreadyVerified: false };
  }

  async resendVerificationEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    // Do not leak user existence through response timing/messages.
    if (!user || user.emailVerifiedAt) {
      return {
        ok: true,
        message: 'If this email exists, verification instructions were sent.',
      };
    }

    const verificationToken = this.createRawToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: this.hashToken(verificationToken),
        emailVerificationExpiresAt: this.addHours(
          AuthService.EMAIL_VERIFICATION_HOURS,
        ),
      },
    });

    await this.sendVerificationEmail(user.email, verificationToken);

    return {
      ok: true,
      message: 'If this email exists, verification instructions were sent.',
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return {
        ok: true,
        message: 'If this email exists, a password reset link was sent.',
      };
    }

    const resetToken = this.createRawToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: this.hashToken(resetToken),
        passwordResetExpiresAt: this.addHours(AuthService.PASSWORD_RESET_HOURS),
      },
    });

    await this.sendPasswordResetEmail(user.email, resetToken);

    return {
      ok: true,
      message: 'If this email exists, a password reset link was sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const normalizedToken = this.normalizeToken(token);
    const tokenHash = this.hashToken(normalizedToken);
    const now = new Date();

    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
      select: { id: true, passwordResetExpiresAt: true },
    });

    if (!user || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Invalid reset token');
    }

    if (user.passwordResetExpiresAt < now) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    return { ok: true };
  }

  private async signAccessToken(userId: string, email: string, role: string) {
    const rawExpiresIn = process.env.JWT_EXPIRES_IN;
    const expiresIn: JwtSignOptions['expiresIn'] =
      typeof rawExpiresIn === 'string' && rawExpiresIn.trim().length > 0
        ? (rawExpiresIn as StringValue)
        : '1h';
    return this.jwt.signAsync({ sub: userId, email, role }, { expiresIn });
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isBannedPermanent: true,
        bannedUntil: true,
        banReason: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
