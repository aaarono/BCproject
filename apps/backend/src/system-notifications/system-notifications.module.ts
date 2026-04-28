import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { SystemNotificationsService } from './system-notifications.service';
import { SystemNotificationsController } from './system-notifications.controller';

@Module({
  imports: [PrismaModule, ChatModule],
  providers: [SystemNotificationsService],
  controllers: [SystemNotificationsController],
  exports: [SystemNotificationsService],
})
export class SystemNotificationsModule {}
