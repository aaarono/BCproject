import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed() {
    return this.prisma.listing.findMany({
      where: { status: 'ACTIVE' },
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
        type: dto.type as any,
        status: 'ACTIVE',
      },
    });
  }

  async update(listingId: string, sellerId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');

    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        price: dto.price ?? undefined,
        type: (dto.type as any) ?? undefined,
      },
    });
  }

  async remove(listingId: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');

    // мягкое удаление (лучше для истории)
    return this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ARCHIVED' },
    });
  }
}
