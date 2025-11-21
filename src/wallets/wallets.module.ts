import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WithdrawalProcessingService } from './withdrawal-processing.service';
import { WiseService } from './wise-enhanced.service';
import { WiseWebhookService } from './wise-webhook-enhanced.service';
import { WiseController } from './wise-enhanced.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transaction]), forwardRef(() => AdminModule)],
  controllers: [WalletsController, WiseController],
  providers: [WalletsService, WithdrawalProcessingService, WiseService, WiseWebhookService],
  exports: [WalletsService, WithdrawalProcessingService, WiseService, WiseWebhookService],
})
export class WalletsModule {}