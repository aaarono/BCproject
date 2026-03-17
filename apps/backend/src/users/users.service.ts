import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getTopSellers(limit = 10) {
    return this.getRankedSellers(limit);
  }

  async getWeeklyTopSellers(limit = 10) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.getRankedSellers(limit, since);
  }

  private async getRankedSellers(limit: number, since?: Date) {
    const baseQuery = {
      select: {
        id: true,
        displayName: true,
        ratingAvg: true,
        ratingCount: true,
      },
      orderBy: [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }],
      take: Math.max(limit * 3, 30),
    };

    const candidates = since
      ? await this.prisma.user.findMany({
          ...baseQuery,
          where: {
            OR: [
              { ratingCount: { gt: 0 } },
              {
                sellerDeals: {
                  some: {
                    status: 'COMPLETED',
                    createdAt: { gte: since },
                  },
                },
              },
            ],
          },
        })
      : await this.prisma.user.findMany({
          ...baseQuery,
          where: {
            ratingCount: { gt: 0 },
          },
        });

    const enriched = await Promise.all(
      candidates.map(async (seller) => {
        const [completedDeals, activeListings] = await Promise.all([
          this.prisma.deal.count({
            where: {
              sellerId: seller.id,
              status: 'COMPLETED',
              ...(since ? { createdAt: { gte: since } } : {}),
            },
          }),
          this.prisma.listing.count({
            where: {
              sellerId: seller.id,
              status: 'ACTIVE',
            },
          }),
        ]);

        const trustFactor = Math.log10(seller.ratingCount + 1);
        const activityBoost = completedDeals * 0.05;
        const score = seller.ratingAvg * trustFactor + activityBoost;

        return {
          ...seller,
          completedDeals,
          activeListings,
          score: Number(score.toFixed(4)),
        };
      }),
    );

    return enriched
      .filter((seller) => seller.ratingCount > 0 || seller.completedDeals > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        email: dto.email,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    return user;
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        ratingAvg: true,
        ratingCount: true,
        listings: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
        reviewsReceived: {
          orderBy: { createdAt: 'desc' },
          include: {
            buyer: {
              select: {
                id: true,
                displayName: true,
              },
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
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
