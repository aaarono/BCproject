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
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly achievementThresholds = {
    trustedSellerMinDeals: 5,
    trustedSellerMinRatingAvg: 4.5,
    trustedSellerMinRatingCount: 3,
    topRatedMinRatingAvg: 4.8,
    topRatedMinRatingCount: 10,
    catalogBuilderMinActiveListings: 10,
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
      },
    });

    if (definitions.length === 0) {
      return;
    }

    await this.prisma.userAchievement.createMany({
      data: definitions.map((definition) => ({
        userId,
        definitionId: definition.id,
      })),
      skipDuplicates: true,
    });
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
        avatarUrl: true,
        ratingAvg: true,
        ratingCount: true,
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

    return enriched
      .filter((seller) => seller.ratingCount > 0 || seller.completedDeals > 0)
      .sort((a, b) => b.score - a.score)
      .map((seller) => ({
        ...seller,
        achievements: achievementsBySellerId.get(seller.id) ?? [],
      }))
      .slice(0, limit);
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
        role: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const achievements = await this.getAchievementsForUser(userId);

    return {
      ...user,
      achievements,
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

    const achievements = await this.getAchievementsForUser(userId);

    return {
      ...user,
      achievements,
    };
  }
}
