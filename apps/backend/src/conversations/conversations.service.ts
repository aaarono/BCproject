import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUnreadCountForConversation(
    conversationId: string,
    userId: string,
    lastReadAt: Date | null,
  ) {
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: {
          not: userId,
        },
        ...(lastReadAt
          ? {
              createdAt: {
                gt: lastReadAt,
              },
            }
          : {}),
      },
    });
  }

  private async markConversationAsRead(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    this.assertParticipant(conversation, userId);

    const now = new Date();

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:
        conversation.buyerId === userId
          ? { buyerLastReadAt: now }
          : { sellerLastReadAt: now },
    });
  }

  private assertParticipant(
    conv: { buyerId: string; sellerId: string },
    userId: string,
  ) {
    if (conv.buyerId !== userId && conv.sellerId !== userId) {
      throw new ForbiddenException('Not a participant of this conversation');
    }
  }

  async createOrGet(listingId: string, buyerId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'ACTIVE')
      throw new ForbiddenException('Listing is not active');
    if (listing.sellerId === buyerId)
      throw new ForbiddenException('Seller cannot chat with himself');

    // уникальность (listingId + buyerId)
    const existing = await this.prisma.conversation.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        buyerLastReadAt: new Date(),
        sellerLastReadAt: new Date(),
      },
    });
  }

  async getById(id: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        listingId: true,
        buyerId: true,
        sellerId: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            type: true,
            sellerId: true,
          },
        },
        buyer: { select: { id: true, displayName: true, avatarUrl: true } },
        seller: { select: { id: true, displayName: true, avatarUrl: true } },
        buyerLastReadAt: true,
        sellerLastReadAt: true,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    this.assertParticipant(conv, userId);

    const lastReadAt = conv.buyerId === userId ? conv.buyerLastReadAt : conv.sellerLastReadAt;
    const unreadCount = await this.getUnreadCountForConversation(
      conv.id,
      userId,
      lastReadAt,
    );

    return {
      ...conv,
      unreadCount,
    };
  }

  async getMessages(conversationId: string, userId: string) {
    await this.markConversationAsRead(conversationId, userId);

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, displayName: true } } },
      take: 50,
    });
  }

  async getByListingAndBuyer(
    listingId: string,
    buyerId: string,
    sellerId: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('Not your listing');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        listingId,
        buyerId,
        sellerId,
      },
      include: {
        listing: true,
        buyer: { select: { id: true, displayName: true, avatarUrl: true } },
        seller: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async getMyConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      select: {
        id: true,
        listingId: true,
        buyerId: true,
        sellerId: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            type: true,
          },
        },
        buyer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        buyerLastReadAt: true,
        seller: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        sellerLastReadAt: true,
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const withUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const lastReadAt =
          conversation.buyerId === userId
            ? conversation.buyerLastReadAt
            : conversation.sellerLastReadAt;

        const unreadCount = await this.getUnreadCountForConversation(
          conversation.id,
          userId,
          lastReadAt,
        );

        return {
          ...conversation,
          unreadCount,
        };
      }),
    );

    return withUnread;
  }
}
