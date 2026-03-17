import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

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
      .find((chunk) =>
        chunk.startsWith(`${JwtStrategy.ACCESS_COOKIE}=`),
      );

    if (!pair) return null;
    const value = pair.substring(`${JwtStrategy.ACCESS_COOKIE}=`.length);
    return value ? decodeURIComponent(value) : null;
  }

  constructor() {
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

  validate(payload: JwtPayload) {
    // payload станет req.user
    return payload;
  }
}
