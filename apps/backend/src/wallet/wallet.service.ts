import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  async getMyWallet(userId: string) {
    return this.getOrCreateWallet(userId);
  }

  async topUpMock(userId: string, amount: number) {
    if (amount <= 0) throw new ForbiddenException('Invalid amount');

    const wallet = await this.getOrCreateWallet(userId);

    await this.prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: userId,
        type: 'TOPUP',
        amount,
      },
    });

    return this.getMyWallet(userId);
  }

  async lockEscrow(buyerId: string, dealId: string, amount: number) {
    const wallet = await this.getOrCreateWallet(buyerId);
    if (wallet.balance < amount) {
      throw new ForbiddenException('Insufficient balance');
    }

    await this.prisma.wallet.update({
      where: { userId: buyerId },
      data: { balance: { decrement: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: buyerId,
        type: 'ESCROW_LOCK',
        amount: -amount,
        dealId,
      },
    });
  }

  async releaseEscrowToSeller(sellerId: string, dealId: string, amount: number) {
    await this.getOrCreateWallet(sellerId);

    await this.prisma.wallet.update({
      where: { userId: sellerId },
      data: { balance: { increment: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: sellerId,
        type: 'ESCROW_RELEASE',
        amount,
        dealId,
      },
    });
  }

  async refundToBuyer(buyerId: string, dealId: string, amount: number) {
    await this.getOrCreateWallet(buyerId);

    await this.prisma.wallet.update({
      where: { userId: buyerId },
      data: { balance: { increment: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: buyerId,
        type: 'REFUND',
        amount,
        dealId,
      },
    });
  }
}
