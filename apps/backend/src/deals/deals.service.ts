import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { ChatGateway } from 'src/chat/chat.gateway';

@Injectable()
export class DealsService {
  private static readonly HISTORY_WINDOW_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private getHistoryWindowStart() {
    const date = new Date();
    date.setDate(date.getDate() - DealsService.HISTORY_WINDOW_DAYS);
    return date;
  }

  private isSaleTimeActive(listing: {
    salePercent: number | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
  }) {
    if (!listing.salePercent || !listing.saleStartsAt || !listing.saleEndsAt) {
      return false;
    }

    const now = new Date();
    return now >= listing.saleStartsAt && now <= listing.saleEndsAt;
  }

  private discountedPrice(price: number, salePercent: number | null) {
    if (!salePercent) return price;
    return Math.round((price * (100 - salePercent)) / 100);
  }

  private async getEffectiveUnitPriceTx(
    tx: Prisma.TransactionClient,
    listing: {
      id: string;
      price: number;
      salePercent: number | null;
      saleStartsAt: Date | null;
      saleEndsAt: Date | null;
    },
  ) {
    const history = await tx.listingPriceHistory.findMany({
      where: {
        listingId: listing.id,
        createdAt: { gte: this.getHistoryWindowStart() },
      },
      select: { price: true },
    });

    const referencePrice =
      history.length > 0
        ? Math.min(...history.map((row) => row.price))
        : listing.price;

    const discountedPrice = this.discountedPrice(
      listing.price,
      listing.salePercent,
    );
    const isOnSale =
      this.isSaleTimeActive(listing) && discountedPrice < referencePrice;

    return isOnSale ? discountedPrice : listing.price;
  }

  async create(listingId: string, buyerId: string, quantityInput?: number) {
    const quantity = quantityInput ?? 1;

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ForbiddenException('Quantity must be at least 1');
    }

    const fullDeal = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          sellerId: true,
          status: true,
          price: true,
          salePercent: true,
          saleStartsAt: true,
          saleEndsAt: true,
        },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (listing.status !== 'ACTIVE') {
        throw new ForbiddenException('Listing is not active');
      }

      if (listing.sellerId === buyerId) {
        throw new ForbiddenException('Cannot buy your own listing');
      }

      const existing = await tx.deal.findFirst({
        where: {
          listingId,
          buyerId,
          status: { in: ['INITIATED', 'FUNDED', 'DELIVERED'] },
        },
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
          buyer: {
            select: {
              id: true,
              displayName: true,
            },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      if (existing) {
        return existing;
      }

      const unitPriceSnapshot = await this.getEffectiveUnitPriceTx(tx, listing);
      const totalAmountSnapshot = unitPriceSnapshot * quantity;

      const wallet = await tx.wallet.findUnique({
        where: { userId: buyerId },
        select: { balance: true },
      });

      const balance = wallet?.balance ?? 0;

      if (balance < totalAmountSnapshot) {
        throw new ForbiddenException('Insufficient balance');
      }

      const deal = await tx.deal.create({
        data: {
          listingId,
          buyerId,
          sellerId: listing.sellerId,
          quantity,
          unitPriceSnapshot,
          totalAmountSnapshot,
          status: 'FUNDED',
        },
      });

      await this.wallet.lockEscrow(tx, buyerId, deal.id, totalAmountSnapshot);

      return tx.deal.findUniqueOrThrow({
        where: { id: deal.id },
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
          buyer: {
            select: {
              id: true,
              displayName: true,
            },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });
    });

    this.chatGateway.emitDealUpdate(fullDeal);

    return fullDeal;
  }

  async fund(dealId: string, buyerId: string) {
    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: {
          id: true,
          buyerId: true,
          status: true,
          totalAmountSnapshot: true,
        },
      });

      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'INITIATED')
        throw new ForbiddenException('Invalid status');

      const amount = Number(deal.totalAmountSnapshot);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ForbiddenException('Invalid deal amount');
      }

      await this.wallet.lockEscrow(tx, deal.buyerId, deal.id, amount);

      await tx.deal.update({
        where: { id: dealId },
        data: { status: 'FUNDED' },
      });
    });

    const fullDeal = await this.getFullDeal(dealId);
    this.chatGateway.emitDealUpdate(fullDeal);

    return fullDeal;
  }

  async markDelivered(dealId: string, sellerId: string) {
    const deal = await this.getDeal(dealId);
    if (deal.sellerId !== sellerId)
      throw new ForbiddenException('Not your deal');
    if (deal.status !== 'FUNDED')
      throw new ForbiddenException('Invalid status');

    await this.prisma.deal.update({
      where: { id: dealId },
      data: { status: 'DELIVERED' },
    });

    const fullDeal = await this.getFullDeal(dealId);
    this.chatGateway.emitDealUpdate(fullDeal);

    return fullDeal;
  }

  async complete(dealId: string, buyerId: string) {
    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          status: true,
          totalAmountSnapshot: true,
        },
      });

      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'DELIVERED')
        throw new ForbiddenException('Invalid status');

      const amount = Number(deal.totalAmountSnapshot);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ForbiddenException('Invalid deal amount');
      }

      await this.wallet.releaseEscrowToSeller(
        tx,
        deal.sellerId,
        deal.id,
        amount,
      );

      await tx.deal.update({
        where: { id: dealId },
        data: { status: 'COMPLETED' },
      });
    });

    const fullDeal = await this.getFullDeal(dealId);
    this.chatGateway.emitDealUpdate(fullDeal);

    return fullDeal;
  }

  async cancel(dealId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: {
          id: true,
          sellerId: true,
          buyerId: true,
          status: true,
          totalAmountSnapshot: true,
        },
      });

      if (!deal) throw new NotFoundException('Deal not found');

      if (deal.sellerId !== userId) {
        throw new ForbiddenException('Only seller can cancel this deal');
      }

      if (!['INITIATED', 'FUNDED'].includes(deal.status)) {
        throw new ForbiddenException('Cannot cancel now');
      }

      if (deal.status === 'FUNDED') {
        const amount = Number(deal.totalAmountSnapshot);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new ForbiddenException('Invalid deal amount');
        }

        await this.wallet.refundToBuyer(tx, deal.buyerId, deal.id, amount);
      }

      await tx.deal.update({
        where: { id: dealId },
        data: { status: 'CANCELED' },
      });
    });

    const fullDeal = await this.getFullDeal(dealId);
    this.chatGateway.emitDealUpdate(fullDeal);

    return fullDeal;
  }

  async getMyDeals(userId: string) {
    return this.prisma.deal.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, price: true, type: true } },
        buyer: { select: { id: true, displayName: true } },
        seller: { select: { id: true, displayName: true } },
      },
    });
  }

  async getById(id: string, userId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
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

    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new ForbiddenException('Not your deal');
    }

    return deal;
  }

  private async getDeal(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true,
            price: true,
            sellerId: true,
            status: true,
            title: true,
          },
        },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private async getFullDeal(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
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
        buyer: {
          select: {
            id: true,
            displayName: true,
          },
        },
        seller: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    return deal;
  }

  async getActiveByListingAndBuyer(
    listingId: string,
    buyerId: string,
    userId: string,
  ) {
    const deal = await this.prisma.deal.findFirst({
      where: {
        listingId,
        buyerId,
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: {
          in: ['INITIATED', 'FUNDED', 'DELIVERED'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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

    if (!deal) {
      throw new NotFoundException('Active deal not found');
    }

    return deal;
  }
}
