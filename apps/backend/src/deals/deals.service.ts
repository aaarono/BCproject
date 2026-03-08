import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async create(listingId: string, buyerId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'ACTIVE')
      throw new ForbiddenException('Listing is not active');
    if (listing.sellerId === buyerId)
      throw new ForbiddenException('Cannot buy your own listing');

    const existing = await this.prisma.deal.findFirst({
      where: {
        listingId,
        buyerId,
        status: { in: ['INITIATED', 'FUNDED', 'DELIVERED'] },
      },
    });
    if (existing) return existing;

    return this.prisma.deal.create({
      data: {
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        status: 'INITIATED',
      },
    });
  }

  async fund(dealId: string, buyerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { listing: { select: { price: true } } },
      });
      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'INITIATED')
        throw new ForbiddenException('Invalid status');

      // 1) lock escrow (списать buyer + ledger)
      await this.wallet.lockEscrow(deal.buyerId, deal.id, deal.listing.price);

      // 2) статус сделки
      return tx.deal.update({
        where: { id: dealId },
        data: { status: 'FUNDED' },
      });
    });
  }

  async markDelivered(dealId: string, sellerId: string) {
    const deal = await this.getDeal(dealId);
    if (deal.sellerId !== sellerId)
      throw new ForbiddenException('Not your deal');
    if (deal.status !== 'FUNDED')
      throw new ForbiddenException('Invalid status');

    return this.prisma.deal.update({
      where: { id: dealId },
      data: { status: 'DELIVERED' },
    });
  }

  async complete(dealId: string, buyerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { listing: { select: { price: true } } },
      });
      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'DELIVERED')
        throw new ForbiddenException('Invalid status');

      // 1) release escrow seller'у
      await this.wallet.releaseEscrowToSeller(
        deal.sellerId,
        deal.id,
        deal.listing.price,
      );

      // 2) статус сделки
      return tx.deal.update({
        where: { id: dealId },
        data: { status: 'COMPLETED' },
      });
    });
  }

  async cancel(dealId: string, userId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        listing: { select: { price: true } },
      },
    });

    if (!deal) throw new NotFoundException('Deal not found');

    // по твоей логике отменять может только seller
    if (deal.sellerId !== userId) {
      throw new ForbiddenException('Only seller can cancel this deal');
    }

    // разрешаем отмену только до завершения сделки
    if (!['INITIATED', 'FUNDED'].includes(deal.status)) {
      throw new ForbiddenException('Cannot cancel now');
    }

    // если buyer уже оплатил — возвращаем деньги
    if (deal.status === 'FUNDED') {
      await this.wallet.refundToBuyer(
        deal.buyerId,
        deal.id,
        deal.listing.price,
      );
    }

    return this.prisma.deal.update({
      where: { id: dealId },
      data: { status: 'CANCELED' },
    });
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
