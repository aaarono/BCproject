import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const startedAt = process.uptime();
    const now = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        timestamp: now,
        uptimeSeconds: Math.floor(startedAt),
        services: {
          database: 'up',
        },
      };
    } catch {
      return {
        ok: false,
        timestamp: now,
        uptimeSeconds: Math.floor(startedAt),
        services: {
          database: 'down',
        },
      };
    }
  }
}
