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
  ReportStatus,
  ReportTargetType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemNotificationsService } from '../system-notifications/system-notifications.service';
import { WalletService } from '../wallet/wallet.service';
import { BroadcastSystemMessageDto } from './dto/broadcast-system-message.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { ListAdminQueryDto } from './dto/list-admin-query.dto';
import { ModerateReportDto } from './dto/moderate-report.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { type AdminRoleValue } from './dto/update-user-role.dto';
import { WarnUserDto } from './dto/warn-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly systemNotificationsService: SystemNotificationsService,
  ) {}

  private static readonly DEFAULT_WEEKLY_REWARD_AMOUNT = 5000;
  private static readonly WARNING_EXPIRES_DAYS = 30;

  private resolveWarningLimit(stage: number) {
    return stage >= 2 ? 2 : 3;
  }

  private buildBanMessage(params: {
    reason: string;
    duration: string;
    until?: Date | null;
    isPermanent?: boolean;
  }) {
    if (params.isPermanent) {
      return `Your account has been permanently banned. Reason: "${params.reason}".`;
    }

    const untilText = params.until
      ? ` until ${params.until.toLocaleString()}`
      : '';

    return `Your account has been banned for ${params.duration}${untilText}. Reason: "${params.reason}".`;
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

  private normalizePagination(query: ListAdminQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  private async createAuditLog(params: {
    actorAdminId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    requestId?: string;
    summary?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorAdminId: params.actorAdminId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          requestId: params.requestId ?? null,
          summary: params.summary ?? null,
          before: params.before,
          after: params.after,
          metadata: params.metadata,
        },
      });
    } catch {
      // Audit trail should not block primary admin operation.
    }
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
    const [
      users,
      listings,
      activeListings,
      deals,
      activeDeals,
      reviews,
      reports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.deal.count(),
      this.prisma.deal.count({
        where: { status: { in: ['INITIATED', 'FUNDED', 'DELIVERED'] } },
      }),
      this.prisma.review.count(),
      this.prisma.report.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    ]);

    return {
      users,
      listings,
      activeListings,
      deals,
      activeDeals,
      reviews,
      reports,
    };
  }

  async listAuditLogs(
    query: ListAdminQueryDto,
    action?: string,
    entityType?: string,
  ) {
    const { page, limit, skip } = this.normalizePagination(query);
    const search = query.search?.trim();

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
              {
                actorAdmin: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                actorAdmin: {
                  email: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          requestId: true,
          summary: true,
          before: true,
          after: true,
          metadata: true,
          createdAt: true,
          actorAdmin: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
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

  async listReports(
    query: ListAdminQueryDto,
    status?: ReportStatus,
    targetType?: ReportTargetType,
  ) {
    const { page, limit, skip } = this.normalizePagination(query);
    const search = query.search?.trim();

    const where: Prisma.ReportWhereInput = {
      ...(status ? { status } : {}),
      ...(targetType ? { targetType } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
              { details: { contains: search, mode: 'insensitive' } },
              { targetId: { contains: search, mode: 'insensitive' } },
              {
                reporter: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                reporter: {
                  email: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          reason: true,
          details: true,
          status: true,
          adminNote: true,
          reviewedAt: true,
          createdAt: true,
          reporter: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          reviewedByAdmin: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
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

  private async getUserModerationSnapshot(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        isBannedPermanent: true,
        bannedUntil: true,
        banReason: true,
        warningStage: true,
      },
    });

    if (!user) {
      return null;
    }

    const now = new Date();
    const warningCount = await this.prisma.userWarning.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });

    const isTemporarilyBanned =
      !user.isBannedPermanent &&
      user.bannedUntil !== null &&
      user.bannedUntil.getTime() > now.getTime();

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      warningCount,
      warningLimit: this.resolveWarningLimit(user.warningStage),
      isBanned: user.isBannedPermanent || isTemporarilyBanned,
      isBannedPermanent: user.isBannedPermanent,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
    };
  }

  async getReportCase(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        adminNote: true,
        reviewedAt: true,
        createdAt: true,
        reporterId: true,
        reporter: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        reviewedByAdmin: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    let target: Prisma.InputJsonValue | null = null;
    let evidenceMessages: Prisma.InputJsonValue[] = [];
    let reportedUserId: string | null = null;

    if (report.targetType === 'MESSAGE') {
      const message = await this.prisma.message.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          text: true,
          mediaUrl: true,
          mediaType: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          conversation: {
            select: {
              id: true,
              listingId: true,
              buyerId: true,
              sellerId: true,
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

      if (message) {
        reportedUserId = message.senderId;
        target = message as unknown as Prisma.InputJsonValue;

        const contextMessages = await this.prisma.message.findMany({
          where: { conversationId: message.conversationId },
          orderBy: { createdAt: 'asc' },
          take: 50,
          select: {
            id: true,
            senderId: true,
            text: true,
            mediaUrl: true,
            mediaType: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        });

        const centerIndex = contextMessages.findIndex(
          (item) => item.id === message.id,
        );

        if (centerIndex >= 0) {
          evidenceMessages = contextMessages.slice(
            Math.max(0, centerIndex - 3),
            Math.min(contextMessages.length, centerIndex + 4),
          ) as unknown as Prisma.InputJsonValue[];
        }
      }
    } else if (report.targetType === 'DEAL') {
      const deal = await this.prisma.deal.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          quantity: true,
          totalAmountSnapshot: true,
          listingId: true,
          buyerId: true,
          sellerId: true,
          buyer: { select: { id: true, displayName: true, email: true } },
          seller: { select: { id: true, displayName: true, email: true } },
          listing: { select: { id: true, title: true } },
        },
      });

      if (deal) {
        reportedUserId =
          report.reporterId === deal.buyerId ? deal.sellerId : deal.buyerId;
        target = deal as unknown as Prisma.InputJsonValue;

        const conversation = await this.prisma.conversation.findUnique({
          where: {
            listingId_buyerId: {
              listingId: deal.listingId,
              buyerId: deal.buyerId,
            },
          },
          select: { id: true },
        });

        if (conversation) {
          evidenceMessages = (
            await this.prisma.message.findMany({
              where: { conversationId: conversation.id },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                senderId: true,
                text: true,
                mediaUrl: true,
                mediaType: true,
                createdAt: true,
                sender: { select: { id: true, displayName: true } },
              },
            })
          ).reverse() as unknown as Prisma.InputJsonValue[];
        }
      }
    } else if (report.targetType === 'LISTING') {
      const listing = await this.prisma.listing.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          price: true,
          category: true,
          createdAt: true,
          sellerId: true,
          seller: { select: { id: true, displayName: true, email: true } },
        },
      });

      if (listing) {
        reportedUserId = listing.sellerId;
        target = listing as unknown as Prisma.InputJsonValue;

        const relatedConversation = await this.prisma.conversation.findFirst({
          where: {
            listingId: listing.id,
            OR: [
              { buyerId: report.reporterId },
              { sellerId: report.reporterId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });

        if (relatedConversation) {
          evidenceMessages = (
            await this.prisma.message.findMany({
              where: { conversationId: relatedConversation.id },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                senderId: true,
                text: true,
                mediaUrl: true,
                mediaType: true,
                createdAt: true,
                sender: { select: { id: true, displayName: true } },
              },
            })
          ).reverse() as unknown as Prisma.InputJsonValue[];
        }
      }
    } else if (report.targetType === 'REVIEW') {
      const review = await this.prisma.review.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          buyerId: true,
          sellerId: true,
          dealId: true,
          buyer: { select: { id: true, displayName: true, email: true } },
          seller: { select: { id: true, displayName: true, email: true } },
          deal: {
            select: {
              id: true,
              listingId: true,
              listing: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (review) {
        reportedUserId = review.buyerId;
        target = review as unknown as Prisma.InputJsonValue;

        const conversation = await this.prisma.conversation.findUnique({
          where: {
            listingId_buyerId: {
              listingId: review.deal.listingId,
              buyerId: review.buyerId,
            },
          },
          select: { id: true },
        });

        if (conversation) {
          evidenceMessages = (
            await this.prisma.message.findMany({
              where: { conversationId: conversation.id },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                senderId: true,
                text: true,
                mediaUrl: true,
                mediaType: true,
                createdAt: true,
                sender: { select: { id: true, displayName: true } },
              },
            })
          ).reverse() as unknown as Prisma.InputJsonValue[];
        }
      }
    } else if (report.targetType === 'USER') {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          displayName: true,
          email: true,
          createdAt: true,
          ratingAvg: true,
          ratingCount: true,
          _count: {
            select: {
              listings: true,
              sellerDeals: true,
            },
          },
        },
      });

      if (targetUser) {
        reportedUserId = targetUser.id;
        target = targetUser as unknown as Prisma.InputJsonValue;
      }
    }

    const reportedUser = reportedUserId
      ? await this.getUserModerationSnapshot(reportedUserId)
      : null;

    return {
      report,
      reportedUser,
      target,
      evidenceMessages,
    };
  }

  async moderateReport(
    id: string,
    adminId: string,
    dto: ModerateReportDto,
    requestId?: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true, status: true, adminNote: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const normalizedAdminNote = dto.adminNote?.trim();
    const reviewedAt = dto.status === 'OPEN' ? null : new Date();

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        adminNote:
          normalizedAdminNote && normalizedAdminNote.length > 0
            ? normalizedAdminNote
            : null,
        reviewedByAdminId: dto.status === 'OPEN' ? null : adminId,
        reviewedAt,
      },
      select: {
        id: true,
        status: true,
        adminNote: true,
        reviewedAt: true,
      },
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'REPORT_MODERATED',
      entityType: 'REPORT',
      entityId: id,
      requestId,
      summary: `Report status changed to ${updated.status}`,
      before: {
        status: report.status,
        adminNote: report.adminNote,
      },
      after: {
        status: updated.status,
        adminNote: updated.adminNote,
      },
    });

    return updated;
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
          isBannedPermanent: true,
          bannedUntil: true,
          banReason: true,
          warningStage: true,
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

    const now = new Date();
    const warningCounts = await this.prisma.userWarning.groupBy({
      by: ['userId'],
      where: {
        userId: { in: data.map((user) => user.id) },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      _count: {
        _all: true,
      },
    });

    const warningCountByUserId = new Map(
      warningCounts.map((row) => [row.userId, row._count._all]),
    );

    const users = data.map((user) => {
      const warningCount = warningCountByUserId.get(user.id) ?? 0;
      const isTemporarilyBanned =
        !user.isBannedPermanent &&
        user.bannedUntil !== null &&
        user.bannedUntil.getTime() > now.getTime();

      return {
        ...user,
        warningCount,
        warningLimit: this.resolveWarningLimit(user.warningStage),
        isBanned: user.isBannedPermanent || isTemporarilyBanned,
      };
    });

    return {
      data: users,
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

  async createAchievement(
    dto: CreateAchievementDto,
    adminId: string,
    requestId?: string,
  ) {
    try {
      const created = await this.prisma.achievementDefinition.create({
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

      await this.createAuditLog({
        actorAdminId: adminId,
        action: 'ACHIEVEMENT_CREATED',
        entityType: 'ACHIEVEMENT',
        entityId: created.id,
        requestId,
        summary: `Achievement ${created.code} created`,
        after: {
          code: created.code,
          title: created.title,
        },
      });

      return created;
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

  async updateAchievement(
    achievementId: string,
    dto: UpdateAchievementDto,
    adminId: string,
    requestId?: string,
  ) {
    const existing = await this.prisma.achievementDefinition.findUnique({
      where: { id: achievementId },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Achievement not found');
    }

    const updated = await this.prisma.achievementDefinition.update({
      where: { id: achievementId },
      data: {
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

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'ACHIEVEMENT_UPDATED',
      entityType: 'ACHIEVEMENT',
      entityId: achievementId,
      requestId,
      summary: `Achievement ${updated.code} updated`,
      before: {
        title: existing.title,
        description: existing.description,
      },
      after: {
        title: updated.title,
        description: updated.description,
      },
    });

    return updated;
  }

  async deleteAchievement(
    achievementId: string,
    adminId: string,
    requestId?: string,
  ) {
    const existing = await this.prisma.achievementDefinition.findUnique({
      where: { id: achievementId },
      select: {
        id: true,
        code: true,
        title: true,
        _count: {
          select: {
            users: true,
            profileBadgeUsers: true,
            activeBadgeUsers: true,
            manualAssignments: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Achievement not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { activeBadgeDefinitionId: achievementId },
        data: { activeBadgeDefinitionId: null },
      });

      await tx.userProfileBadge.deleteMany({
        where: { definitionId: achievementId },
      });

      await tx.userAchievement.deleteMany({
        where: { definitionId: achievementId },
      });

      await tx.achievementAssignment.deleteMany({
        where: { definitionId: achievementId },
      });

      await tx.achievementDefinition.delete({
        where: { id: achievementId },
      });
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'ACHIEVEMENT_DELETED',
      entityType: 'ACHIEVEMENT',
      entityId: achievementId,
      requestId,
      summary: `Achievement ${existing.code} deleted`,
      metadata: {
        users: existing._count.users,
        profileBadgeUsers: existing._count.profileBadgeUsers,
        activeBadgeUsers: existing._count.activeBadgeUsers,
        manualAssignments: existing._count.manualAssignments,
      },
    });

    return { ok: true };
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
    requestId?: string,
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
        text: `Congratulations! You unlocked "${definition.title}" (${definition.code}).`,
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

    const result = {
      admin,
      user,
      achievement: {
        code: definition.code,
        title: definition.title,
        description: definition.description,
      },
      unlockedAt: userAchievement?.unlockedAt ?? new Date(),
    };

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'ACHIEVEMENT_ASSIGNED',
      entityType: 'USER',
      entityId: user.id,
      requestId,
      summary: `Assigned ${definition.code} to ${user.displayName}`,
      metadata: {
        achievementCode: definition.code,
        achievementId: definition.id,
      },
    });

    return result;
  }

  async updateUserRole(
    userId: string,
    role: AdminRoleValue,
    adminId: string,
    requestId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, displayName: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const normalizedRole = role === 'ADMIN' ? Role.ADMIN : Role.BUYER;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: normalizedRole },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'USER_ROLE_UPDATED',
      entityType: 'USER',
      entityId: userId,
      requestId,
      summary: `Role changed to ${role} for ${updated.displayName}`,
      before: { role: existing.role },
      after: { role: updated.role },
    });

    return updated;
  }

  async banUser(
    userId: string,
    dto: BanUserDto,
    adminId: string,
    requestId?: string,
  ) {
    const reason = dto.reason.trim();
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        role: true,
        isBannedPermanent: true,
        bannedUntil: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      throw new BadRequestException('Cannot ban another admin account');
    }

    const isPermanent = dto.duration === 'PERMANENT';
    const durationMap: Record<string, number> = {
      '1day': 1,
      '3days': 3,
      '7days': 7,
      '30days': 30,
    };

    const bannedUntil =
      isPermanent || !durationMap[dto.duration]
        ? null
        : new Date(
            now.getTime() + durationMap[dto.duration] * 24 * 60 * 60 * 1000,
          );

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBannedPermanent: isPermanent,
        bannedUntil,
        banReason: reason,
      },
      select: {
        id: true,
        displayName: true,
        isBannedPermanent: true,
        bannedUntil: true,
        banReason: true,
      },
    });

    await this.systemNotificationsService.createForUser({
      userId,
      senderAdminId: adminId,
      title: 'Account moderation',
      text: this.buildBanMessage({
        reason,
        duration: dto.duration,
        until: bannedUntil,
        isPermanent,
      }),
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'USER_BANNED',
      entityType: 'USER',
      entityId: userId,
      requestId,
      summary: `User banned (${dto.duration})`,
      before: {
        isBannedPermanent: user.isBannedPermanent,
        bannedUntil: user.bannedUntil,
      },
      after: {
        isBannedPermanent: updated.isBannedPermanent,
        bannedUntil: updated.bannedUntil,
        banReason: updated.banReason,
      },
    });

    return {
      ok: true,
      user: updated,
    };
  }

  async unbanUser(userId: string, adminId: string, requestId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        isBannedPermanent: true,
        bannedUntil: true,
        banReason: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBannedPermanent: false,
        bannedUntil: null,
        banReason: null,
      },
      select: {
        id: true,
        displayName: true,
        isBannedPermanent: true,
        bannedUntil: true,
      },
    });

    await this.systemNotificationsService.createForUser({
      userId,
      senderAdminId: adminId,
      title: 'Account moderation',
      text: 'Your account ban has been lifted by the administration team.',
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'USER_UNBANNED',
      entityType: 'USER',
      entityId: userId,
      requestId,
      summary: `User unbanned: ${updated.displayName}`,
      before: {
        isBannedPermanent: existing.isBannedPermanent,
        bannedUntil: existing.bannedUntil,
        banReason: existing.banReason,
      },
      after: {
        isBannedPermanent: updated.isBannedPermanent,
        bannedUntil: updated.bannedUntil,
      },
    });

    return { ok: true };
  }

  async warnUser(
    userId: string,
    dto: WarnUserDto,
    adminId: string,
    requestId?: string,
  ) {
    const reason = dto.reason.trim();
    const now = new Date();
    const warningExpiresAt = new Date(
      now.getTime() + AdminService.WARNING_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        role: true,
        warningStage: true,
        isBannedPermanent: true,
        bannedUntil: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      throw new BadRequestException('Cannot warn another admin account');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.userWarning.create({
        data: {
          userId,
          issuedByAdminId: adminId,
          reason,
          expiresAt: warningExpiresAt,
        },
      });

      const activeWarnings = await tx.userWarning.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
        },
      });

      const warningLimit = this.resolveWarningLimit(user.warningStage);

      if (activeWarnings.length < warningLimit) {
        return {
          escalated: false,
          warningCount: activeWarnings.length,
          warningLimit,
          stage: user.warningStage,
        };
      }

      const isSecondStage = user.warningStage >= 2;

      await tx.userWarning.updateMany({
        where: {
          id: { in: activeWarnings.map((item) => item.id) },
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokedByAdminId: adminId,
        },
      });

      if (isSecondStage) {
        await tx.user.update({
          where: { id: userId },
          data: {
            isBannedPermanent: true,
            bannedUntil: null,
            banReason: `Auto-ban after ${warningLimit}/${warningLimit} warnings`,
          },
        });

        return {
          escalated: true,
          escalationType: 'PERMANENT' as const,
          warningCount: 0,
          warningLimit,
          stage: user.warningStage,
        };
      }

      const banUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await tx.user.update({
        where: { id: userId },
        data: {
          isBannedPermanent: false,
          bannedUntil: banUntil,
          banReason: `Auto-ban after ${warningLimit}/${warningLimit} warnings`,
          warningStage: 2,
        },
      });

      return {
        escalated: true,
        escalationType: 'TEMP_30_DAYS' as const,
        warningCount: 0,
        warningLimit: 2,
        stage: 2,
        banUntil,
      };
    });

    const warningMessageBase = `You received a warning for reason: "${reason}". Please follow marketplace rules to avoid restrictions.`;

    if (!result.escalated) {
      await this.systemNotificationsService.createForUser({
        userId,
        senderAdminId: adminId,
        title: 'Warning issued',
        text: `${warningMessageBase} Current warnings: ${result.warningCount}/${result.warningLimit}.`,
      });
    } else if (result.escalationType === 'TEMP_30_DAYS') {
      await this.systemNotificationsService.createForUser({
        userId,
        senderAdminId: adminId,
        title: 'Warning escalation',
        text: `${warningMessageBase} You reached warning limit and have been banned for 30 days. After unban your warning threshold is 2.`,
      });
    } else {
      await this.systemNotificationsService.createForUser({
        userId,
        senderAdminId: adminId,
        title: 'Warning escalation',
        text: `${warningMessageBase} You reached warning limit again and your account has been permanently banned.`,
      });
    }

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'USER_WARNED',
      entityType: 'USER',
      entityId: userId,
      requestId,
      summary: `Warning issued to ${user.displayName}`,
      metadata: {
        reason,
        warningCount: result.warningCount,
        warningLimit: result.warningLimit,
        warningStage: result.stage,
        escalated: result.escalated,
        escalationType: result.escalated ? result.escalationType : null,
      },
    });

    return {
      ok: true,
      warningCount: result.warningCount,
      warningLimit: result.warningLimit,
      escalated: result.escalated,
      escalationType: result.escalated ? result.escalationType : null,
    };
  }

  async unwarnUser(userId: string, adminId: string, requestId?: string) {
    const now = new Date();

    const [user, latestActiveWarning] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true },
      }),
      this.prisma.userWarning.findFirst({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          reason: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!latestActiveWarning) {
      throw new BadRequestException('User has no active warnings');
    }

    await this.prisma.userWarning.update({
      where: { id: latestActiveWarning.id },
      data: {
        revokedAt: now,
        revokedByAdminId: adminId,
      },
    });

    const warningCount = await this.getActiveWarningCount(userId, now);
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { warningStage: true },
    });

    await this.systemNotificationsService.createForUser({
      userId,
      senderAdminId: adminId,
      title: 'Warning removed',
      text: `One warning has been removed from your account by administration.`,
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'USER_UNWARNED',
      entityType: 'USER',
      entityId: userId,
      requestId,
      summary: `One warning removed from ${user.displayName}`,
      metadata: {
        removedWarningId: latestActiveWarning.id,
        reason: latestActiveWarning.reason,
        warningCount,
      },
    });

    return {
      ok: true,
      warningCount,
      warningLimit: this.resolveWarningLimit(targetUser?.warningStage ?? 1),
    };
  }

  async removeUserAvatar(userId: string, adminId: string, requestId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
      },
    });

    await this.systemNotificationsService.createForUser({
      userId,
      senderAdminId: adminId,
      title: 'Profile moderation',
      text: 'Your avatar has been removed by administration due to policy violation.',
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'USER_AVATAR_REMOVED',
      entityType: 'USER',
      entityId: userId,
      requestId,
      summary: `Avatar removed for ${existing.displayName}`,
      before: { avatarUrl: existing.avatarUrl },
      after: { avatarUrl: null },
    });

    return { ok: true };
  }

  async archiveListing(listingId: string, adminId: string, requestId?: string) {
    const existing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, title: true, sellerId: true },
    });

    if (!existing) {
      throw new NotFoundException('Listing not found');
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ARCHIVED' },
      select: {
        id: true,
        status: true,
      },
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'LISTING_ARCHIVED',
      entityType: 'LISTING',
      entityId: listingId,
      requestId,
      summary: `Listing archived: ${existing.title}`,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: { sellerId: existing.sellerId },
    });

    return updated;
  }

  async restoreListing(listingId: string, adminId: string, requestId?: string) {
    const existing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, title: true, sellerId: true },
    });

    if (!existing) {
      throw new NotFoundException('Listing not found');
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        status: true,
      },
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'LISTING_RESTORED',
      entityType: 'LISTING',
      entityId: listingId,
      requestId,
      summary: `Listing restored: ${existing.title}`,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: { sellerId: existing.sellerId },
    });

    return updated;
  }

  async deleteReview(reviewId: string, adminId: string, requestId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: reviewId },
        select: {
          id: true,
          sellerId: true,
          buyerId: true,
          rating: true,
          comment: true,
          dealId: true,
        },
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

      return { ok: true, review };
    });

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'REVIEW_DELETED',
      entityType: 'REVIEW',
      entityId: reviewId,
      requestId,
      summary: 'Review deleted by admin',
      before: {
        rating: result.review.rating,
        comment: result.review.comment,
        dealId: result.review.dealId,
        sellerId: result.review.sellerId,
        buyerId: result.review.buyerId,
      },
    });

    return { ok: true };
  }

  async finalizePreviousWeekTopSellerReward(
    adminId: string,
    requestId?: string,
  ) {
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
        currentStats?.lastWinWeekStart?.getTime() ===
        previousWeekStart.getTime();
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

      const streakAchievementCodes =
        this.resolveWeeklyStreakAchievementCodes(streakAfterWin);

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
        ).toFixed(
          2,
        )}. Current streak: ${result.winnerNotificationPayload.streakAfterWin}.`,
      });

      for (const achievement of result.winnerNotificationPayload
        .unlockedAchievements) {
        await this.systemNotificationsService.createForUser({
          userId: result.winnerNotificationPayload.userId,
          title: 'New achievement unlocked',
          text: `Congratulations! You unlocked "${achievement.title}" (${achievement.code}).`,
        });
      }
    }

    const response = {
      alreadyFinalized: result.alreadyFinalized,
      competition: result.competition,
      winner: result.winner,
    };

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'WEEKLY_REWARD_FINALIZED',
      entityType: 'WEEKLY_COMPETITION',
      entityId: response.competition.id,
      requestId,
      summary: response.alreadyFinalized
        ? 'Weekly reward finalize called for already finalized competition'
        : `Weekly reward processed with status ${response.competition.status}`,
      after: {
        status: response.competition.status,
        winnerUserId:
          (response.winner && 'id' in response.winner
            ? response.winner.id
            : null) ?? null,
        rewardAmount: response.competition.rewardAmount,
      },
    });

    return response;
  }

  async broadcastSystemMessage(
    adminId: string,
    dto: BroadcastSystemMessageDto,
    requestId?: string,
  ) {
    const text = dto.text?.trim();

    if (!text) {
      throw new BadRequestException('Message text is required');
    }

    const result = await this.systemNotificationsService.broadcastFromAdmin(
      adminId,
      {
        title: dto.title,
        text,
      },
    );

    await this.createAuditLog({
      actorAdminId: adminId,
      action: 'SYSTEM_BROADCAST_SENT',
      entityType: 'SYSTEM_NOTIFICATION',
      requestId,
      summary: `Broadcast sent to ${result.sent} users`,
      metadata: {
        title: dto.title ?? null,
        text,
        sent: result.sent,
      },
    });

    return result;
  }
}
