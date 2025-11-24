import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ExchangeRate } from './exchange-rate.entity';

@Entity('currencies')
export class Currency {
  @PrimaryColumn({ type: 'char', length: 3 })
  @ApiProperty({
    description: 'The ISO 4217 currency code',
    example: 'GBP',
    maxLength: 3,
  })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  @ApiProperty({
    description: 'The full name of the currency',
    example: 'British Pound Sterling',
  })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  @ApiProperty({
    description: 'The currency symbol',
    example: '£',
  })
  symbol: string;

  @Column({ type: 'boolean', default: false })
  @ApiProperty({
    description: 'Whether this is the default currency',
    default: false,
  })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  @ApiProperty({
    description: 'Whether this currency is active',
    default: true,
  })
  isActive: boolean;

  @OneToMany(() => ExchangeRate, (exchangeRate) => exchangeRate.fromCurrency)
  @ApiProperty({
    description: 'Exchange rates from this currency',
    type: () => [ExchangeRate],
  })
  exchangeRatesFrom: ExchangeRate[];

  @OneToMany(() => ExchangeRate, (exchangeRate) => exchangeRate.toCurrency)
  @ApiProperty({
    description: 'Exchange rates to this currency',
    type: () => [ExchangeRate],
  })
  exchangeRatesTo: ExchangeRate[];

  // @OneToMany(() => User, (user) => user.defaultCurrency)
  // @ApiProperty({
  //   description: 'Users who have this as their default currency',
  //   type: () => [User]
  // })
  // users: User[];

  @OneToMany('Tool', 'baseCurrency')
  @ApiProperty({
    description: 'Tools that use this as their base currency',
    type: () => 'Tool',
  })
  tools: any[];

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the currency was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the currency was last updated' })
  updatedAt: Date;
}
