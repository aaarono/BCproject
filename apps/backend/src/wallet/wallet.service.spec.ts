import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      wallet: { upsert: jest.fn(), update: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [WalletService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(WalletService);
  });

  describe('getOrCreateWallet', () => {
    it('should upsert and return wallet', async () => {
      const wallet = { userId: 'u1', balance: 0 };
      prisma.wallet.upsert.mockResolvedValue(wallet);

      const result = await service.getOrCreateWallet('u1');
      expect(result).toEqual(wallet);
      expect(prisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        update: {},
        create: { userId: 'u1', balance: 0 },
      });
    });
  });

  describe('topUpMock', () => {
    it('should increase balance and create transaction', async () => {
      prisma.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 0 });
      prisma.wallet.update.mockResolvedValue({});
      prisma.walletTransaction.create.mockResolvedValue({});

      await service.topUpMock('u1', 5000);

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { balance: { increment: 5000 } },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: { walletId: 'u1', type: 'TOPUP', amount: 5000 },
      });
    });

    it('should throw ForbiddenException for invalid amount', async () => {
      await expect(service.topUpMock('u1', 0)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.topUpMock('u1', -100)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('lockEscrow', () => {
    let tx: any;

    beforeEach(() => {
      tx = {
        wallet: { upsert: jest.fn(), update: jest.fn() },
        walletTransaction: { create: jest.fn() },
      };
    });

    it('should lock funds when balance is sufficient', async () => {
      tx.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 10000 });

      await service.lockEscrow(tx, 'u1', 'deal1', 5000);

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { balance: { decrement: 5000 } },
      });
      expect(tx.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: 'u1',
          type: 'ESCROW_LOCK',
          amount: -5000,
          dealId: 'deal1',
        },
      });
    });

    it('should throw ForbiddenException when balance is insufficient', async () => {
      tx.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 1000 });

      await expect(service.lockEscrow(tx, 'u1', 'deal1', 5000)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('releaseEscrowToSeller', () => {
    it('should increment seller balance and create transaction', async () => {
      const tx: any = {
        wallet: { upsert: jest.fn().mockResolvedValue({}), update: jest.fn() },
        walletTransaction: { create: jest.fn() },
      };

      await service.releaseEscrowToSeller(tx, 'seller1', 'deal1', 5000);

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'seller1' },
        data: { balance: { increment: 5000 } },
      });
      expect(tx.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: 'seller1',
          type: 'ESCROW_RELEASE',
          amount: 5000,
          dealId: 'deal1',
        },
      });
    });
  });

  describe('refundToBuyer', () => {
    it('should increment buyer balance and create refund transaction', async () => {
      const tx: any = {
        wallet: { upsert: jest.fn().mockResolvedValue({}), update: jest.fn() },
        walletTransaction: { create: jest.fn() },
      };

      await service.refundToBuyer(tx, 'buyer1', 'deal1', 3000);

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'buyer1' },
        data: { balance: { increment: 3000 } },
      });
      expect(tx.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: 'buyer1',
          type: 'REFUND',
          amount: 3000,
          dealId: 'deal1',
        },
      });
    });
  });
});
