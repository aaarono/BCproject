import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
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

      await tx.conversation.update({
        where: { id: conversationId },
        data:
          conversation.buyerId === userId
            ? { buyerLastReadAt: now }
            : { sellerLastReadAt: now },
      });
    });
  }

  private async getUnreadCountsForConversations(
    conversationIds: string[],
    userId: string,
  ) {
    if (conversationIds.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ conversationId: string; unreadCount: number }>
    >(Prisma.sql`
      SELECT
        m."conversationId" as "conversationId",
        COUNT(*)::int as "unreadCount"
      FROM "Message" m
      INNER JOIN "Conversation" c ON c."id" = m."conversationId"
      WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
        AND m."senderId" <> ${userId}
        AND m."createdAt" > CASE
          WHEN c."buyerId" = ${userId}
            THEN COALESCE(c."buyerLastReadAt", to_timestamp(0))
          ELSE COALESCE(c."sellerLastReadAt", to_timestamp(0))
        END
      GROUP BY m."conversationId"
    `);

    return new Map(
      rows.map((row) => [row.conversationId, Number(row.unreadCount)]),
    );
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
            salePercent: true,
            saleStartsAt: true,
            saleEndsAt: true,
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

    const lastReadAt =
      conv.buyerId === userId ? conv.buyerLastReadAt : conv.sellerLastReadAt;
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

    const latestMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, displayName: true } } },
      take: 50,
    });

    return latestMessages.reverse();
  }

  async getOlderMessages(params: {
    conversationId: string;
    userId: string;
    beforeCreatedAt: string;
    beforeId: string;
    limit?: number;
  }) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: params.conversationId },
      select: { id: true, buyerId: true, sellerId: true },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    this.assertParticipant(conv, params.userId);

    const cursorDate = new Date(params.beforeCreatedAt);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        OR: [
          { createdAt: { lt: cursorDate } },
          {
            createdAt: cursorDate,
            id: { lt: params.beforeId },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { sender: { select: { id: true, displayName: true } } },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = [...pageRows].reverse();
    const oldest = items[0];

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && oldest
          ? {
              beforeCreatedAt: oldest.createdAt.toISOString(),
              beforeId: oldest.id,
            }
          : null,
    };
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
            salePercent: true,
            saleStartsAt: true,
            saleEndsAt: true,
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

    const unreadCounts = await this.getUnreadCountsForConversations(
      conversations.map((conversation) => conversation.id),
      userId,
    );

    const withUnread = conversations.map((conversation) => ({
      ...conversation,
      unreadCount: unreadCounts.get(conversation.id) ?? 0,
    }));

    const [latestSystemNotification, unreadSystemCount] = await Promise.all([
      this.prisma.systemNotification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          text: true,
          createdAt: true,
        },
      }),
      this.prisma.systemNotification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

    const systemConversation = {
      id: 'system',
      listingId: 'system',
      buyerId: userId,
      sellerId: 'system',
      createdAt: latestSystemNotification?.createdAt ?? new Date(0),
      isSystem: true,
      systemTitle: 'TradeGame',
      listing: {
        id: 'system',
        title: 'TradeGame notifications',
        price: 0,
        type: 'SERVICE',
      },
      buyer: {
        id: userId,
        displayName: 'You',
        avatarUrl: null,
      },
      seller: {
        id: 'system',
        displayName: 'TradeGame',
        avatarUrl: null,
      },
      unreadCount: unreadSystemCount,
      messages: latestSystemNotification
        ? [
            {
              id: latestSystemNotification.id,
              conversationId: 'system',
              text: latestSystemNotification.text,
              createdAt: latestSystemNotification.createdAt,
              sender: {
                id: 'system',
                displayName: 'TradeGame',
              },
              title: latestSystemNotification.title,
            },
          ]
        : [],
    };

    return [systemConversation, ...withUnread];
  }
}
