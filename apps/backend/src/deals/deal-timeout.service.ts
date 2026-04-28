import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ChatGateway } from '../chat/chat.gateway';
import { isDealTimeoutEnabled } from './deal-timeout.util';

@Injectable()
export class DealTimeoutService implements OnModuleInit, OnModuleDestroy {
  private static readonly SWEEP_INTERVAL_MS = 60_000;
  private static readonly SWEEP_BATCH_SIZE = 50;

  private readonly logger = new Logger(DealTimeoutService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    if (!isDealTimeoutEnabled()) {
      this.logger.log('Deal timeout sweeper is disabled by env');
      return;
    }

    this.timer = setInterval(() => {
      void this.sweepExpiredDeals();
    }, DealTimeoutService.SWEEP_INTERVAL_MS);

    void this.sweepExpiredDeals();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweepExpiredDeals() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      while (true) {
        const expiredDeals = await this.prisma.deal.findMany({
          where: {
            status: { in: ['INITIATED', 'FUNDED'] },
            expiresAt: { lte: new Date() },
          },
          orderBy: { expiresAt: 'asc' },
          take: DealTimeoutService.SWEEP_BATCH_SIZE,
          select: { id: true },
        });

        if (!Array.isArray(expiredDeals) || expiredDeals.length === 0) {
          return;
        }

        for (const deal of expiredDeals) {
          await this.cancelIfExpired(deal.id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to sweep expired deals', error as Error);
    } finally {
      this.isRunning = false;
    }
  }

  private async cancelIfExpired(dealId: string) {
    const now = new Date();

    const canceledDealId = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: DealStatus;
          buyerId: string;
          totalAmountSnapshot: number;
          expiresAt: Date | null;
        }>
      >(
        Prisma.sql`
          SELECT "id", "status", "buyerId", "totalAmountSnapshot", "expiresAt"
          FROM "Deal"
          WHERE "id" = ${dealId}
          FOR UPDATE
        `,
      );

      const deal = rows[0];
      if (!deal) return null;

      if (!deal.expiresAt || deal.expiresAt > now) return null;
      if (!['INITIATED', 'FUNDED'].includes(deal.status)) return null;

      if (deal.status === 'FUNDED') {
        const amount = Number(deal.totalAmountSnapshot);

        if (Number.isFinite(amount) && amount > 0) {
          await this.wallet.refundToBuyer(tx, deal.buyerId, deal.id, amount);
        }
      }

      await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: 'CANCELED',
          expiresAt: null,
          canceledByActor: 'SYSTEM',
        },
      });

      return deal.id;
    });

    if (!canceledDealId) return;

    const fullDeal = await this.prisma.deal.findUnique({
      where: { id: canceledDealId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            type: true,
            status: true,
          },
        },
        buyer: { select: { id: true, displayName: true } },
        seller: { select: { id: true, displayName: true } },
      },
    });

    if (!fullDeal) return;

    this.chatGateway.emitDealUpdate(fullDeal);
    this.logger.log(`Deal ${canceledDealId} auto-canceled due to timeout`);
  }
}
