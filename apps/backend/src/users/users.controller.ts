import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname } from 'path';

const AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get my full profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProfile(user.sub);
  }

  @ApiOperation({ summary: 'Update my display name or email' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @ApiOperation({ summary: 'Upload my avatar image' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads/avatars',
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          const normalizedExtension = extension.length > 0 ? extension : '.jpg';
          cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${normalizedExtension}`,
          );
        },
      }),
      limits: { fileSize: AVATAR_MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Unsupported avatar file type'), false);
          return;
        }

        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    const protocol =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const host = req.get('host');

    if (!host) {
      throw new BadRequestException('Host header is required');
    }

    const avatarUrl = `${protocol}://${host}/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(user.sub, avatarUrl);
  }

  @ApiOperation({ summary: 'Change my password' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.sub, dto);
  }

  @ApiOperation({ summary: 'Get top sellers leaderboard' })
  @Get('top-sellers')
  getTopSellers(@Query('limit') limit?: string) {
    return this.usersService.getTopSellers(limit);
  }

  @ApiOperation({ summary: 'Get weekly top sellers leaderboard' })
  @Get('top-sellers/weekly')
  getWeeklyTopSellers(@Query('limit') limit?: string) {
    return this.usersService.getWeeklyTopSellers(limit);
  }

  @ApiOperation({ summary: 'Get public profile of a user' })
  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
