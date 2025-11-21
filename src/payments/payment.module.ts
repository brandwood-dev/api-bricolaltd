import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ThreeDSecureModule } from './three-d-secure/three-d-secure.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Wallet]),
    ConfigModule,
    forwardRef(() => ThreeDSecureModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}