import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ListingsService', () => {
  let service: ListingsService;
  let prisma: any;

  const seller = {
    id: 'seller1',
    displayName: 'Seller',
    ratingAvg: 4.5,
    ratingCount: 10,
  };
  const listing = {
    id: 'l1',
    sellerId: 'seller1',
    title: 'Item',
    description: 'Desc',
    price: 5000,
    type: 'GOOD',
    status: 'ACTIVE',
    seller,
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ListingsService);
  });

  describe('getFeed', () => {
    it('should return paginated listings', async () => {
      prisma.listing.findMany.mockResolvedValue([listing]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.getFeed({ page: 1, limit: 12 });

      expect(result.data).toEqual([listing]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });
    });

    it('should apply search filter', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      await service.getFeed({ search: 'watch' });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'watch', mode: 'insensitive' } },
              { description: { contains: 'watch', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should apply type filter', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      await service.getFeed({ type: 'SERVICE' as any });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'SERVICE' }),
        }),
      );
    });

    it('should apply price range filter', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      await service.getFeed({ minPrice: 100, maxPrice: 5000 });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ price: { gte: 100, lte: 5000 } }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return listing by id', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      const result = await service.getById('l1');
      expect(result).toEqual(listing);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(service.getById('l1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a listing', async () => {
      const dto = {
        title: 'New',
        description: 'Desc',
        price: 1000,
        type: 'GOOD' as any,
      };
      prisma.listing.create.mockResolvedValue({
        id: 'l2',
        ...dto,
        sellerId: 'seller1',
        status: 'ACTIVE',
      });

      const result = await service.create('seller1', dto);

      expect(result.id).toBe('l2');
      expect(prisma.listing.create).toHaveBeenCalledWith({
        data: {
          sellerId: 'seller1',
          title: 'New',
          description: 'Desc',
          price: 1000,
          type: 'GOOD',
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('update', () => {
    it('should update listing if owner', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      prisma.listing.update.mockResolvedValue({ ...listing, title: 'Updated' });

      const result = await service.update('l1', 'seller1', {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException if listing not found', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(
        service.update('l1', 'seller1', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      await expect(
        service.update('l1', 'other', { title: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archive', () => {
    it('should archive listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      prisma.listing.update.mockResolvedValue({
        ...listing,
        status: 'ARCHIVED',
      });

      const result = await service.archive('l1', 'seller1');
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ARCHIVED' } }),
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      await expect(service.archive('l1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('restore', () => {
    it('should restore archived listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        ...listing,
        status: 'ARCHIVED',
      });
      prisma.listing.update.mockResolvedValue(listing);

      const result = await service.restore('l1', 'seller1');
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACTIVE' } }),
      );
    });
  });

  describe('getMyListings', () => {
    it('should return listings for seller', async () => {
      prisma.listing.findMany.mockResolvedValue([listing]);
      const result = await service.getMyListings('seller1');
      expect(result).toEqual([listing]);
    });
  });
});
