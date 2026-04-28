import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly ACCESS_COOKIE = 'access_token';

  private static fromCookie(req: Request) {
    const cookieHeader = req?.headers?.cookie;
    if (!cookieHeader) return null;

    const pair = cookieHeader
      .split(';')
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${JwtStrategy.ACCESS_COOKIE}=`));

    if (!pair) return null;
    const value = pair.substring(`${JwtStrategy.ACCESS_COOKIE}=`.length);
    return value ? decodeURIComponent(value) : null;
  }

  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is missing');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => JwtStrategy.fromCookie(req),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        isBannedPermanent: true,
        bannedUntil: true,
        banReason: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
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

    return payload;
  }
}
