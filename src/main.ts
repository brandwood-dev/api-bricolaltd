import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { Reflector } from '@nestjs/core';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Enable CORS
  app.enableCors({
    origin: configService
      .get('CORS_ORIGIN', '*')
      .split(',')
      .map((origin) => origin.trim()),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Set global prefix
  app.setGlobalPrefix('api');

  app.use('/api/webhooks/stripe', bodyParser.raw({ type: 'application/json' }));
  app.use(
    '/api/webhooks/stripe/enhanced',
    bodyParser.raw({ type: 'application/json' }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Add global interceptors: response wrapper only (avoid class serializer globally)
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Bricola API')
    .setDescription("Location d'outils entre particuliers")
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('tools', 'Tool rental management')
    .addTag('bookings', 'Booking management')
    .addTag('wallets', 'Wallet and payment management')
    .addTag('transactions', 'Transaction history')
    .addTag('reviews', 'User reviews')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('PORT', 4000);
  const adminUserId = configService.get('ADMIN_USER_ID');
  if (!adminUserId) {
    console.warn(
      '[Startup] ADMIN_USER_ID is not configured; admin commission will be skipped',
    );
  } else {
    console.log('[Startup] ADMIN_USER_ID loaded', { adminUserId });
  }
  const stripeWebhookSecret = configService.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeWebhookSecret) {
    console.warn('[Startup] STRIPE_WEBHOOK_SECRET is not configured');
  }
  await app.listen(port);
}

bootstrap();
