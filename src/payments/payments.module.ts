import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ThreeDSecureModule } from './three-d-secure/three-d-secure.module';
import { ThreeDSecureService } from './three-d-secure/three-d-secure.service';
import { ThreeDSecureSession } from './three-d-secure/entities/three-d-secure-session.entity';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Wallet, ThreeDSecureSession]),
    ThreeDSecureModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    ThreeDSecureService,
    AdminNotificationsService,
    ConfigService,
  ],
  exports: [PaymentService, ThreeDSecureService],
})
export class PaymentsModule {}