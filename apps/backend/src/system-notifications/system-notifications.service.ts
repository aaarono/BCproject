import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class SystemNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private readonly systemConversationId = 'system';
  private readonly systemSenderId = 'system';
  private readonly systemSenderName = 'TradeGame';
  private readonly defaultTitle = 'TradeGame notifications';

  private toMessage(item: {
    id: string;
    text: string;
    createdAt: Date;
    title: string;
  }) {
    return {
      id: item.id,
      conversationId: this.systemConversationId,
      text: item.text,
      createdAt: item.createdAt,
      sender: {
        id: this.systemSenderId,
        displayName: this.systemSenderName,
      },
      title: item.title,
    };
  }

  private buildSystemConversation(params: {
    userId: string;
    createdAt: Date;
    unreadCount: number;
    latestMessage?: {
      id: string;
      text: string;
      createdAt: Date;
      title: string;
    };
  }) {
    return {
      id: this.systemConversationId,
      listingId: this.systemConversationId,
      buyerId: params.userId,
      sellerId: this.systemSenderId,
      createdAt: params.createdAt,
      isSystem: true,
      systemTitle: this.systemSenderName,
      listing: {
        id: this.systemConversationId,
        title: this.defaultTitle,
        price: 0,
        type: 'SERVICE' as const,
      },
      buyer: {
        id: params.userId,
        displayName: 'You',
        avatarUrl: null,
      },
      seller: {
        id: this.systemSenderId,
        displayName: this.systemSenderName,
        avatarUrl: null,
      },
      unreadCount: params.unreadCount,
      messages: params.latestMessage ? [this.toMessage(params.latestMessage)] : [],
    };
  }

  async getMyNotifications(userId: string, limit?: number) {
    const take = Math.min(Math.max(limit ?? 100, 1), 200);

    const rows = await this.prisma.systemNotification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take,
      select: {
        id: true,
        title: true,
        text: true,
        createdAt: true,
        readAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      text: row.text,
      createdAt: row.createdAt,
      readAt: row.readAt,
      conversationId: this.systemConversationId,
      sender: {
        id: this.systemSenderId,
        displayName: this.systemSenderName,
      },
    }));
  }

  async markAllAsRead(userId: string) {
    const now = new Date();

    const updated = await this.prisma.systemNotification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    this.chatGateway.emitSystemInboxRefresh(userId);

    return {
      updated: updated.count,
      readAt: now,
    };
  }

  async createForUser(params: {
    userId: string;
    title?: string;
    text: string;
    senderAdminId?: string;
    emitRealtime?: boolean;
  }) {
    const created = await this.prisma.systemNotification.create({
      data: {
        userId: params.userId,
        senderAdminId: params.senderAdminId,
        title: params.title?.trim() || this.defaultTitle,
        text: params.text.trim(),
      },
      select: {
        id: true,
        title: true,
        text: true,
        createdAt: true,
      },
    });

    if (params.emitRealtime !== false) {
      const unreadCount = await this.prisma.systemNotification.count({
        where: {
          userId: params.userId,
          readAt: null,
        },
      });

      this.chatGateway.emitSystemInboxUpdate(
        params.userId,
        this.buildSystemConversation({
          userId: params.userId,
          createdAt: created.createdAt,
          unreadCount,
          latestMessage: created,
        }),
      );

      this.chatGateway.emitSystemMessage(params.userId, this.toMessage(created));
    }

    return created;
  }

  async broadcastFromAdmin(adminId: string, params: { title?: string; text: string }) {
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          not: adminId,
        },
      },
      select: {
        id: true,
      },
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    const title = params.title?.trim() || this.defaultTitle;
    const text = params.text.trim();

    for (const user of users) {
      await this.createForUser({
        userId: user.id,
        senderAdminId: adminId,
        title,
        text,
        emitRealtime: true,
      });
    }

    return { sent: users.length };
  }

  async getSystemConversationForUser(userId: string) {
    const [latest, unreadCount] = await Promise.all([
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

    const createdAt = latest?.createdAt ?? new Date(0);

    return this.buildSystemConversation({
      userId,
      createdAt,
      unreadCount,
      latestMessage: latest ?? undefined,
    });
  }
}
