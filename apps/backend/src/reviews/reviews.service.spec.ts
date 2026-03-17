import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      deal: { findUnique: jest.fn() },
      review: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ReviewsService);
  });

  describe('create', () => {
    const dto = { dealId: 'deal1', rating: 5, comment: 'Great!' };
    const deal = {
      id: 'deal1',
      buyerId: 'buyer1',
      sellerId: 'seller1',
      status: 'COMPLETED',
    };
    const seller = { id: 'seller1', ratingAvg: 4, ratingCount: 2 };

    it('should create review and update seller rating', async () => {
      prisma.deal.findUnique.mockResolvedValue(deal);
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({ id: 'r1', ...dto });
      prisma.user.findUnique.mockResolvedValue(seller);
      prisma.user.update.mockResolvedValue({});

      const result = await service.create('buyer1', dto);

      expect(result.id).toBe('r1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'seller1' },
        data: { ratingAvg: (4 * 2 + 5) / 3, ratingCount: 3 },
      });
    });

    it('should throw NotFoundException if deal not found', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);
      await expect(service.create('buyer1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not the buyer', async () => {
      prisma.deal.findUnique.mockResolvedValue(deal);
      await expect(service.create('other-user', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if deal is not completed', async () => {
      prisma.deal.findUnique.mockResolvedValue({ ...deal, status: 'FUNDED' });
      await expect(service.create('buyer1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if review already exists', async () => {
      prisma.deal.findUnique.mockResolvedValue(deal);
      prisma.review.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create('buyer1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getSellerReviews', () => {
    it('should return reviews for seller', async () => {
      const reviews = [{ id: 'r1', rating: 5 }];
      prisma.review.findMany.mockResolvedValue(reviews);

      const result = await service.getSellerReviews('seller1');
      expect(result).toEqual(reviews);
    });
  });

  describe('getByDeal', () => {
    it('should return review by deal id', async () => {
      const review = { id: 'r1', dealId: 'deal1', rating: 5 };
      prisma.review.findUnique.mockResolvedValue(review);

      const result = await service.getByDeal('deal1');
      expect(result).toEqual(review);
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(service.getByDeal('deal1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
