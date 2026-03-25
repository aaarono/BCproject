import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type MessageMediaItem = {
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
};

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(params: {
    conversationId: string;
    senderId: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO';
    mediaItems?: MessageMediaItem[];
  }) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: params.conversationId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.buyerId !== params.senderId && conv.sellerId !== params.senderId) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const normalizedText = params.text?.trim() ?? '';
    const normalizedMediaUrl = params.mediaUrl?.trim() ?? '';
    const normalizedMediaItems = (params.mediaItems ?? []).map((item) => ({
      mediaUrl: item.mediaUrl.trim(),
      mediaType: item.mediaType,
    }));

    if (normalizedMediaItems.length > 8) {
      throw new BadRequestException('No more than 8 media attachments are allowed');
    }

    if (normalizedMediaItems.some((item) => !item.mediaUrl || !item.mediaType)) {
      throw new BadRequestException('Invalid media items payload');
    }

    const hasMediaItems = normalizedMediaItems.length > 0;

    if (!normalizedText && !normalizedMediaUrl && !hasMediaItems) {
      throw new ForbiddenException('Message must contain text or media');
    }

    if (normalizedMediaUrl && !params.mediaType) {
      throw new ForbiddenException('mediaType is required when mediaUrl is provided');
    }

    if (!normalizedMediaUrl && params.mediaType) {
      throw new ForbiddenException('mediaUrl is required when mediaType is provided');
    }

    if ((normalizedMediaUrl || params.mediaType) && hasMediaItems) {
      throw new BadRequestException('Use either mediaUrl/mediaType or mediaItems payload');
    }

    const resolvedMediaItems = hasMediaItems
      ? normalizedMediaItems
      : normalizedMediaUrl && params.mediaType
        ? [{ mediaUrl: normalizedMediaUrl, mediaType: params.mediaType }]
        : [];

    const firstMedia = resolvedMediaItems[0];

    return this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        senderId: params.senderId,
        text: normalizedText,
        mediaUrl: firstMedia?.mediaUrl ?? null,
        mediaType: firstMedia?.mediaType ?? null,
        mediaItems: resolvedMediaItems.length > 0 ? resolvedMediaItems : undefined,
      },
      include: { sender: { select: { id: true, displayName: true } } },
    });
  }
}
