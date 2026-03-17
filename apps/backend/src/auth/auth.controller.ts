import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { type JwtPayload } from './jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private static readonly ACCESS_COOKIE = 'access_token';

  constructor(private readonly auth: AuthService) {}

  private getCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      path: '/',
    };
  }

  @ApiOperation({ summary: 'Register a new user' })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto);
    res.cookie(
      AuthController.ACCESS_COOKIE,
      result.accessToken,
      this.getCookieOptions(),
    );
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    res.cookie(
      AuthController.ACCESS_COOKIE,
      result.accessToken,
      this.getCookieOptions(),
    );
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Logout current user' })
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AuthController.ACCESS_COOKIE, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { ok: true };
  }

  @ApiOperation({ summary: 'Get current user from JWT' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
    };
  }

  @ApiOperation({ summary: 'Get full profile of current user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/users/me/profile')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.auth.getMyProfile(user.sub);
  }
}
