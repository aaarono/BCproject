import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [JwtModule, ConversationsModule, MessagesModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
