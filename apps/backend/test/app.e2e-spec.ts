import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Marketplace API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: any;

  // Mock data
  const mockUser = {
    id: 'user1',
    email: 'test@test.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv', // bcrypt hash placeholder
    displayName: 'Test User',
    role: 'BUYER',
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: new Date(),
  };

  const mockSeller = {
    id: 'seller1',
    email: 'seller@test.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    displayName: 'Seller',
    role: 'SELLER',
    ratingAvg: 4.5,
    ratingCount: 10,
    createdAt: new Date(),
  };

  const mockListing = {
    id: 'listing1',
    sellerId: 'seller1',
    title: 'Test Item',
    description: 'Test description',
    price: 5000,
    type: 'GOOD',
    status: 'ACTIVE',
    createdAt: new Date(),
    seller: {
      id: 'seller1',
      displayName: 'Seller',
      ratingAvg: 4.5,
      ratingCount: 10,
    },
  };

  const mockWallet = { userId: 'user1', balance: 10000 };

  const mockDeal = {
    id: 'deal1',
    listingId: 'listing1',
    buyerId: 'user1',
    sellerId: 'seller1',
    status: 'FUNDED',
    createdAt: new Date(),
    listing: {
      id: 'listing1',
      title: 'Test Item',
      price: 5000,
      type: 'GOOD',
      status: 'ACTIVE',
    },
    buyer: { id: 'user1', displayName: 'Test User' },
    seller: { id: 'seller1', displayName: 'Seller' },
  };

  beforeAll(async () => {
    // Create mock PrismaService
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      listingPriceHistory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      wallet: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      deal: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      review: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('GET /health - should return structured status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        services: {
          database: 'up',
        },
      });

      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.uptimeSeconds).toBe('number');
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('GET /health - should report db down when query fails', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('db down'));

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: false,
        services: {
          database: 'down',
        },
      });
    });
  });

  describe('Auth Flow', () => {
    it('POST /auth/register - should register new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@test.com',
          password: '123456',
          displayName: 'Test User',
        })
        .expect(201);

      expect(response.body.emailVerificationRequired).toBe(true);
      expect(response.body.user.email).toBe('test@test.com');
    });

    it('POST /auth/register - should reject duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@test.com',
          password: '123456',
          displayName: 'Test',
        })
        .expect(400);
    });

    it('POST /auth/register - should validate input', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid', password: '123' })
        .expect(400);
    });

    it('POST /auth/login - should reject invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrong@test.com', password: '123456' })
        .expect(401);
    });
  });

  describe('Listings', () => {
    it('GET /listings - should return paginated listings', async () => {
      prisma.listing.findMany.mockResolvedValue([mockListing]);
      prisma.listing.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta.total).toBe(1);
    });

    it('GET /listings?search=test - should filter by search', async () => {
      prisma.listing.findMany.mockResolvedValue([mockListing]);
      prisma.listing.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/listings?search=test')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('GET /listings/:id - should return single listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);

      const response = await request(app.getHttpServer())
        .get('/listings/listing1')
        .expect(200);

      expect(response.body.id).toBe('listing1');
    });

    it('GET /listings/:id - should return 404 for non-existent', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/listings/nonexistent')
        .expect(404);
    });
  });

  describe('Protected Routes', () => {
    it('GET /deals/me - should require authentication', () => {
      return request(app.getHttpServer()).get('/deals/me').expect(401);
    });

    it('POST /listings - should require authentication', () => {
      return request(app.getHttpServer())
        .post('/listings')
        .send({ title: 'Test', description: 'Desc', price: 1000, type: 'GOOD' })
        .expect(401);
    });

    it('GET /wallet/me - should require authentication', () => {
      return request(app.getHttpServer()).get('/wallet/me').expect(401);
    });

    it('POST /conversations - should require authentication', () => {
      return request(app.getHttpServer())
        .post('/conversations')
        .send({ listingId: 'listing1' })
        .expect(401);
    });
  });

  describe('Reviews (Public)', () => {
    it('GET /reviews/seller/:sellerId - should return seller reviews', async () => {
      prisma.review.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/reviews/seller/seller1')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Validation', () => {
    it('POST /auth/register - should reject short password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@test.com', password: '123', displayName: 'Test' })
        .expect(400);
    });

    it('POST /auth/register - should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'notanemail', password: '123456', displayName: 'Test' })
        .expect(400);
    });

    it('POST /auth/register - should reject extra fields', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@test.com',
          password: '123456',
          displayName: 'Test',
          isAdmin: true,
        })
        .expect(400);
    });
  });
});
