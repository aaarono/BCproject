import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(buyerId: string, dto: CreateReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dto.dealId },
        select: { id: true, buyerId: true, sellerId: true, status: true },
      });

      if (!deal) throw new NotFoundException('Deal not found');
      if (deal.buyerId !== buyerId)
        throw new ForbiddenException('Not your deal');
      if (deal.status !== 'COMPLETED')
        throw new ForbiddenException('Deal is not completed');

      const exists = await tx.review.findUnique({
        where: { dealId: dto.dealId },
      });
      if (exists)
        throw new ForbiddenException('Review already exists for this deal');

      const review = await tx.review.create({
        data: {
          dealId: dto.dealId,
          buyerId,
          sellerId: deal.sellerId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      const updatedRows = await tx.$executeRaw`
        UPDATE "User"
        SET
          "ratingCount" = "ratingCount" + 1,
          "ratingAvg" = (("ratingAvg" * "ratingCount") + ${dto.rating}) / ("ratingCount" + 1)
        WHERE "id" = ${deal.sellerId}
      `;

      if (!updatedRows) {
        throw new NotFoundException('Seller not found');
      }

      return review;
    });
  }

  async getSellerReviews(sellerId: string) {
    return this.prisma.review.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        deal: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  async getByDeal(dealId: string) {
    const review = await this.prisma.review.findUnique({
      where: { dealId },
      include: {
        buyer: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }
}
