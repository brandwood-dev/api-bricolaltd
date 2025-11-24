import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Original webhook components
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { WiseWebhookController } from './wise-webhook.controller';
import { WiseWebhookService } from '../wallets/wise-webhook-enhanced.service';

// Enhanced secure webhook components
import { EnhancedStripeWebhookController } from './enhanced-stripe-webhook.controller';
import { EnhancedStripeWebhookService } from './enhanced-stripe-webhook.service';
import { StripeWebhookGuard } from './guards/stripe-webhook.guard';

// Security and utility services
import { WebhookEventService } from './services/webhook-event.service';
import { WebhookRetryService } from './services/webhook-retry.service';
import { WebhookRateLimitService } from './services/webhook-rate-limit.service';

// Entities
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';

// External services
import { WiseService } from '../wallets/wise.service';
import { PaymentModule } from '../payments/payment.module';
import { AdminModule } from '../admin/admin.module';
import { WalletsModule } from '../wallets/wallets.module';
import { WebhookCronService } from './webhook-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Booking, StripeWebhookEvent]),
    ConfigModule,
    ScheduleModule.forRoot(), // For cron jobs
    PaymentModule,
    AdminModule,
    WalletsModule,
  ],
  controllers: [
    StripeWebhookController,
    WiseWebhookController,
    EnhancedStripeWebhookController, // New secure controller
  ],
  providers: [
    // Original services
    StripeWebhookService,
    WiseWebhookService,
    WiseService,

    // Enhanced security services
    EnhancedStripeWebhookService,
    StripeWebhookGuard,
    WebhookEventService,
    WebhookRetryService,
    WebhookRateLimitService,

    // Cron services
    WebhookCronService,
  ],
  exports: [
    StripeWebhookService,
    WiseWebhookService,
    EnhancedStripeWebhookService,
    WebhookEventService,
    WebhookRetryService,
  ],
})
export class WebhookModule {}
