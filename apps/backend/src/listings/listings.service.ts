import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
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
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async create(sellerId: string, dto: CreateListingDto) {
    return this.prisma.listing.create({
      data: {
        sellerId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        type: dto.type,
        status: 'ACTIVE',
      },
    });
  }

  async update(listingId: string, sellerId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId)
      throw new ForbiddenException('Not your listing');

    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        price: dto.price ?? undefined,
        type: dto.type ?? undefined,
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
