import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };
  let mail: { sendEmail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('mock-token') };
    mail = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    const dto = {
      email: 'test@test.com',
      password: '123456',
      displayName: 'Test',
    };

    it('should register a new user and require email verification', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = {
        id: '1',
        email: dto.email,
        displayName: 'Test',
        role: 'BUYER',
        createdAt: new Date(),
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.register(dto);

      expect(result.user).toEqual(created);
      expect(result.emailVerificationRequired).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: dto.email, role: 'BUYER' }),
        }),
      );
      expect(mail.sendEmail).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const dbUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hashed',
      displayName: 'Test',
      role: 'BUYER',
      createdAt: new Date(),
      emailVerifiedAt: new Date(),
    };

    it('should return user and token on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@test.com', '123456');

      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe('test@test.com');
    });

    it('should throw UnauthorizedException if email not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('bad@test.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login('test@test.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...dbUser,
        emailVerifiedAt: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login('test@test.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMyProfile', () => {
    it('should return the user profile', async () => {
      const profile = {
        id: '1',
        email: 'test@test.com',
        emailVerifiedAt: new Date(),
        displayName: 'Test',
        role: 'BUYER',
        ratingAvg: 0,
        ratingCount: 0,
      };
      prisma.user.findUnique.mockResolvedValue(profile);

      const result = await service.getMyProfile('1');
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMyProfile('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
