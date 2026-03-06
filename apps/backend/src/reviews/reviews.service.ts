import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(buyerId: string, dto: CreateReviewDto) {
    // 1) Deal exists + completed + belongs to buyer
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      select: { id: true, buyerId: true, sellerId: true, status: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.buyerId !== buyerId) throw new ForbiddenException('Not your deal');
    if (deal.status !== 'COMPLETED') throw new ForbiddenException('Deal is not completed');

    // 2) Prevent second review (DB unique also protects)
    const exists = await this.prisma.review.findUnique({ where: { dealId: dto.dealId } });
    if (exists) throw new ForbiddenException('Review already exists for this deal');

    // 3) Create review
    const review = await this.prisma.review.create({
      data: {
        dealId: dto.dealId,
        buyerId,
        sellerId: deal.sellerId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    // 4) Update seller rating aggregates
    const seller = await this.prisma.user.findUnique({
      where: { id: deal.sellerId },
      select: { id: true, ratingAvg: true, ratingCount: true },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    const newCount = seller.ratingCount + 1;
    const newAvg = (seller.ratingAvg * seller.ratingCount + dto.rating) / newCount;

    await this.prisma.user.update({
      where: { id: seller.id },
      data: { ratingAvg: newAvg, ratingCount: newCount },
    });

    return review;
  }

  async getSellerReviews(sellerId: string) {
    return this.prisma.review.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { buyer: { select: { id: true, displayName: true } } },
      take: 50,
    });
  }

  async getByDeal(dealId: string) {
    const review = await this.prisma.review.findUnique({
      where: { dealId },
      include: {
        buyer: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }
}
