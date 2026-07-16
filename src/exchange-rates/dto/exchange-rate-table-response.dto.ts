import { ApiProperty } from '@nestjs/swagger';

export class ExchangeRateTableDataDto {
  @ApiProperty({
    description: 'Base currency used to build the exchange rate table',
    example: 'GBP',
  })
  baseCurrency: string;

  @ApiProperty({
    description:
      'Exchange rates keyed by allowed target currency code for the selected base currency',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: {
      GBP: 1,
      KWD: 0.39,
      SAR: 4.79,
      BHD: 0.48,
      OMR: 0.49,
      QAR: 4.71,
      AED: 4.7,
    },
  })
  rates: Record<string, number>;

  @ApiProperty({
    description: 'Timestamp of the underlying rate snapshot',
    example: '2026-07-13T10:00:00.000Z',
  })
  fetchedAt: string;

  @ApiProperty({
    description: 'Timestamp until which the table is considered fresh',
    example: '2026-07-13T16:00:00.000Z',
  })
  freshUntil: string;

  @ApiProperty({
    description:
      'Timestamp until which stale data may still be served while refresh happens in background',
    example: '2026-07-14T10:00:00.000Z',
  })
  staleUntil: string;

  @ApiProperty({
    description: 'Whether the response is being served from stale data',
    example: false,
  })
  stale: boolean;

  @ApiProperty({
    description: 'Source used to build the table',
    example: 'provider',
  })
  source: 'provider' | 'database' | 'hardcoded';
}

export class ExchangeRateTableResponseDto {
  @ApiProperty({
    description: 'Full exchange rate table payload',
    type: ExchangeRateTableDataDto,
  })
  data: ExchangeRateTableDataDto;

  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Exchange rate table retrieved successfully',
  })
  message: string;
}
