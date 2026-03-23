import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto, ListingSortDto } from './dto/listing-query.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly HISTORY_WINDOW_DAYS = 30;

  private normalizeTags(tags?: string[] | null) {
    if (!tags) return [];

    const normalized = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    return [...new Set(normalized)];
  }

  private getHistoryWindowStart() {
    const date = new Date();
    date.setDate(date.getDate() - ListingsService.HISTORY_WINDOW_DAYS);
    return date;
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

  async getPriceHistory(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');

    const points = await this.prisma.listingPriceHistory.findMany({
      where: {
        listingId: id,
        createdAt: { gte: this.getHistoryWindowStart() },
      },
      orderBy: { createdAt: 'asc' },
      select: { price: true, createdAt: true },
    });

    return { points };
  }

  async create(sellerId: string, dto: CreateListingDto) {
    const saleData = this.normalizeSaleInput({
      salePercent: dto.salePercent,
      saleStartsAt: dto.saleStartsAt,
      saleEndsAt: dto.saleEndsAt,
    });

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          sellerId,
          title: dto.title,
          description: dto.description,
          price: dto.price,
          type: dto.type,
          category: dto.category,
          tags: this.normalizeTags(dto.tags),
          status: 'ACTIVE',
          salePercent: saleData.salePercent,
          saleStartsAt: saleData.saleStartsAt,
          saleEndsAt: saleData.saleEndsAt,
        },
      });

      await tx.listingPriceHistory.create({
        data: {
          listingId: listing.id,
          price: listing.price,
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

      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          title: dto.title ?? undefined,
          description: dto.description ?? undefined,
          price: dto.price ?? undefined,
          type: dto.type ?? undefined,
          category: dto.category ?? undefined,
          tags:
            dto.tags !== undefined ? this.normalizeTags(dto.tags) : undefined,
          salePercent: saleData.salePercent,
          saleStartsAt: saleData.saleStartsAt,
          saleEndsAt: saleData.saleEndsAt,
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
