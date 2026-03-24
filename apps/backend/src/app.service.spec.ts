import { AppService } from './app.service';

describe('AppService', () => {
  it('returns healthy status when database query succeeds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any;

    const service = new AppService(prisma);
    const health = await service.getHealth();

    expect(health.ok).toBe(true);
    expect(health.services.database).toBe('up');
    expect(typeof health.timestamp).toBe('string');
    expect(typeof health.uptimeSeconds).toBe('number');
  });

  it('returns degraded status when database query fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    } as any;

    const service = new AppService(prisma);
    const health = await service.getHealth();

    expect(health.ok).toBe(false);
    expect(health.services.database).toBe('down');
  });
});
