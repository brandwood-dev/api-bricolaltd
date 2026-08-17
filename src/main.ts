import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { Reflector } from '@nestjs/core';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  const corsOriginRaw = String(configService.get('CORS_ORIGIN', '*'));
  const staticOrigins = corsOriginRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAnyOrigin =
    staticOrigins.length === 0 ||
    staticOrigins.includes('*');

  const normalizeOriginForCompare = (value: string | undefined): string =>
    (value || '').toLowerCase().replace(/\/+$/, '');

  const isBricolaOrigin = (origin: string | undefined): boolean => {
    if (!origin) return false;
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      return (
        host === 'bricolaltd.com' ||
        host.endsWith('.bricolaltd.com') ||
        host === 'localhost' ||
        host.endsWith('.localhost')
      );
    } catch {
      return hostAllowListFallback(origin);
    }
  };

  const hostAllowListFallback = (origin: string): boolean => {
    const lower = (origin || '').toLowerCase();
    return (
      lower.includes('bricolaltd.com') ||
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      lower.startsWith('exp://') ||
      lower.startsWith('http://localhost') ||
      lower.startsWith('http://127.0.0.1') ||
      lower.startsWith('capacitor://') ||
      lower.startsWith('ionic://')
    );
  };

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (allowAnyOrigin) {
        return callback(null, true);
      }

      const normalizedRequest = normalizeOriginForCompare(requestOrigin);
      if (!requestOrigin) {
        // requests without origin (server-to-server, curl, mobile native)
        return callback(null, true);
      }

      const inStaticList = staticOrigins.some(
        (o) => normalizeOriginForCompare(o) === normalizedRequest,
      );
      const matchesBricola = isBricolaOrigin(requestOrigin);

      if (inStaticList || matchesBricola) {
        return callback(null, requestOrigin);
      }

      console.warn('[CORS] blocked origin', {
        origin: requestOrigin,
        staticOrigins,
      });
      return callback(new Error(`Origin not allowed: ${requestOrigin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,Accept',
    preflightContinue: false,
    optionsSuccessStatus: 204,
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
