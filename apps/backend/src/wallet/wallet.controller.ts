import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { TopUpDto } from './dto/top-up.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @ApiOperation({ summary: 'Get or create my wallet' })
  @Get('me')
  getMyWallet(@CurrentUser() user: JwtPayload) {
    return this.wallet.getMyWallet(user.sub);
  }

  @ApiOperation({ summary: 'Get my wallet transaction history' })
  @Get('me/transactions')
  getMyTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.wallet.getMyTransactions(user.sub, parsedLimit);
  }

  @ApiOperation({ summary: 'Mock top-up wallet balance' })
  @Post('topup-mock')
  topUp(@CurrentUser() user: JwtPayload, @Body() dto: TopUpDto) {
    return this.wallet.topUpMock(user.sub, dto.amount);
  }

  @ApiOperation({ summary: 'Withdraw wallet balance with platform fee' })
  @Post('withdraw')
  withdraw(@CurrentUser() user: JwtPayload, @Body() dto: WithdrawDto) {
    return this.wallet.withdraw(user.sub, dto.amount);
  }
}
