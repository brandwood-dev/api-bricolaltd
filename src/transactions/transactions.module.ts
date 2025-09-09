import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { PaymentProvider } from './entities/payment-provider.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentProviderController } from './payment-provider.controller';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentTransactionController } from './payment-transaction.controller';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, PaymentProvider, PaymentTransaction]),
    WalletsModule,
  ],
  controllers: [
    TransactionsController,
    PaymentProviderController,
    PaymentTransactionController,
  ],
  providers: [
    TransactionsService,
    PaymentProviderService,
    PaymentTransactionService,
  ],
  exports: [
    TransactionsService,
    PaymentProviderService,
    PaymentTransactionService,
  ],
})
export class TransactionsModule {}