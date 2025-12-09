import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';

import { Refund } from './entities/refund.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Wallet } from '../wallets/entities/wallet.entity';

import { WalletsModule } from '../wallets/wallets.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refund, Transaction, Booking, Wallet]),
    ConfigModule,
    forwardRef(() => WalletsModule),
    forwardRef(() => AdminModule),
  ],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
