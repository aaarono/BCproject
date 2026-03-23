import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const uploadsRoot = join(process.cwd(), 'uploads');
  const avatarUploadsPath = join(uploadsRoot, 'avatars');
  if (!existsSync(avatarUploadsPath)) {
    mkdirSync(avatarUploadsPath, { recursive: true });
  }

  app.use('/uploads', express.static(uploadsRoot));

  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
