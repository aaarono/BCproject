import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DealsService } from './deals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ChatGateway } from '../chat/chat.gateway';

describe('DealsService', () => {
  let service: DealsService;
  let prisma: any;
  let walletService: any;
  let chatGateway: any;

  const fullDeal = {
    id: 'deal1',
    listingId: 'l1',
    buyerId: 'buyer1',
    sellerId: 'seller1',
    quantity: 1,
    unitPriceSnapshot: 5000,
    totalAmountSnapshot: 5000,
    status: 'FUNDED',
    listing: {
      id: 'l1',
      title: 'Item',
      price: 5000,
      type: 'GOOD',
      status: 'ACTIVE',
    },
    buyer: { id: 'buyer1', displayName: 'Buyer' },
    seller: { id: 'seller1', displayName: 'Seller' },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      deal: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      listing: { findUnique: jest.fn() },
      listingPriceHistory: { findMany: jest.fn() },
      wallet: { findUnique: jest.fn() },
    };
    walletService = {
      lockEscrow: jest.fn(),
      releaseEscrowToSeller: jest.fn(),
      refundToBuyer: jest.fn(),
    };
    chatGateway = { emitDealUpdate: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: walletService },
        { provide: ChatGateway, useValue: chatGateway },
      ],
    }).compile();

    service = module.get(DealsService);
  });

  describe('create', () => {
    const listing = {
      id: 'l1',
      sellerId: 'seller1',
      status: 'ACTIVE',
      price: 5000,
      salePercent: null,
      saleStartsAt: null,
      saleEndsAt: null,
    };

    it('should create and fund a deal', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      prisma.deal.findFirst.mockResolvedValue(null);
      prisma.listingPriceHistory.findMany.mockResolvedValue([]);
      prisma.wallet.findUnique.mockResolvedValue({ balance: 10000 });
      prisma.deal.create.mockResolvedValue({ id: 'deal1' });
      prisma.deal.findUniqueOrThrow.mockResolvedValue(fullDeal);
      // getFullDeal after transaction
      prisma.deal.findUnique.mockResolvedValue(fullDeal);

      const result = await service.create('l1', 'buyer1');

      expect(result.id).toBe('deal1');
      expect(walletService.lockEscrow).toHaveBeenCalledWith(
        prisma,
        'buyer1',
        'deal1',
        5000,
      );
      expect(chatGateway.emitDealUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException if listing not found', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(service.create('l1', 'buyer1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException on self-purchase', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      await expect(service.create('l1', 'seller1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return existing active deal', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      prisma.deal.findFirst.mockResolvedValue(fullDeal);

      const result = await service.create('l1', 'buyer1');
      expect(result).toEqual(fullDeal);
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException on insufficient balance', async () => {
      prisma.listing.findUnique.mockResolvedValue(listing);
      prisma.deal.findFirst.mockResolvedValue(null);
      prisma.listingPriceHistory.findMany.mockResolvedValue([]);
      prisma.wallet.findUnique.mockResolvedValue({ balance: 100 });

      await expect(service.create('l1', 'buyer1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('markDelivered', () => {
    it('should mark deal as delivered by seller', async () => {
      const deal = {
        id: 'deal1',
        sellerId: 'seller1',
        status: 'FUNDED',
        listing: { price: 5000 },
      };
      prisma.deal.findUnique
        .mockResolvedValueOnce(deal) // getDeal
        .mockResolvedValueOnce(fullDeal); // getFullDeal
      prisma.deal.update.mockResolvedValue({});

      const result = await service.markDelivered('deal1', 'seller1');
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DELIVERED',
            expiresAt: null,
          }),
        }),
      );
    });

    it('should throw ForbiddenException if not seller', async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal1',
        sellerId: 'seller1',
        status: 'FUNDED',
      });
      await expect(service.markDelivered('deal1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if wrong status', async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal1',
        sellerId: 'seller1',
        status: 'INITIATED',
      });
      await expect(service.markDelivered('deal1', 'seller1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('complete', () => {
    it('should complete deal and release escrow', async () => {
      const deal = {
        id: 'deal1',
        buyerId: 'buyer1',
        sellerId: 'seller1',
        status: 'DELIVERED',
        totalAmountSnapshot: 5000,
      };
      prisma.deal.findUnique
        .mockResolvedValueOnce(deal) // inside $transaction
        .mockResolvedValueOnce(fullDeal); // getFullDeal
      prisma.deal.update.mockResolvedValue({});

      const result = await service.complete('deal1', 'buyer1');

      expect(walletService.releaseEscrowToSeller).toHaveBeenCalledWith(
        prisma,
        'seller1',
        'deal1',
        5000,
      );
    });

    it('should throw ForbiddenException if not buyer', async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal1',
        buyerId: 'buyer1',
        status: 'DELIVERED',
        listing: { price: 5000 },
      });
      await expect(service.complete('deal1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel funded deal with refund', async () => {
      const deal = {
        id: 'deal1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'FUNDED',
        totalAmountSnapshot: 5000,
      };
      prisma.deal.findUnique
        .mockResolvedValueOnce(deal) // inside $transaction
        .mockResolvedValueOnce(fullDeal); // getFullDeal
      prisma.deal.update.mockResolvedValue({});

      await service.cancel('deal1', 'seller1');

      expect(walletService.refundToBuyer).toHaveBeenCalledWith(
        prisma,
        'buyer1',
        'deal1',
        5000,
      );
    });

    it('should cancel initiated deal without refund', async () => {
      const deal = {
        id: 'deal1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'INITIATED',
        totalAmountSnapshot: 5000,
      };
      prisma.deal.findUnique
        .mockResolvedValueOnce(deal)
        .mockResolvedValueOnce(fullDeal);
      prisma.deal.update.mockResolvedValue({});

      await service.cancel('deal1', 'seller1');

      expect(walletService.refundToBuyer).not.toHaveBeenCalled();
    });

    it('should allow buyer to cancel funded deal with refund', async () => {
      const deal = {
        id: 'deal1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'FUNDED',
        totalAmountSnapshot: 5000,
      };
      prisma.deal.findUnique
        .mockResolvedValueOnce(deal)
        .mockResolvedValueOnce(fullDeal);
      prisma.deal.update.mockResolvedValue({});

      await service.cancel('deal1', 'buyer1');

      expect(walletService.refundToBuyer).toHaveBeenCalledWith(
        prisma,
        'buyer1',
        'deal1',
        5000,
      );
    });

    it('should throw ForbiddenException if not participant', async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal1',
        sellerId: 'seller1',
        buyerId: 'buyer1',
        status: 'FUNDED',
        totalAmountSnapshot: 5000,
      });
      await expect(service.cancel('deal1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getById', () => {
    it('should return deal for participant', async () => {
      prisma.deal.findUnique.mockResolvedValue(fullDeal);
      const result = await service.getById('deal1', 'buyer1');
      expect(result).toEqual(fullDeal);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);
      await expect(service.getById('deal1', 'buyer1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not participant', async () => {
      prisma.deal.findUnique.mockResolvedValue(fullDeal);
      await expect(service.getById('deal1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getMyDeals', () => {
    it('should return deals for user', async () => {
      prisma.deal.findMany.mockResolvedValue([fullDeal]);
      const result = await service.getMyDeals('buyer1');
      expect(result).toEqual([fullDeal]);
    });
  });
});
