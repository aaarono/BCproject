import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  getMyWallet(@CurrentUser() user: JwtPayload) {
    return this.wallet.getMyWallet(user.sub);
  }

  @Post('topup-mock')
  topUp(@CurrentUser() user: JwtPayload, @Body() body: { amount: number }) {
    return this.wallet.topUpMock(user.sub, body.amount);
  }
}
