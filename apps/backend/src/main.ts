import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('HTTP');
  const appLogger = new Logger('Bootstrap');

  const uploadsRoot = join(process.cwd(), 'uploads');
  const avatarUploadsPath = join(uploadsRoot, 'avatars');
  const listingUploadsPath = join(uploadsRoot, 'listings');
  const messagesUploadsPath = join(uploadsRoot, 'messages');
  if (!existsSync(avatarUploadsPath)) {
    mkdirSync(avatarUploadsPath, { recursive: true });
  }
  if (!existsSync(listingUploadsPath)) {
    mkdirSync(listingUploadsPath, { recursive: true });
  }
  if (!existsSync(messagesUploadsPath)) {
    mkdirSync(messagesUploadsPath, { recursive: true });
  }

  app.use('/uploads', express.static(uploadsRoot));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();
    (req as Request & { requestId?: string }).requestId = requestId;

    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.log(
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(1)),
          ip: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        }),
      );
    });

    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance() as {
    disable?: (setting: string) => void;
  };
  if (typeof expressApp.disable === 'function') {
    expressApp.disable('x-powered-by');
  }

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Marketplace API')
    .setDescription('Marketplace with Escrow — REST API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3000);

  app.enableShutdownHooks();

  process.on('unhandledRejection', (reason) => {
    appLogger.error(`UnhandledRejection: ${String(reason)}`);
  });

  process.on('uncaughtException', (error) => {
    appLogger.error(`UncaughtException: ${error.message}`, error.stack);
  });

  await app.listen(port);

  appLogger.log(
    `Backend started on port ${port} (env=${process.env.NODE_ENV ?? 'development'})`,
  );
}

void bootstrap();
