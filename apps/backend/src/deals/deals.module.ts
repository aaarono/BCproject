import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { ChatModule } from 'src/chat/chat.module';
import { PrismaModule } from 'prisma/prisma.module';
import { DealTimeoutService } from './deal-timeout.service';

@Module({
  imports: [PrismaModule, WalletModule, ChatModule],
  controllers: [DealsController],
  providers: [DealsService, DealTimeoutService],
})
export class DealsModule {}
