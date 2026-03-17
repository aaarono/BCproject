import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(conversationId: string, senderId: string, text: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.buyerId !== senderId && conv.sellerId !== senderId) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    return this.prisma.message.create({
      data: { conversationId, senderId, text },
      include: { sender: { select: { id: true, displayName: true } } },
    });
  }
}
