import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';

const MESSAGE_MEDIA_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MESSAGE_MEDIA_MAX_FILES = 8;
const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @ApiOperation({ summary: 'Send a message in a conversation' })
  @Post()
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    return this.service.send({
      conversationId: dto.conversationId,
      senderId: user.sub,
      text: dto.text,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      mediaItems: dto.mediaItems,
    });
  }

  @ApiOperation({ summary: 'Upload chat media (image/video)' })
  @Post('upload-media')
  @UseInterceptors(
    FilesInterceptor('files', MESSAGE_MEDIA_MAX_FILES, {
      storage: diskStorage({
        destination: 'uploads/messages',
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          const normalizedExtension = extension.length > 0 ? extension : '.bin';
          cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${normalizedExtension}`,
          );
        },
      }),
      limits: { fileSize: MESSAGE_MEDIA_MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Unsupported media file type'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadMedia(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() req: Request,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one media file is required');
    }

    const protocol =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const host = req.get('host');

    if (!host) {
      throw new BadRequestException('Host header is required');
    }

    return {
      mediaItems: files.map((file) => ({
        mediaUrl: `${protocol}://${host}/uploads/messages/${file.filename}`,
        mediaType: file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE',
      })),
    };
  }
}
