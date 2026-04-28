import {
  BadRequestException,
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
import { SystemNotificationsService } from '../system-notifications/system-notifications.service';
import { WalletService } from '../wallet/wallet.service';
import { BroadcastSystemMessageDto } from './dto/broadcast-system-message.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { ListAdminQueryDto } from './dto/list-admin-query.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly systemNotificationsService: SystemNotificationsService,
  ) {}

  private static readonly DEFAULT_WEEKLY_REWARD_AMOUNT = 5000;

  private normalizePagination(query: ListAdminQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  private getPreviousWeekRange(now = new Date()) {
    const utcToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const dayOfWeek = utcToday.getUTCDay();
    const deltaToMonday = (dayOfWeek + 6) % 7;

    const currentWeekStart = new Date(utcToday);
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - deltaToMonday);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

    return {
      weekStart: previousWeekStart,
      weekEnd: currentWeekStart,
    };
  }

  private resolveWeeklyRewardAmount() {
    const fromEnv = Number.parseInt(
      process.env.WEEKLY_TOP_SELLER_REWARD_CENTS ?? '',
      10,
    );

    if (!Number.isFinite(fromEnv) || fromEnv <= 0) {
      return AdminService.DEFAULT_WEEKLY_REWARD_AMOUNT;
    }

    return fromEnv;
  }

  private resolveWeeklyStreakAchievementCodes(streakAfterWin: number) {
    const codes = ['WEEKLY_CHAMPION'];

    if (streakAfterWin >= 2) {
      codes.push('WEEKLY_STREAK_2');
    }

    if (streakAfterWin >= 4) {
      codes.push('WEEKLY_STREAK_4');
    }

    if (streakAfterWin >= 8) {
      codes.push('WEEKLY_STREAK_8');
    }

    return codes;
  }

  private async getWeeklyRankedSellers(
    tx: Prisma.TransactionClient,
    weekStart: Date,
    weekEnd: Date,
  ) {
    const candidates = await tx.user.findMany({
      where: {
        OR: [
          {
            sellerDeals: {
              some: {
                status: 'COMPLETED',
                createdAt: {
                  gte: weekStart,
                  lt: weekEnd,
                },
              },
            },
          },
          {
            ratingCount: {
              gt: 0,
            },
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        ratingAvg: true,
        ratingCount: true,
      },
      take: 200,
    });

    const enriched = await Promise.all(
      candidates.map(async (seller) => {
        const [completedDeals, activeListings] = await Promise.all([
          tx.deal.count({
            where: {
              sellerId: seller.id,
              status: 'COMPLETED',
              createdAt: {
                gte: weekStart,
                lt: weekEnd,
              },
            },
          }),
          tx.listing.count({
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
      .filter((seller) => seller.completedDeals > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (b.completedDeals !== a.completedDeals) {
          return b.completedDeals - a.completedDeals;
        }

        if (b.ratingCount !== a.ratingCount) {
          return b.ratingCount - a.ratingCount;
        }

        return a.id.localeCompare(b.id);
      });
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

    const existedBefore = await this.prisma.userAchievement.findFirst({
      where: {
        userId: user.id,
        definitionId: definition.id,
      },
      select: { id: true },
    });

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

    if (!existedBefore) {
      await this.systemNotificationsService.createForUser({
        userId: user.id,
        senderAdminId: admin.id,
        title: 'New achievement unlocked',
        text: `Congratulations! You unlocked \"${definition.title}\" (${definition.code}).`,
      });
    }

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

  async finalizePreviousWeekTopSellerReward() {
    const { weekStart, weekEnd } = this.getPreviousWeekRange();
    const rewardAmount = this.resolveWeeklyRewardAmount();

    const result = await this.prisma.$transaction(async (tx) => {
      const competition = await tx.weeklyCompetition.upsert({
        where: {
          weekStart,
        },
        update: {
          weekEnd,
        },
        create: {
          weekStart,
          weekEnd,
        },
      });

      if (competition.status === 'FINALIZED') {
        const existingWinner = await tx.weeklyWinner.findUnique({
          where: {
            competitionId: competition.id,
          },
          select: {
            id: true,
            rank: true,
            score: true,
            rewardAmount: true,
            streakAfterWin: true,
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        });

        return {
          alreadyFinalized: true,
          competition,
          winner: existingWinner,
          winnerNotificationPayload: null,
        };
      }

      const ranked = await this.getWeeklyRankedSellers(tx, weekStart, weekEnd);
      const winner = ranked[0];

      if (!winner) {
        const canceledCompetition = await tx.weeklyCompetition.update({
          where: {
            id: competition.id,
          },
          data: {
            status: 'CANCELED',
            rewardAmount: 0,
            winnerUserId: null,
            finalizedAt: new Date(),
          },
        });

        return {
          alreadyFinalized: false,
          competition: canceledCompetition,
          winner: null,
          winnerNotificationPayload: null,
        };
      }

      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

      const currentStats = await tx.userWeeklyStats.findUnique({
        where: {
          userId: winner.id,
        },
        select: {
          userId: true,
          totalWins: true,
          currentStreak: true,
          bestStreak: true,
          lastWinWeekStart: true,
        },
      });

      const extendsStreak =
        currentStats?.lastWinWeekStart?.getTime() === previousWeekStart.getTime();
      const streakAfterWin = extendsStreak
        ? (currentStats?.currentStreak ?? 0) + 1
        : 1;

      await tx.userWeeklyStats.upsert({
        where: {
          userId: winner.id,
        },
        update: {
          totalWins: {
            increment: 1,
          },
          currentStreak: streakAfterWin,
          bestStreak: Math.max(currentStats?.bestStreak ?? 0, streakAfterWin),
          lastWinWeekStart: weekStart,
        },
        create: {
          userId: winner.id,
          totalWins: 1,
          currentStreak: streakAfterWin,
          bestStreak: streakAfterWin,
          lastWinWeekStart: weekStart,
        },
      });

      await tx.weeklyWinner.upsert({
        where: {
          competitionId: competition.id,
        },
        update: {
          userId: winner.id,
          rank: 1,
          score: winner.score,
          completedDeals: winner.completedDeals,
          ratingAvgSnapshot: winner.ratingAvg,
          ratingCountSnapshot: winner.ratingCount,
          activeListings: winner.activeListings,
          streakAfterWin,
          rewardAmount,
        },
        create: {
          competitionId: competition.id,
          userId: winner.id,
          rank: 1,
          score: winner.score,
          completedDeals: winner.completedDeals,
          ratingAvgSnapshot: winner.ratingAvg,
          ratingCountSnapshot: winner.ratingCount,
          activeListings: winner.activeListings,
          streakAfterWin,
          rewardAmount,
        },
      });

      await this.walletService.grantWeeklyReward(tx, winner.id, rewardAmount);

      const streakAchievementCodes = this.resolveWeeklyStreakAchievementCodes(
        streakAfterWin,
      );

      const streakDefinitions = await tx.achievementDefinition.findMany({
        where: {
          code: {
            in: streakAchievementCodes,
          },
        },
        select: {
          id: true,
          code: true,
          title: true,
        },
      });

      const existingStreakAchievements = await tx.userAchievement.findMany({
        where: {
          userId: winner.id,
          definitionId: {
            in: streakDefinitions.map((definition) => definition.id),
          },
        },
        select: {
          definitionId: true,
        },
      });

      const existingDefinitionIds = new Set(
        existingStreakAchievements.map((item) => item.definitionId),
      );

      const newStreakDefinitions = streakDefinitions.filter(
        (definition) => !existingDefinitionIds.has(definition.id),
      );

      if (newStreakDefinitions.length > 0) {
        await tx.userAchievement.createMany({
          data: newStreakDefinitions.map((definition) => ({
            userId: winner.id,
            definitionId: definition.id,
          })),
          skipDuplicates: true,
        });
      }

      const finalizedCompetition = await tx.weeklyCompetition.update({
        where: {
          id: competition.id,
        },
        data: {
          status: 'FINALIZED',
          winnerUserId: winner.id,
          rewardAmount,
          finalizedAt: new Date(),
        },
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          status: true,
          winnerUserId: true,
          rewardAmount: true,
          finalizedAt: true,
          winner: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      const winnerNotificationPayload = {
        userId: winner.id,
        rewardAmount,
        streakAfterWin,
        unlockedAchievements: newStreakDefinitions.map((definition) => ({
          code: definition.code,
          title: definition.title,
        })),
      };

      return {
        alreadyFinalized: false,
        competition: finalizedCompetition,
        winner: {
          id: winner.id,
          displayName: winner.displayName,
          score: winner.score,
          completedDeals: winner.completedDeals,
          activeListings: winner.activeListings,
          ratingAvg: winner.ratingAvg,
          ratingCount: winner.ratingCount,
          streakAfterWin,
          rewardAmount,
        },
        winnerNotificationPayload,
      };
    });

    if (result.winnerNotificationPayload) {
      await this.systemNotificationsService.createForUser({
        userId: result.winnerNotificationPayload.userId,
        title: 'Weekly Top Seller reward',
        text: `You won Weekly Top Sellers and received $${(
          result.winnerNotificationPayload.rewardAmount / 100
        ).toFixed(2)}. Current streak: ${result.winnerNotificationPayload.streakAfterWin}.`,
      });

      for (const achievement of result.winnerNotificationPayload
        .unlockedAchievements) {
        await this.systemNotificationsService.createForUser({
          userId: result.winnerNotificationPayload.userId,
          title: 'New achievement unlocked',
          text: `Congratulations! You unlocked \"${achievement.title}\" (${achievement.code}).`,
        });
      }
    }

    const { winnerNotificationPayload: _winnerNotificationPayload, ...response } =
      result;

    return response;
  }

  async broadcastSystemMessage(
    adminId: string,
    dto: BroadcastSystemMessageDto,
  ) {
    const text = dto.text?.trim();

    if (!text) {
      throw new BadRequestException('Message text is required');
    }

    return this.systemNotificationsService.broadcastFromAdmin(adminId, {
      title: dto.title,
      text,
    });
  }
}
