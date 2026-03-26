import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto, ListingSortDto } from './dto/listing-query.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly HISTORY_WINDOW_DAYS = 30;
  private static readonly DISCOUNT_MIN_PERCENT = 5;
  private static readonly DISCOUNT_MAX_PERCENT = 70;
  private static readonly BASE_PRICE_TOLERANCE_PERCENT = 0.03;

  private normalizeTags(tags?: string[] | null) {
    if (!tags) return [];

    const normalized = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    return [...new Set(normalized)];
  }

  private getHistoryWindowStart(days = ListingsService.HISTORY_WINDOW_DAYS) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private buildDiscountPolicy(minBasePrice30d: number) {
    const tolerance = ListingsService.BASE_PRICE_TOLERANCE_PERCENT;
    const allowedMinBasePrice = Math.max(
      1,
      Math.floor(minBasePrice30d * (1 - tolerance)),
    );
    const allowedMaxBasePrice = Math.max(
      allowedMinBasePrice,
      Math.ceil(minBasePrice30d * (1 + tolerance)),
    );

    return {
      minBasePrice30d,
      allowedMinBasePrice,
      allowedMaxBasePrice,
      discountPercentMin: ListingsService.DISCOUNT_MIN_PERCENT,
      discountPercentMax: ListingsService.DISCOUNT_MAX_PERCENT,
      tolerancePercent: Math.round(tolerance * 100),
    };
  }

  private async getMinBasePrice30d(
    listingId: string,
    currentBasePrice: number,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const rows = await client.listingPriceHistory.findMany({
      where: {
        listingId,
        isSale: false,
        createdAt: { gte: this.getHistoryWindowStart() },
      },
      select: { price: true },
    });

    const prices = rows.map((row) => row.price);
    prices.push(currentBasePrice);

    return Math.min(...prices);
  }

  private async assertSaleEligibility(params: {
    listingId: string;
    basePrice: number;
    salePercent: number | null;
    client?: PrismaService | Prisma.TransactionClient;
  }) {
    const client = params.client ?? this.prisma;

    if (!params.salePercent) return;

    const minBasePrice30d = await this.getMinBasePrice30d(
      params.listingId,
      params.basePrice,
      client,
    );

    const policy = this.buildDiscountPolicy(minBasePrice30d);

    if (
      params.basePrice < policy.allowedMinBasePrice ||
      params.basePrice > policy.allowedMaxBasePrice
    ) {
      throw new BadRequestException(
        `Listing does not meet flash-sale requirements. Allowed base price range: ${policy.allowedMinBasePrice}-${policy.allowedMaxBasePrice} cents (30d min base: ${policy.minBasePrice30d} cents, tolerance ±${policy.tolerancePercent}%).`,
      );
    }
  }

  private async getAllTimeMinPriceStats(
    listingId: string,
    currentSaleSnapshot?: {
      price: number;
      createdAt: Date;
      salePercent: number;
    } | null,
  ) {
    const [minPriceOnSales, minPriceNoSales] = await Promise.all([
      this.prisma.listingPriceHistory.findFirst({
        where: { listingId, isSale: true },
        orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
        select: { price: true, createdAt: true, salePercent: true },
      }),
      this.prisma.listingPriceHistory.findFirst({
        where: { listingId, isSale: false },
        orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
        select: { price: true, createdAt: true },
      }),
    ]);

    const resolvedMinPriceOnSales = (() => {
      if (!currentSaleSnapshot) return minPriceOnSales;
      if (!minPriceOnSales) return currentSaleSnapshot;
      if (currentSaleSnapshot.price < minPriceOnSales.price) {
        return currentSaleSnapshot;
      }
      return minPriceOnSales;
    })();

    return {
      minPriceOnSales: resolvedMinPriceOnSales,
      minPriceNoSales,
    };
  }

  private normalizeSaleInput(params: {
    salePercent?: number | null;
    saleStartsAt?: string | Date | null;
    saleEndsAt?: string | Date | null;
  }) {
    const salePercent = params.salePercent ?? null;
    const saleStartsAt = params.saleStartsAt
      ? new Date(params.saleStartsAt)
      : null;
    const saleEndsAt = params.saleEndsAt ? new Date(params.saleEndsAt) : null;

    const hasAnySaleValue = !!salePercent || !!saleStartsAt || !!saleEndsAt;
    if (!hasAnySaleValue) {
      return {
        salePercent: null,
        saleStartsAt: null,
        saleEndsAt: null,
      };
    }

    if (!salePercent || !saleStartsAt || !saleEndsAt) {
      throw new BadRequestException(
        'salePercent, saleStartsAt and saleEndsAt must be provided together',
      );
    }

    if (
      salePercent < ListingsService.DISCOUNT_MIN_PERCENT ||
      salePercent > ListingsService.DISCOUNT_MAX_PERCENT
    ) {
      throw new BadRequestException(
        `salePercent must be between ${ListingsService.DISCOUNT_MIN_PERCENT} and ${ListingsService.DISCOUNT_MAX_PERCENT}`,
      );
    }

    if (saleStartsAt >= saleEndsAt) {
      throw new BadRequestException('saleStartsAt must be before saleEndsAt');
    }

    return {
      salePercent,
      saleStartsAt,
      saleEndsAt,
    };
  }

  private isSaleTimeActive(listing: {
    salePercent: number | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
  }) {
    if (!listing.salePercent || !listing.saleStartsAt || !listing.saleEndsAt) {
      return false;
    }

    const now = new Date();
    return now >= listing.saleStartsAt && now <= listing.saleEndsAt;
  }

  private discountedPrice(price: number, salePercent: number | null) {
    if (!salePercent) return price;
    return Math.round((price * (100 - salePercent)) / 100);
  }

  private enrichPricingMeta<
    T extends {
      id: string;
      price: number;
      salePercent: number | null;
      saleStartsAt: Date | null;
      saleEndsAt: Date | null;
    },
  >(listing: T, referencePrice30d: number | null) {
    const referencePrice = referencePrice30d ?? listing.price;
    const discountedPrice = this.discountedPrice(
      listing.price,
      listing.salePercent,
    );
    const isOnSale =
      this.isSaleTimeActive(listing) && discountedPrice < referencePrice;

    return {
      ...listing,
      referencePrice30d: referencePrice,
      discountedPrice,
      effectivePrice: isOnSale ? discountedPrice : listing.price,
      isOnSale,
    };
  }

  private async withPricingMeta<
    T extends {
      id: string;
      price: number;
      salePercent: number | null;
      saleStartsAt: Date | null;
      saleEndsAt: Date | null;
    },
  >(listings: T[]) {
    if (listings.length === 0) return listings;

    const historyWindowStart = this.getHistoryWindowStart();
    const history = await this.prisma.listingPriceHistory.findMany({
      where: {
        listingId: { in: listings.map((listing) => listing.id) },
        isSale: false,
        createdAt: { gte: historyWindowStart },
      },
      select: {
        listingId: true,
        price: true,
      },
    });

    const referenceByListingId = new Map<string, number>();
    for (const row of history) {
      const current = referenceByListingId.get(row.listingId);
      if (current === undefined || row.price < current) {
        referenceByListingId.set(row.listingId, row.price);
      }
    }

    return listings.map((listing) =>
      this.enrichPricingMeta(
        listing,
        referenceByListingId.get(listing.id) ?? null,
      ),
    );
  }

  async getFeed(query: ListingQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = { status: 'ACTIVE' };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.minRating !== undefined) {
      where.seller = {
        ratingAvg: { gte: query.minRating },
      };
    }

    if (query.tags?.length) {
      where.tags = { hasSome: query.tags };
    }

    if (query.onlyOnlineSellers) {
      const onlineSellerIds = ChatGateway.getOnlineUserIds();
      where.sellerId = { in: onlineSellerIds };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    let orderBy:
      | Prisma.ListingOrderByWithRelationInput
      | Prisma.ListingOrderByWithRelationInput[] = { createdAt: 'desc' };

    switch (query.sort) {
      case ListingSortDto.PRICE_ASC:
        orderBy = { price: 'asc' };
        break;
      case ListingSortDto.PRICE_DESC:
        orderBy = { price: 'desc' };
        break;
      case ListingSortDto.RATING:
        orderBy = [{ seller: { ratingAvg: 'desc' } }, { createdAt: 'desc' }];
        break;
      case ListingSortDto.SALE:
        orderBy = [{ salePercent: 'desc' }, { createdAt: 'desc' }];
        break;
      case ListingSortDto.NEWEST:
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          seller: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              ratingAvg: true,
              ratingCount: true,
              achievements: {
                orderBy: { unlockedAt: 'desc' },
                take: 3,
                select: {
                  unlockedAt: true,
                  definition: {
                    select: {
                      code: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    const data = await this.withPricingMeta(rawData);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const rawListing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            ratingAvg: true,
            ratingCount: true,
            achievements: {
              orderBy: { unlockedAt: 'desc' },
              take: 3,
              select: {
                unlockedAt: true,
                definition: {
                  select: {
                    code: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rawListing) throw new NotFoundException('Listing not found');

    const [listing] = await this.withPricingMeta([rawListing]);
    return listing;
  }

  async getPriceHistory(id: string, period: '30d' | 'all' = '30d') {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        price: true,
        salePercent: true,
        saleStartsAt: true,
        saleEndsAt: true,
      },
    });

    if (!listing) throw new NotFoundException('Listing not found');

    const minBasePrice30d = await this.getMinBasePrice30d(id, listing.price);
    const discountPolicy = this.buildDiscountPolicy(minBasePrice30d);
    const now = new Date();
    const isSaleActive =
      !!listing.salePercent &&
      !!listing.saleStartsAt &&
      !!listing.saleEndsAt &&
      listing.saleStartsAt <= now &&
      listing.saleEndsAt >= now;

    const currentSaleSnapshot =
      isSaleActive && listing.salePercent
        ? {
            price: this.discountedPrice(listing.price, listing.salePercent),
            createdAt: listing.saleStartsAt ?? now,
            salePercent: listing.salePercent,
          }
        : null;

    const allTimeStats = await this.getAllTimeMinPriceStats(
      id,
      currentSaleSnapshot,
    );

    const where: Prisma.ListingPriceHistoryWhereInput = {
      listingId: id,
    };

    if (period === '30d') {
      where.createdAt = { gte: this.getHistoryWindowStart() };
    }

    const points = await this.prisma.listingPriceHistory.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        price: true,
        createdAt: true,
        isSale: true,
        salePercent: true,
      },
    });

    return {
      period,
      points,
      stats: {
        ...allTimeStats,
        discountPolicy,
      },
    };
  }

  async getDiscountPolicy(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, price: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');

    const minBasePrice30d = await this.getMinBasePrice30d(id, listing.price);
    return this.buildDiscountPolicy(minBasePrice30d);
  }

  async create(sellerId: string, dto: CreateListingDto) {
    if (dto.type === 'GOOD' && dto.stockQuantity === undefined) {
      throw new BadRequestException('stockQuantity is required for goods');
    }

    const hasAnySaleInput =
      dto.salePercent !== undefined ||
      dto.saleStartsAt !== undefined ||
      dto.saleEndsAt !== undefined;

    if (hasAnySaleInput) {
      throw new BadRequestException(
        'Flash sale can only be configured when editing an existing listing',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          sellerId,
          title: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          price: dto.price,
          stockQuantity: dto.type === 'GOOD' ? dto.stockQuantity : null,
          type: dto.type,
          category: dto.category,
          tags: this.normalizeTags(dto.tags),
          status: 'ACTIVE',
          salePercent: null,
          saleStartsAt: null,
          saleEndsAt: null,
        },
      });

      await tx.listingPriceHistory.create({
        data: {
          listingId: listing.id,
          price: listing.price,
          isSale: false,
          salePercent: null,
        },
      });

      return listing;
    });
  }

  async update(listingId: string, sellerId: string, dto: UpdateListingDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerId !== sellerId)
        throw new ForbiddenException('Not your listing');

      const saleData = this.normalizeSaleInput({
        salePercent:
          dto.salePercent !== undefined ? dto.salePercent : listing.salePercent,
        saleStartsAt:
          dto.saleStartsAt !== undefined
            ? dto.saleStartsAt
            : listing.saleStartsAt,
        saleEndsAt:
          dto.saleEndsAt !== undefined ? dto.saleEndsAt : listing.saleEndsAt,
      });

      const nextType = (dto.type ?? listing.type) as ListingType;
      const nextBasePrice = dto.price ?? listing.price;
      const resolvedStockQuantity =
        nextType === 'GOOD'
          ? dto.stockQuantity ?? listing.stockQuantity
          : null;

      const touchesSaleOrPrice =
        dto.salePercent !== undefined ||
        dto.saleStartsAt !== undefined ||
        dto.saleEndsAt !== undefined ||
        dto.price !== undefined;

      if (touchesSaleOrPrice && saleData.salePercent) {
        await this.assertSaleEligibility({
          listingId,
          basePrice: nextBasePrice,
          salePercent: saleData.salePercent,
          client: tx,
        });
      }

      if (nextType === 'GOOD' && resolvedStockQuantity === null) {
        throw new BadRequestException('stockQuantity is required for goods');
      }

      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          title: dto.title ?? undefined,
          description: dto.description ?? undefined,
          imageUrl: dto.imageUrl ?? undefined,
          price: dto.price ?? undefined,
          stockQuantity: resolvedStockQuantity,
          type: dto.type ?? undefined,
          category: dto.category ?? undefined,
          tags:
            dto.tags !== undefined ? this.normalizeTags(dto.tags) : undefined,
          salePercent: saleData.salePercent,
          saleStartsAt: saleData.saleStartsAt,
          saleEndsAt: saleData.saleEndsAt,
          ...(nextType === 'GOOD' && resolvedStockQuantity === 0
            ? { status: 'ARCHIVED' }
            : {}),
        },
        include: {
          seller: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              ratingAvg: true,
              ratingCount: true,
              achievements: {
                orderBy: { unlockedAt: 'desc' },
                take: 3,
                select: {
                  unlockedAt: true,
                  definition: {
                    select: {
                      code: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (dto.price !== undefined && dto.price !== listing.price) {
        await tx.listingPriceHistory.create({
          data: {
            listingId: listing.id,
            price: dto.price,
            isSale: false,
            salePercent: null,
          },
        });
      }

      const saleChanged =
        dto.salePercent !== undefined ||
        dto.saleStartsAt !== undefined ||
        dto.saleEndsAt !== undefined;

      if (saleChanged && saleData.salePercent) {
        await tx.listingPriceHistory.create({
          data: {
            listingId: listing.id,
            price: this.discountedPrice(nextBasePrice, saleData.salePercent),
            isSale: true,
            salePercent: saleData.salePercent,
          },
        });
      }

      const [result] = await this.withPricingMeta([updated]);
      return result;
    });
  }

  async archive(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('Not your listing');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
    });
  }

  async restore(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('Not your listing');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: 'ACTIVE',
      },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
    });
  }

  async getMyListings(userId: string) {
    return this.prisma.listing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
    });
  }
}
