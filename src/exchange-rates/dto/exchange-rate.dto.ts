import { IsString, IsNumber, IsOptional } from 'class-validator';

export class GetExchangeRateDto {
  @IsString()
  from: string;

  @IsString()
  to: string;
}

export class GetBulkExchangeRatesDto {
  @IsString()
  base: string;
}

export class ConvertCurrencyDto {
  @IsNumber()
  amount: number;

  @IsString()
  from: string;

  @IsString()
  to: string;
}

export class ExchangeRateResponseDto {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: string;
}

export class BulkExchangeRateResponseDto {
  baseCurrency: string;
  rates: Record<string, number>;
  lastUpdated: string;
}

export class ConvertedPriceResponseDto {
  originalAmount: number;
  convertedAmount: number;
  rate: number;
  fromCurrency: string;
  toCurrency: string;
}