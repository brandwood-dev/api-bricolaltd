import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRate } from '../users/entities/exchange-rate.entity';
import { Currency } from '../users/entities/currency.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate, Currency])],
  controllers: [ExchangeRateController],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRatesModule {}
