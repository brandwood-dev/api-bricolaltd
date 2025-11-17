import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { WiseWebhookController } from './wise-webhook.controller';
import { WiseWebhookService } from './wise-webhook.service';
import { WiseService } from '../wallets/wise.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PaymentModule } from '../payments/payment.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Booking]),
    ConfigModule,
    PaymentModule,
    AdminModule,
  ],
  controllers: [StripeWebhookController, WiseWebhookController],
  providers: [StripeWebhookService, WiseWebhookService, WiseService],
  exports: [StripeWebhookService, WiseWebhookService],
})
export class WebhookModule {}