import { Prisma } from '@prisma/client';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly WITHDRAW_FEE_PERCENT = 5;

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
      case 'WITHDRAW':
        return 'Funds withdrawn';
      case 'WEEKLY_REWARD':
        return 'Weekly top seller reward';
      default:
        return 'Wallet transaction';
    }
  }

  private calculateWithdrawFee(amount: number) {
    return Math.round((amount * WalletService.WITHDRAW_FEE_PERCENT) / 100);
  }

  private async assertPaymentCardLinked(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        paymentCardLast4: true,
      },
    });

    if (!user?.paymentCardLast4) {
      throw new ForbiddenException(
        'Link a payment card in Settings > Payment before this operation',
      );
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
    const [wallet, user] = await Promise.all([
      this.getOrCreateWallet(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          paymentCardLast4: true,
          paymentCardBrand: true,
          paymentCardLinkedAt: true,
        },
      }),
    ]);

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
      hasLinkedPaymentCard: Boolean(user?.paymentCardLast4),
      paymentCardLast4: user?.paymentCardLast4 ?? null,
      paymentCardBrand: user?.paymentCardBrand ?? null,
      paymentCardLinkedAt: user?.paymentCardLinkedAt ?? null,
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

    await this.prisma.$transaction(async (tx) => {
      await this.assertPaymentCardLinked(tx, userId);
      await this.getOrCreateWalletTx(tx, userId);

      await tx.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: userId,
          userId,
          type: 'TOPUP',
          amount,
        },
      });
    });

    return this.getMyWallet(userId);
  }

  async withdraw(userId: string, amount: number) {
    if (amount <= 0) throw new ForbiddenException('Invalid amount');

    const feeAmount = this.calculateWithdrawFee(amount);
    const payoutAmount = amount - feeAmount;

    if (payoutAmount <= 0) {
      throw new ForbiddenException('Withdraw amount is too small');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.assertPaymentCardLinked(tx, userId);
      const wallet = await this.getOrCreateWalletTx(tx, userId);

      if (wallet.balance < amount) {
        throw new ForbiddenException('Insufficient balance');
      }

      await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: userId,
          userId,
          type: 'WITHDRAW',
          amount: -amount,
        },
      });
    });

    const wallet = await this.getMyWallet(userId);

    return {
      wallet,
      grossAmount: amount,
      feeAmount,
      payoutAmount,
    };
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

  async grantWeeklyReward(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new ForbiddenException('Invalid reward amount');
    }

    await this.getOrCreateWalletTx(tx, userId);

    await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: userId,
        userId,
        type: 'WEEKLY_REWARD',
        amount,
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
