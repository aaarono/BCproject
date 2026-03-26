import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';

type AuthedSocket = Socket & {
  user?: { sub: string; email?: string; role?: string };
};

type JwtSocketPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const wsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: wsOrigins,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private static onlineUsers = new Map<string, number>();
  private static readonly ACCESS_COOKIE = 'access_token';

  static getOnlineUserIds() {
    return Array.from(ChatGateway.onlineUsers.keys());
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  emitDealUpdate(deal: {
    id: string;
    buyerId: string;
    sellerId: string;
    status: string;
    createdAt: Date | string;
    listingId: string;
    listing: {
      id: string;
      title: string;
      price: number;
      type: string;
      status: string;
    };
    buyer: {
      id: string;
      displayName: string;
    };
    seller: {
      id: string;
      displayName: string;
    };
  }) {
    this.server.to(this.userRoom(deal.buyerId)).emit('deal:update', deal);
    this.server.to(this.userRoom(deal.sellerId)).emit('deal:update', deal);
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const authToken = this.extractAuthToken(client.handshake.auth);
      const headerValue = client.handshake.headers.authorization;
      const bearerToken =
        typeof headerValue === 'string'
          ? this.extractBearer(headerValue)
          : null;
      const cookieToken = this.extractCookieToken(
        typeof client.handshake.headers.cookie === 'string'
          ? client.handshake.headers.cookie
          : null,
      );

      const token = authToken || bearerToken || cookieToken;

      if (!token) throw new WsException('Unauthorized');

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) throw new WsException('Unauthorized');

      const payload = await this.jwtService.verifyAsync<JwtSocketPayload>(
        token,
        {
          secret: jwtSecret,
        },
      );

      if (!payload?.sub) throw new WsException('Unauthorized');

      client.user = payload;
      await client.join(this.userRoom(payload.sub));

      const current = ChatGateway.onlineUsers.get(payload.sub) ?? 0;
      ChatGateway.onlineUsers.set(payload.sub, current + 1);

      if (current === 0) {
        this.server.emit('presence:update', {
          userId: payload.sub,
          isOnline: true,
        });
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const userId = client.user?.sub;
    if (!userId) return;

    const current = ChatGateway.onlineUsers.get(userId) ?? 0;
    const next = Math.max(current - 1, 0);

    if (next === 0) {
      ChatGateway.onlineUsers.delete(userId);
      this.server.emit('presence:update', {
        userId,
        isOnline: false,
      });
    } else {
      ChatGateway.onlineUsers.set(userId, next);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('Unauthorized');

    await this.conversationsService.getById(body.conversationId, userId);
    await client.join(this.room(body.conversationId));

    return { ok: true };
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    await client.leave(this.room(body.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('presence:check')
  handlePresenceCheck(@MessageBody() body: { userId: string }) {
    return {
      userId: body.userId,
      isOnline: ChatGateway.onlineUsers.has(body.userId),
    };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      conversationId: string;
      text?: string;
      mediaUrl?: string;
      mediaType?: 'IMAGE' | 'VIDEO';
      mediaItems?: Array<{ mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO' }>;
    },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('Unauthorized');

    const text = body.text?.trim() ?? '';
    const mediaUrl = body.mediaUrl?.trim() ?? '';
    const mediaItems = body.mediaItems ?? [];

    if (!text && !mediaUrl && mediaItems.length === 0) {
      throw new WsException('Message must contain text or media');
    }

    const message = await this.messagesService.send({
      conversationId: body.conversationId,
      senderId: userId,
      text,
      mediaUrl: mediaUrl || undefined,
      mediaType: body.mediaType,
      mediaItems,
    });

    this.server.to(this.room(body.conversationId)).emit('message:new', message);

    const senderConversation = await this.conversationsService.getById(
      body.conversationId,
      userId,
    );

    const buyerConversation = await this.conversationsService.getById(
      body.conversationId,
      senderConversation.buyerId,
    );

    const sellerConversation = await this.conversationsService.getById(
      body.conversationId,
      senderConversation.sellerId,
    );

    this.server.to(this.userRoom(senderConversation.buyerId)).emit('inbox:update', {
      conversation: {
        ...buyerConversation,
        messages: [message],
      },
    });

    this.server.to(this.userRoom(senderConversation.sellerId)).emit('inbox:update', {
      conversation: {
        ...sellerConversation,
        messages: [message],
      },
    });

    return { ok: true, message };
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private room(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private extractBearer(header?: string) {
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private extractAuthToken(auth: unknown): string | null {
    if (!auth || typeof auth !== 'object') return null;
    const token = (auth as { token?: unknown }).token;
    return typeof token === 'string' && token.trim().length > 0 ? token : null;
  }

  private extractCookieToken(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;

    const pair = cookieHeader
      .split(';')
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${ChatGateway.ACCESS_COOKIE}=`));

    if (!pair) return null;

    const value = pair.substring(`${ChatGateway.ACCESS_COOKIE}=`.length);
    return value ? decodeURIComponent(value) : null;
  }
}
