import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { ChatModule } from 'src/chat/chat.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule, WalletModule, ChatModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
