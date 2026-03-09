import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { TopUpDto } from './dto/top-up.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  getMyWallet(@CurrentUser() user: JwtPayload) {
    return this.wallet.getMyWallet(user.sub);
  }

  @Post('topup-mock')
  topUp(@CurrentUser() user: JwtPayload, @Body() dto : TopUpDto) {
    return this.wallet.topUpMock(user.sub, dto.amount);
  }
}
