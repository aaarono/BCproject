import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemNotificationsService } from '../system-notifications/system-notifications.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateActiveBadgeDto } from './dto/update-active-badge.dto';
import { UpdateProfileBadgesDto } from './dto/update-profile-badges.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemNotificationsService: SystemNotificationsService,
  ) {}

  private readonly topSellersMaxLimit = 20;
  private readonly topSellersDefaultLimit = 10;

  private resolveWarningLimit(stage: number) {
    return stage >= 2 ? 2 : 3;
  }

  private async getActiveWarningCount(userId: string, now = new Date()) {
    return this.prisma.userWarning.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    });
  }

  private async getNextWarningExpiresAt(userId: string, now = new Date()) {
    const next = await this.prisma.userWarning.findFirst({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
      select: {
        expiresAt: true,
      },
    });

    return next?.expiresAt ?? null;
  }

  private readonly achievementThresholds = {
    trustedSellerMinDeals: 5,
    trustedSellerMinRatingAvg: 4.5,
    trustedSellerMinRatingCount: 3,
    topRatedMinRatingAvg: 4.8,
    topRatedMinRatingCount: 10,
    catalogBuilderMinActiveListings: 10,
    salesMilestone25: 25,
    salesMilestone50: 50,
    salesMilestone100: 100,
    salesMilestone250: 250,
    salesMilestone500: 500,
    salesMilestone1000: 1000,
  } as const;

  private resolveEligibleAchievements(stats: {
    completedDeals: number;
    activeListings: number;
    ratingAvg: number;
    ratingCount: number;
  }) {
    const eligible: string[] = [];

    if (stats.completedDeals >= 1) {
      eligible.push('FIRST_SALE');
    }

    if (
      stats.completedDeals >=
        this.achievementThresholds.trustedSellerMinDeals &&
      stats.ratingAvg >= this.achievementThresholds.trustedSellerMinRatingAvg &&
      stats.ratingCount >=
        this.achievementThresholds.trustedSellerMinRatingCount
    ) {
      eligible.push('TRUSTED_SELLER');
    }

    if (
      stats.ratingAvg >= this.achievementThresholds.topRatedMinRatingAvg &&
      stats.ratingCount >= this.achievementThresholds.topRatedMinRatingCount
    ) {
      eligible.push('TOP_RATED');
    }

    if (
      stats.activeListings >=
      this.achievementThresholds.catalogBuilderMinActiveListings
    ) {
      eligible.push('CATALOG_BUILDER');
    }

    if (stats.completedDeals >= this.achievementThresholds.salesMilestone25) {
      eligible.push('SALES_25');
    }

    if (stats.completedDeals >= this.achievementThresholds.salesMilestone50) {
      eligible.push('SALES_50');
    }

    if (stats.completedDeals >= this.achievementThresholds.salesMilestone100) {
      eligible.push('SALES_100');
    }

    if (stats.completedDeals >= this.achievementThresholds.salesMilestone250) {
      eligible.push('SALES_250');
    }

    if (stats.completedDeals >= this.achievementThresholds.salesMilestone500) {
      eligible.push('SALES_500');
    }

    if (stats.completedDeals >= this.achievementThresholds.salesMilestone1000) {
      eligible.push('SALES_1000');
    }

    return eligible;
  }

  private async getAchievementsByUserIds(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<
        string,
        Array<{ code: string; title: string; unlockedAt: Date }>
      >();
    }

    const rows = await this.prisma.userAchievement.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      orderBy: {
        unlockedAt: 'desc',
      },
      select: {
        userId: true,
        unlockedAt: true,
        definition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    const byUserId = new Map<
      string,
      Array<{ code: string; title: string; unlockedAt: Date }>
    >();

    for (const row of rows) {
      const current = byUserId.get(row.userId) ?? [];
      if (current.length < 3) {
        current.push({
          code: row.definition.code,
          title: row.definition.title,
          unlockedAt: row.unlockedAt,
        });
        byUserId.set(row.userId, current);
      }
    }

    return byUserId;
  }

  private async getFirstUnlockedBadgeByUserIds(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, { code: string; title: string }>();
    }

    const rows = await this.prisma.userAchievement.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      orderBy: {
        unlockedAt: 'asc',
      },
      select: {
        userId: true,
        definition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    const firstByUserId = new Map<string, { code: string; title: string }>();

    for (const row of rows) {
      if (!firstByUserId.has(row.userId)) {
        firstByUserId.set(row.userId, {
          code: row.definition.code,
          title: row.definition.title,
        });
      }
    }

    return firstByUserId;
  }

  private async syncAchievementsForUser(userId: string) {
    const [user, completedDeals, activeListings] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          ratingAvg: true,
          ratingCount: true,
        },
      }),
      this.prisma.deal.count({
        where: {
          sellerId: userId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.listing.count({
        where: {
          sellerId: userId,
          status: 'ACTIVE',
        },
      }),
    ]);

    if (!user) {
      return;
    }

    const eligibleCodes = this.resolveEligibleAchievements({
      completedDeals,
      activeListings,
      ratingAvg: user.ratingAvg,
      ratingCount: user.ratingCount,
    });

    if (eligibleCodes.length === 0) {
      return;
    }

    const definitions = await this.prisma.achievementDefinition.findMany({
      where: {
        code: {
          in: eligibleCodes,
        },
      },
      select: {
        id: true,
        code: true,
        title: true,
      },
    });

    if (definitions.length === 0) {
      return;
    }

    const existing = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        definitionId: {
          in: definitions.map((definition) => definition.id),
        },
      },
      select: {
        definitionId: true,
      },
    });

    const existingDefinitionIds = new Set(
      existing.map((item) => item.definitionId),
    );

    const missingDefinitions = definitions.filter(
      (definition) => !existingDefinitionIds.has(definition.id),
    );

    if (missingDefinitions.length === 0) {
      return;
    }

    await this.prisma.userAchievement.createMany({
      data: missingDefinitions.map((definition) => ({
        userId,
        definitionId: definition.id,
      })),
      skipDuplicates: true,
    });

    for (const definition of missingDefinitions) {
      await this.systemNotificationsService.createForUser({
        userId,
        title: 'New achievement unlocked',
        text: `Congratulations! You unlocked \"${definition.title}\" (${definition.code}).`,
      });
    }
  }

  private async getAchievementsForUser(userId: string) {
    await this.syncAchievementsForUser(userId);

    const achievements = await this.prisma.userAchievement.findMany({
      where: {
        userId,
      },
      orderBy: {
        unlockedAt: 'desc',
      },
      select: {
        unlockedAt: true,
        definition: {
          select: {
            code: true,
            title: true,
            description: true,
          },
        },
      },
    });

    return achievements.map((item) => ({
      code: item.definition.code,
      title: item.definition.title,
      description: item.definition.description,
      unlockedAt: item.unlockedAt,
    }));
  }

  private async getSelectedProfileBadgesForUser(userId: string) {
    const selected = await this.prisma.userProfileBadge.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      select: {
        sortOrder: true,
        definition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    return selected.map((item) => ({
      code: item.definition.code,
      title: item.definition.title,
      sortOrder: item.sortOrder,
    }));
  }

  private resolveProfileBadges(
    selected: Array<{ code: string; title: string; sortOrder: number }>,
    achievements: Array<{
      code: string;
      title: string;
      description: string;
      unlockedAt: Date;
    }>,
  ) {
    if (selected.length > 0) {
      return selected.map((item) => ({
        code: item.code,
        title: item.title,
      }));
    }

    const firstUnlocked = achievements
      .slice()
      .sort((a, b) => a.unlockedAt.getTime() - b.unlockedAt.getTime())[0];

    return firstUnlocked
      ? [
          {
            code: firstUnlocked.code,
            title: firstUnlocked.title,
          },
        ]
      : [];
  }

  private getLocalAvatarPathFromUrl(url: string | null | undefined) {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      const prefix = '/uploads/avatars/';

      if (!parsed.pathname.startsWith(prefix)) {
        return null;
      }

      const filename = parsed.pathname.slice(prefix.length);
      if (!filename) {
        return null;
      }

      const safeFilename = basename(filename);
      if (safeFilename !== filename) {
        return null;
      }

      return join(process.cwd(), 'uploads', 'avatars', safeFilename);
    } catch {
      return null;
    }
  }

  private async removeLocalAvatarFileIfExists(url: string | null | undefined) {
    const targetPath = this.getLocalAvatarPathFromUrl(url);
    if (!targetPath) return;

    try {
      await unlink(targetPath);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        return;
      }
    }
  }

  private extractAvatarUrl(value: unknown) {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('avatarUrl' in value)
    ) {
      return null;
    }

    const avatarUrl = (value as { avatarUrl?: unknown }).avatarUrl;
    return typeof avatarUrl === 'string' ? avatarUrl : null;
  }

  private resolveCardBrand(cardNumberDigits: string) {
    if (cardNumberDigits.startsWith('4')) {
      return 'VISA';
    }

    if (/^5[1-5]/.test(cardNumberDigits)) {
      return 'MASTERCARD';
    }

    if (/^3[47]/.test(cardNumberDigits)) {
      return 'AMEX';
    }

    return 'CARD';
  }

  async getTopSellers(limit?: string | number) {
    return this.getRankedSellers(this.normalizeTopSellersLimit(limit));
  }

  async getWeeklyTopSellers(limit?: string | number) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.getRankedSellers(this.normalizeTopSellersLimit(limit), since);
  }

  private normalizeTopSellersLimit(limit?: string | number) {
    const parsed =
      typeof limit === 'number' ? limit : Number.parseInt(limit ?? '', 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return this.topSellersDefaultLimit;
    }

    return Math.min(parsed, this.topSellersMaxLimit);
  }

  private async getRankedSellers(limit: number, since?: Date) {
    const baseQuery = {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        ratingAvg: true,
        ratingCount: true,
        profileBadges: {
          orderBy: {
            sortOrder: 'asc' as const,
          },
          select: {
            sortOrder: true,
            definition: {
              select: {
                code: true,
                title: true,
              },
            },
          },
        },
        activeBadgeDefinition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
      orderBy: [
        { ratingAvg: 'desc' as const },
        { ratingCount: 'desc' as const },
      ],
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

    const sellerIds = enriched.map((seller) => seller.id);
    const achievementsBySellerId =
      await this.getAchievementsByUserIds(sellerIds);

    const ranked = enriched
      .filter((seller) => seller.ratingCount > 0 || seller.completedDeals > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const firstUnlockedBadgeBySellerId = await this.getFirstUnlockedBadgeByUserIds(
      ranked.map((seller) => seller.id),
    );

    return ranked.map((seller) => {
        const selectedBadges = seller.profileBadges.map((badge) => ({
          code: badge.definition.code,
          title: badge.definition.title,
        }));

        const fallbackBadge = firstUnlockedBadgeBySellerId.get(seller.id);
        const profileBadges =
          selectedBadges.length > 0
            ? selectedBadges
            : fallbackBadge
              ? [fallbackBadge]
              : [];

        return {
        ...seller,
        achievements: achievementsBySellerId.get(seller.id) ?? [],
        profileBadges,
        activeBadge: seller.activeBadgeDefinition
          ? {
              code: seller.activeBadgeDefinition.code,
              title: seller.activeBadgeDefinition.title,
            }
          : (fallbackBadge ?? null),
      };
    });
  }

  async getUserAchievements(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activeBadgeDefinition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const achievements = await this.getAchievementsForUser(userId);

    return {
      userId: user.id,
      activeBadge: user.activeBadgeDefinition
        ? {
            code: user.activeBadgeDefinition.code,
            title: user.activeBadgeDefinition.title,
          }
        : null,
      achievements,
    };
  }

  async updateMyActiveBadge(userId: string, dto: UpdateActiveBadgeDto) {
    const normalizedCode = dto.code?.trim().toUpperCase();

    if (!normalizedCode) {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { activeBadgeDefinitionId: null },
        select: {
          id: true,
          activeBadgeDefinition: {
            select: {
              code: true,
              title: true,
            },
          },
        },
      });

      return {
        userId: user.id,
        activeBadge: null,
      };
    }

    await this.syncAchievementsForUser(userId);

    const unlockedAchievement = await this.prisma.userAchievement.findFirst({
      where: {
        userId,
        definition: {
          code: normalizedCode,
        },
      },
      select: {
        definitionId: true,
      },
    });

    if (!unlockedAchievement) {
      throw new BadRequestException(
        'You can set only an unlocked achievement as active badge',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeBadgeDefinitionId: unlockedAchievement.definitionId,
      },
      select: {
        id: true,
        activeBadgeDefinition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    return {
      userId: user.id,
      activeBadge: user.activeBadgeDefinition
        ? {
            code: user.activeBadgeDefinition.code,
            title: user.activeBadgeDefinition.title,
          }
        : null,
    };
  }

  async updateMyProfileBadges(userId: string, dto: UpdateProfileBadgesDto) {
    await this.syncAchievementsForUser(userId);

    const normalizedCodes = Array.from(
      new Set((dto.codes ?? []).map((code) => code.trim().toUpperCase())),
    ).filter((code) => code.length > 0);

    if (normalizedCodes.length > 3) {
      throw new BadRequestException('You can select up to 3 profile badges');
    }

    const unlocked = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        definition: {
          code: {
            in: normalizedCodes,
          },
        },
      },
      select: {
        definitionId: true,
        definition: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    if (unlocked.length !== normalizedCodes.length) {
      throw new BadRequestException(
        'All selected profile badges must be unlocked achievements',
      );
    }

    const unlockedByCode = new Map(
      unlocked.map((item) => [item.definition.code, item]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfileBadge.deleteMany({ where: { userId } });

      if (normalizedCodes.length > 0) {
        await tx.userProfileBadge.createMany({
          data: normalizedCodes.map((code, index) => ({
            userId,
            definitionId: unlockedByCode.get(code)!.definitionId,
            sortOrder: index,
          })),
        });
      }
    });

    const selected = await this.getSelectedProfileBadgesForUser(userId);
    return {
      userId,
      profileBadges: selected.map((item) => ({
        code: item.code,
        title: item.title,
      })),
    };
  }

  async getUserWeeklyStats(userId: string) {
    const [user, stats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      }),
      this.prisma.userWeeklyStats.findUnique({
        where: { userId },
        select: {
          totalWins: true,
          currentStreak: true,
          bestStreak: true,
          lastWinWeekStart: true,
          updatedAt: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user,
      stats: stats ?? {
        totalWins: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastWinWeekStart: null,
        updatedAt: null,
      },
    };
  }

  async getTopSellerWinners(limit?: string | number) {
    const normalizedLimit = this.normalizeTopSellersLimit(limit);
    const winners = await this.prisma.weeklyWinner.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: normalizedLimit,
      select: {
        id: true,
        rank: true,
        score: true,
        rewardAmount: true,
        completedDeals: true,
        ratingAvgSnapshot: true,
        ratingCountSnapshot: true,
        activeListings: true,
        streakAfterWin: true,
        createdAt: true,
        competition: {
          select: {
            weekStart: true,
            weekEnd: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return winners.map((winner) => ({
      ...winner,
      weekStart: winner.competition.weekStart,
      weekEnd: winner.competition.weekEnd,
    }));
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        activeBadgeDefinition: {
          select: {
            code: true,
            title: true,
          },
        },
        paymentCardLast4: true,
        paymentCardBrand: true,
        paymentCardLinkedAt: true,
        role: true,
        warningStage: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [achievements, selectedProfileBadges, warningCount, nextWarningExpiresAt] = await Promise.all([
      this.getAchievementsForUser(userId),
      this.getSelectedProfileBadgesForUser(userId),
      this.getActiveWarningCount(userId),
      this.getNextWarningExpiresAt(userId),
    ]);

    return {
      ...user,
      activeBadge: user.activeBadgeDefinition
        ? {
            code: user.activeBadgeDefinition.code,
            title: user.activeBadgeDefinition.title,
          }
        : null,
      profileBadges: this.resolveProfileBadges(
        selectedProfileBadges,
        achievements,
      ),
      achievements,
      warningCount,
      warningLimit: this.resolveWarningLimit(user.warningStage),
      nextWarningExpiresAt,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        email: dto.email,
        avatarUrl: dto.avatarUrl === undefined ? undefined : dto.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        paymentCardLast4: true,
        paymentCardBrand: true,
        paymentCardLinkedAt: true,
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    const previousAvatarUrl = this.extractAvatarUrl(existing);
    const nextAvatarUrl =
      dto.avatarUrl === undefined ? previousAvatarUrl : dto.avatarUrl;

    if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
      await this.removeLocalAvatarFileIfExists(previousAvatarUrl);
    }

    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        paymentCardLast4: true,
        paymentCardBrand: true,
        paymentCardLinkedAt: true,
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    const previousAvatarUrl = this.extractAvatarUrl(existing);

    if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
      await this.removeLocalAvatarFileIfExists(previousAvatarUrl);
    }

    return user;
  }

  async updatePaymentCard(userId: string, cardNumber: string) {
    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 12 || digits.length > 19) {
      throw new BadRequestException('Invalid card number');
    }

    const paymentCardLast4 = digits.slice(-4);
    const paymentCardBrand = this.resolveCardBrand(digits);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        paymentCardLast4,
        paymentCardBrand,
        paymentCardLinkedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        paymentCardLast4: true,
        paymentCardBrand: true,
        paymentCardLinkedAt: true,
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    return user;
  }

  async unlinkPaymentCard(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        paymentCardLast4: null,
        paymentCardBrand: null,
        paymentCardLinkedAt: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        paymentCardLast4: true,
        paymentCardBrand: true,
        paymentCardLinkedAt: true,
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const nextPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextPasswordHash },
    });

    return { ok: true };
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        displayName: true,
        avatarUrl: true,
        activeBadgeDefinition: {
          select: {
            code: true,
            title: true,
          },
        },
        ratingAvg: true,
        ratingCount: true,
        warningStage: true,
        listings: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            price: true,
            salePercent: true,
            saleStartsAt: true,
            saleEndsAt: true,
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
                avatarUrl: true,
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

    const [achievements, selectedProfileBadges] = await Promise.all([
      this.getAchievementsForUser(userId),
      this.getSelectedProfileBadgesForUser(userId),
    ]);

    return {
      ...user,
      activeBadge: user.activeBadgeDefinition
        ? {
            code: user.activeBadgeDefinition.code,
            title: user.activeBadgeDefinition.title,
          }
        : null,
      profileBadges: this.resolveProfileBadges(
        selectedProfileBadges,
        achievements,
      ),
      achievements,
    };
  }
}
