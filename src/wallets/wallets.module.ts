import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WithdrawalProcessingService } from './withdrawal-processing.service';
import { WiseService } from './wise.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transaction]), forwardRef(() => AdminModule)],
  controllers: [WalletsController],
  providers: [WalletsService, WithdrawalProcessingService, WiseService],
  exports: [WalletsService, WithdrawalProcessingService, WiseService],
})
export class WalletsModule {}