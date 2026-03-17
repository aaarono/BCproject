import { Prisma } from '@prisma/client';
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

    await this.getOrCreateWallet(userId);

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

  async lockEscrow(
    tx: Prisma.TransactionClient,
    buyerId: string,
    dealId: string,
    amount: number,
  ) {
    const wallet = await this.getOrCreateWalletTx(tx, buyerId);

    if (wallet.balance < amount) {
      throw new ForbiddenException('Insufficient balance');
    }

    await tx.wallet.update({
      where: { userId: buyerId },
      data: { balance: { decrement: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: buyerId,
        type: 'ESCROW_LOCK',
        amount: -amount,
        dealId,
      },
    });
  }

  async releaseEscrowToSeller(
    tx: Prisma.TransactionClient,
    sellerId: string,
    dealId: string,
    amount: number,
  ) {
    await this.getOrCreateWalletTx(tx, sellerId);

    await tx.wallet.update({
      where: { userId: sellerId },
      data: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: sellerId,
        type: 'ESCROW_RELEASE',
        amount,
        dealId,
      },
    });
  }

  async refundToBuyer(
    tx: Prisma.TransactionClient,
    buyerId: string,
    dealId: string,
    amount: number,
  ) {
    await this.getOrCreateWalletTx(tx, buyerId);

    await tx.wallet.update({
      where: { userId: buyerId },
      data: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: buyerId,
        type: 'REFUND',
        amount,
        dealId,
      },
    });
  }

  private async getOrCreateWalletTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    return tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }
}
