import { Prisma } from '@prisma/client';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private getTransactionDescription(type: string) {
    switch (type) {
      case 'TOPUP':
        return 'Wallet top-up';
      case 'ESCROW_LOCK':
        return 'Funds locked in escrow';
      case 'ESCROW_RELEASE':
        return 'Escrow released';
      case 'REFUND':
        return 'Refund received';
      default:
        return 'Wallet transaction';
    }
  }

  async getOrCreateWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  async getMyWallet(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const lockedAggregate = await this.prisma.deal.aggregate({
      where: {
        buyerId: userId,
        status: {
          in: ['FUNDED', 'DELIVERED'],
        },
      },
      _sum: {
        totalAmountSnapshot: true,
      },
    });

    return {
      ...wallet,
      lockedBalance: lockedAggregate._sum.totalAmountSnapshot ?? 0,
    };
  }

  async getMyTransactions(userId: string, limit = 20) {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;

    const [wallet, transactions] = await Promise.all([
      this.getOrCreateWallet(userId),
      this.prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: normalizedLimit,
        select: {
          id: true,
          type: true,
          amount: true,
          dealId: true,
          createdAt: true,
        },
      }),
    ]);

    let sumOfNewerTransactions = 0;

    return transactions.map((tx) => {
      const balanceAfter = wallet.balance - sumOfNewerTransactions;
      sumOfNewerTransactions += tx.amount;

      return {
        ...tx,
        description: this.getTransactionDescription(tx.type),
        balanceAfter,
      };
    });
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
        userId,
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
        userId: buyerId,
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
        userId: sellerId,
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
        userId: buyerId,
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
