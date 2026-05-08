import { AppService } from './app.service';

type PrismaHealthMock = {
  $queryRaw: jest.Mock;
};

describe('AppService', () => {
  it('returns healthy status when database query succeeds', async () => {
    const prisma: PrismaHealthMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const service = new AppService(prisma as never);
    const health = await service.getHealth();

    expect(health.ok).toBe(true);
    expect(health.services.database).toBe('up');
    expect(typeof health.timestamp).toBe('string');
    expect(typeof health.uptimeSeconds).toBe('number');
  });

  it('returns degraded status when database query fails', async () => {
    const prisma: PrismaHealthMock = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    };

    const service = new AppService(prisma as never);
    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.services.database).toBe('down');
  });
});
