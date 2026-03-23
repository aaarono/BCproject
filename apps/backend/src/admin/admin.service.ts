import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DealCancellationActor,
  DealStatus,
  ListingStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
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

  async listDeals(
    query: ListAdminQueryDto,
    status?: DealStatus,
    canceledByActor?: DealCancellationActor,
  ) {
    const { page, limit, skip } = this.normalizePagination(query);

    const where: Prisma.DealWhereInput = {
      ...(status ? { status } : {}),
      ...(canceledByActor ? { canceledByActor } : {}),
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
          canceledByActor: true,
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

  async listAchievements(query: ListAdminQueryDto) {
    const { page, limit, skip } = this.normalizePagination(query);
    const search = query.search?.trim();

    const where: Prisma.AchievementDefinitionWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.achievementDefinition.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
      }),
      this.prisma.achievementDefinition.count({ where }),
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

  async createAchievement(dto: CreateAchievementDto) {
    try {
      return await this.prisma.achievementDefinition.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          description: dto.description.trim(),
        },
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          createdAt: true,
        },
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Achievement code already exists');
      }

      throw error;
    }
  }

  async listAchievementAssignments(query: ListAdminQueryDto) {
    const { page, limit, skip } = this.normalizePagination(query);

    const [data, total] = await Promise.all([
      this.prisma.achievementAssignment.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          admin: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          definition: {
            select: {
              code: true,
              title: true,
            },
          },
        },
      }),
      this.prisma.achievementAssignment.count(),
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

  async assignAchievementToUser(
    userId: string,
    achievementCode: string,
    adminId: string,
  ) {
    const normalizedCode = achievementCode.trim().toUpperCase();

    const [user, definition, admin] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, email: true },
      }),
      this.prisma.achievementDefinition.findUnique({
        where: { code: normalizedCode },
        select: { id: true, code: true, title: true, description: true },
      }),
      this.prisma.user.findUnique({
        where: { id: adminId },
        select: { id: true, displayName: true, email: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    if (!definition) {
      throw new NotFoundException('Achievement definition not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAchievement.createMany({
        data: [
          {
            userId: user.id,
            definitionId: definition.id,
          },
        ],
        skipDuplicates: true,
      });

      await tx.achievementAssignment.create({
        data: {
          adminId: admin.id,
          userId: user.id,
          definitionId: definition.id,
        },
      });
    });

    const userAchievement = await this.prisma.userAchievement.findFirst({
      where: {
        userId: user.id,
        definitionId: definition.id,
      },
      select: {
        unlockedAt: true,
      },
    });

    return {
      admin,
      user,
      achievement: {
        code: definition.code,
        title: definition.title,
        description: definition.description,
      },
      unlockedAt: userAchievement?.unlockedAt ?? new Date(),
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
