import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from './currency.entity';

@Entity('exchange_rates')
@Index(['fromCurrencyCode', 'toCurrencyCode'], { unique: true })
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the exchange rate' })
  id: string;

  @Column({ name: 'from_currency_code', type: 'char', length: 3 })
  @ApiProperty({ 
    description: 'The source currency code',
    example: 'GBP'
  })
  fromCurrencyCode: string;

  @Column({ name: 'to_currency_code', type: 'char', length: 3 })
  @ApiProperty({ 
    description: 'The target currency code',
    example: 'KWD'
  })
  toCurrencyCode: string;

  @Column({ type: 'decimal', precision: 15, scale: 8 })
  @ApiProperty({ 
    description: 'The exchange rate from source to target currency',
    example: 0.37500000
  })
  rate: number;

  @Column({ name: 'last_updated', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({ 
    description: 'When this exchange rate was last updated',
    example: '2024-01-15T10:30:00Z'
  })
  lastUpdated: Date;

  @Column({ type: 'boolean', default: true })
  @ApiProperty({ 
    description: 'Whether this exchange rate is active',
    default: true
  })
  isActive: boolean;

  @ManyToOne(() => Currency, (currency) => currency.exchangeRatesFrom, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'from_currency_code', referencedColumnName: 'code' })
  @ApiProperty({ 
    description: 'The source currency',
    type: () => Currency
  })
  fromCurrency: Currency;

  @ManyToOne(() => Currency, (currency) => currency.exchangeRatesTo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'to_currency_code', referencedColumnName: 'code' })
  @ApiProperty({ 
    description: 'The target currency',
    type: () => Currency
  })
  toCurrency: Currency;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the exchange rate was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the exchange rate was last updated' })
  updatedAt: Date;
}