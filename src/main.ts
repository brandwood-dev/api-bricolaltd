import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN', '*').split(',').map(origin => origin.trim()),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Set global prefix
  app.setGlobalPrefix('api');
  
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

  // Add global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Remove API versioning to avoid duplicate v1/v1 paths
  // app.enableVersioning({
  //   type: VersioningType.URI,
  //   defaultVersion: '1',
  // });
  
  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Bricola API')
    .setDescription('Location d\'outils entre particuliers')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('tools', 'Tool rental management')
    .addTag('bookings', 'Booking management')
    .addTag('wallets', 'Wallet and payment management')
    .addTag('transactions', 'Transaction history')
    .addTag('reviews', 'User reviews')
    .addTag('disputes', 'Dispute resolution')
    .addTag('bookmarks', 'User bookmarks')
    .addTag('news', 'Platform news and announcements')
    .addTag('emails', 'Email notifications')
    .addTag('documents', 'User documents')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    })
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  // Start the server
  const port = configService.get('PORT', 4000);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
  
  // Apply security headers globally
  app.use(new SecurityHeadersMiddleware().use);
}
bootstrap();
