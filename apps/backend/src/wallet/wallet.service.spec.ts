import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';

type WalletTxMock = {
  user: { findUnique: jest.Mock };
  wallet: { upsert: jest.Mock; update: jest.Mock };
  walletTransaction: { create: jest.Mock };
};

type WalletPrismaMock = {
  wallet: { upsert: jest.Mock; update: jest.Mock };
  walletTransaction: { create: jest.Mock };
  user: { findUnique: jest.Mock };
  deal: { aggregate: jest.Mock };
  $transaction: jest.Mock;
};

describe('WalletService', () => {
  let service: WalletService;
  let prisma: WalletPrismaMock;
  let tx: WalletTxMock;

  beforeEach(async () => {
    tx = {
      user: { findUnique: jest.fn() },
      wallet: { upsert: jest.fn(), update: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };

    prisma = {
      wallet: { upsert: jest.fn(), update: jest.fn() },
      walletTransaction: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      deal: { aggregate: jest.fn() },
      $transaction: jest.fn(
        async (cb: (txArg: WalletTxMock) => Promise<void>) => cb(tx),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: prisma as unknown as PrismaService,
        },
      ],
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
      tx.user.findUnique.mockResolvedValue({ paymentCardLast4: '4242' });
      tx.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 0 });
      tx.wallet.update.mockResolvedValue({});
      tx.walletTransaction.create.mockResolvedValue({});
      prisma.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 5000 });
      prisma.user.findUnique.mockResolvedValue({
        paymentCardLast4: '4242',
        paymentCardBrand: 'VISA',
        paymentCardLinkedAt: new Date(),
      });
      prisma.deal.aggregate.mockResolvedValue({
        _sum: { totalAmountSnapshot: 0 },
      });

      await service.topUpMock('u1', 5000);

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { balance: { increment: 5000 } },
      });
      expect(tx.walletTransaction.create).toHaveBeenCalledWith({
        data: { walletId: 'u1', userId: 'u1', type: 'TOPUP', amount: 5000 },
      });
    });

    it('should throw when payment card is not linked', async () => {
      tx.user.findUnique.mockResolvedValue({ paymentCardLast4: null });

      await expect(service.topUpMock('u1', 5000)).rejects.toThrow(
        ForbiddenException,
      );
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
    let txEscrow: WalletTxMock;

    beforeEach(() => {
      txEscrow = {
        wallet: { upsert: jest.fn(), update: jest.fn() },
        walletTransaction: { create: jest.fn() },
      };
    });

    it('should lock funds when balance is sufficient', async () => {
      txEscrow.wallet.upsert.mockResolvedValue({
        userId: 'u1',
        balance: 10000,
      });

      await service.lockEscrow(txEscrow, 'u1', 'deal1', 5000);

      expect(txEscrow.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { balance: { decrement: 5000 } },
      });
      expect(txEscrow.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: 'u1',
          userId: 'u1',
          type: 'ESCROW_LOCK',
          amount: -5000,
          dealId: 'deal1',
        },
      });
    });

    it('should throw ForbiddenException when balance is insufficient', async () => {
      txEscrow.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 1000 });

      await expect(
        service.lockEscrow(txEscrow, 'u1', 'deal1', 5000),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('withdraw', () => {
    it('should decrement wallet and create withdraw transaction', async () => {
      tx.user.findUnique.mockResolvedValue({ paymentCardLast4: '4242' });
      tx.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 10000 });
      tx.wallet.update.mockResolvedValue({});
      tx.walletTransaction.create.mockResolvedValue({});

      prisma.wallet.upsert.mockResolvedValue({ userId: 'u1', balance: 5000 });
      prisma.user.findUnique.mockResolvedValue({
        paymentCardLast4: '4242',
        paymentCardBrand: 'VISA',
        paymentCardLinkedAt: new Date(),
      });
      prisma.deal.aggregate.mockResolvedValue({
        _sum: { totalAmountSnapshot: 0 },
      });

      await service.withdraw('u1', 5000);

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { balance: { decrement: 5000 } },
      });
      expect(tx.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: 'u1',
          userId: 'u1',
          type: 'WITHDRAW',
          amount: -5000,
        },
      });
    });
  });

  describe('releaseEscrowToSeller', () => {
    it('should increment seller balance and create transaction', async () => {
      const tx: WalletTxMock = {
        user: { findUnique: jest.fn() },
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
          userId: 'seller1',
          type: 'ESCROW_RELEASE',
          amount: 5000,
          dealId: 'deal1',
        },
      });
    });
  });

  describe('refundToBuyer', () => {
    it('should increment buyer balance and create refund transaction', async () => {
      const tx: WalletTxMock = {
        user: { findUnique: jest.fn() },
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
          userId: 'buyer1',
          type: 'REFUND',
          amount: 3000,
          dealId: 'deal1',
        },
      });
    });
  });
});
