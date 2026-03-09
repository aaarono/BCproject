import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { ChatGateway } from 'src/chat/chat.gateway';

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(listingId: string, buyerId: string) {
    const fullDeal = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true, sellerId: true, status: true, price: true },
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

      const wallet = await tx.wallet.findUnique({
        where: { userId: buyerId },
        select: { balance: true },
      });

      const balance = wallet?.balance ?? 0;

      if (balance < listing.price) {
        throw new ForbiddenException('Insufficient balance');
      }

      const deal = await tx.deal.create({
        data: {
          listingId,
          buyerId,
          sellerId: listing.sellerId,
          status: 'FUNDED',
        },
      });

      await this.wallet.lockEscrow(tx, buyerId, deal.id, listing.price);

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
        include: { listing: { select: { price: true } } },
      });

      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'INITIATED')
        throw new ForbiddenException('Invalid status');

      await this.wallet.lockEscrow(
        tx,
        deal.buyerId,
        deal.id,
        deal.listing.price,
      );

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
        include: { listing: { select: { price: true } } },
      });

      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'DELIVERED')
        throw new ForbiddenException('Invalid status');

      await this.wallet.releaseEscrowToSeller(
        tx,
        deal.sellerId,
        deal.id,
        deal.listing.price,
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
        include: {
          listing: { select: { price: true } },
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
        await this.wallet.refundToBuyer(
          tx,
          deal.buyerId,
          deal.id,
          deal.listing.price,
        );
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
