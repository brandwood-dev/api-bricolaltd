import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentMonitoringService } from './payment-monitoring.service';
import { PaymentAnalyticsController } from './payment-analytics.controller';
import { PaymentAlertingService } from './payment-alerting.service';
import { PaymentAlertingController } from './payment-alerting.controller';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { ThreeDSecureSession } from '../three-d-secure/entities/three-d-secure-session.entity';
import { AdminNotificationsService } from '../../admin/admin-notifications.service';
import { ThreeDSecureService } from '../three-d-secure/three-d-secure.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, ThreeDSecureSession]),
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [PaymentAnalyticsController, PaymentAlertingController],
  providers: [
    PaymentMonitoringService,
    PaymentAlertingService,
    ThreeDSecureService,
    AdminNotificationsService,
    ConfigService,
  ],
  exports: [PaymentMonitoringService, PaymentAlertingService],
})
export class PaymentMonitoringModule {}