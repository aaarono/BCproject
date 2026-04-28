import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import { join } from 'path';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('HTTP');

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

  app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();
    (req as express.Request & { requestId?: string }).requestId = requestId;

    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms requestId=${requestId}`,
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

  const expressApp = app.getHttpAdapter().getInstance();
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
  await app.listen(port);
}

void bootstrap();
