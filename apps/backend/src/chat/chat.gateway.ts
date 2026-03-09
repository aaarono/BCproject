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

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private static onlineUsers = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const authToken = client.handshake.auth?.token;
      const headerValue = client.handshake.headers.authorization;
      const bearerToken =
        typeof headerValue === 'string' ? this.extractBearer(headerValue) : null;

      const token = authToken || bearerToken;

      if (!token) throw new WsException('Unauthorized');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

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
    @MessageBody() body: { conversationId: string; text: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('Unauthorized');

    const text = body.text?.trim();
    if (!text) throw new WsException('Text is required');

    const message = await this.messagesService.send(body.conversationId, userId, text);

    this.server.to(this.room(body.conversationId)).emit('message:new', message);

    const conversation = await this.conversationsService.getById(
      body.conversationId,
      userId,
    );

    const inboxConversation = {
      ...conversation,
      messages: [message],
    };

    this.server.to(this.userRoom(conversation.buyerId)).emit('inbox:update', {
      conversation: inboxConversation,
    });

    this.server.to(this.userRoom(conversation.sellerId)).emit('inbox:update', {
      conversation: inboxConversation,
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
}