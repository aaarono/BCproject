import { Injectable, NotFoundException } from '@nestjs/common';
import { DealStatus, ListingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminQueryDto } from './dto/list-admin-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePagination(query: ListAdminQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  async getOverview() {
    const [users, listings, activeListings, deals, activeDeals, reviews] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.listing.count(),
        this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
        this.prisma.deal.count(),
        this.prisma.deal.count({
          where: { status: { in: ['INITIATED', 'FUNDED', 'DELIVERED'] } },
        }),
        this.prisma.review.count(),
      ]);

    return {
      users,
      listings,
      activeListings,
      deals,
      activeDeals,
      reviews,
    };
  }

  async listUsers(query: ListAdminQueryDto) {
    const { page, limit, skip } = this.normalizePagination(query);
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          ratingAvg: true,
          ratingCount: true,
          createdAt: true,
          _count: {
            select: {
              listings: true,
              buyerDeals: true,
              sellerDeals: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listListings(query: ListAdminQueryDto, status?: ListingStatus) {
    const { page, limit, skip } = this.normalizePagination(query);
    const search = query.search?.trim();

    const where: Prisma.ListingWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                seller: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
              { seller: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          price: true,
          type: true,
          category: true,
          status: true,
          createdAt: true,
          seller: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listDeals(query: ListAdminQueryDto, status?: DealStatus) {
    const { page, limit, skip } = this.normalizePagination(query);

    const where: Prisma.DealWhereInput = {
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          quantity: true,
          unitPriceSnapshot: true,
          totalAmountSnapshot: true,
          createdAt: true,
          listing: { select: { id: true, title: true } },
          buyer: { select: { id: true, displayName: true, email: true } },
          seller: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listReviews(query: ListAdminQueryDto) {
    const { page, limit, skip } = this.normalizePagination(query);

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
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
          buyer: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.review.count(),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async updateUserRole(userId: string, role: Role) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
  }

  async archiveListing(listingId: string) {
    const existing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ARCHIVED' },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async restoreListing(listingId: string) {
    const existing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async deleteReview(reviewId: string) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: reviewId },
        select: { id: true, sellerId: true },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      await tx.review.delete({ where: { id: reviewId } });

      const aggregate = await tx.review.aggregate({
        where: { sellerId: review.sellerId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: review.sellerId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count.rating,
        },
      });

      return { ok: true };
    });
  }
}
