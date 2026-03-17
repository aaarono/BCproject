import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../jwt.strategy';

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user as JwtPayload;
  },
);
