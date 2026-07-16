import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  ExchangeRateService,
  ExchangeRateResponse,
  BulkExchangeRateResponse,
  ExchangeRateTableResponse,
} from './exchange-rate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExchangeRateTableResponseDto } from './dto/exchange-rate-table-response.dto';

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
export class ExchangeRateController {
  private readonly logger = new Logger(ExchangeRateController.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  @ApiOperation({ summary: 'Get exchange rate between two currencies' })
  @ApiQuery({
    name: 'from',
    description: 'Source currency code',
    example: 'GBP',
  })
  @ApiQuery({ name: 'to', description: 'Target currency code', example: 'KWD' })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            fromCurrency: { type: 'string', example: 'GBP' },
            toCurrency: { type: 'string', example: 'KWD' },
            rate: { type: 'number', example: 0.375 },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        message: {
          type: 'string',
          example: 'Exchange rate retrieved successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid currency codes provided',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch exchange rate',
  })
  async getExchangeRate(
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
  ): Promise<{ data: ExchangeRateResponse; message: string }> {
    this.logger.log(
      `GET /exchange-rates?from=${fromCurrency}&to=${toCurrency}`,
    );

    if (!fromCurrency || !toCurrency) {
      throw new HttpException(
        'Both from and to currency codes are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (fromCurrency.length !== 3 || toCurrency.length !== 3) {
      throw new HttpException(
        'Currency codes must be 3 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }

    const exchangeRate = await this.exchangeRateService.getExchangeRateFromTable(
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase(),
    );

    return {
      data: exchangeRate,
      message: 'Exchange rate retrieved successfully',
    };
  }

  @Get('table')
  @ApiOperation({ summary: 'Get full exchange rate table for one base currency' })
  @ApiQuery({
    name: 'base',
    description: 'Base currency code',
    example: 'GBP',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate table retrieved successfully',
    type: ExchangeRateTableResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or unsupported base currency code provided',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch exchange rate table',
  })
  async getExchangeRateTable(
    @Query('base') baseCurrency: string,
  ): Promise<{ data: ExchangeRateTableResponse; message: string }> {
    this.logger.log(`GET /exchange-rates/table?base=${baseCurrency}`);

    if (!baseCurrency) {
      throw new HttpException(
        'Base currency code is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (baseCurrency.length !== 3) {
      throw new HttpException(
        'Currency code must be 3 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }

    const table = await this.exchangeRateService.getExchangeRateTable(
      baseCurrency.toUpperCase(),
    );

    return {
      data: table,
      message: 'Exchange rate table retrieved successfully',
    };
  }

  @Get('bulk')
  @ApiOperation({ summary: 'Get bulk exchange rates for a base currency' })
  @ApiQuery({ name: 'base', description: 'Base currency code', example: 'GBP' })
  @ApiResponse({
    status: 200,
    description: 'Bulk exchange rates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            baseCurrency: { type: 'string', example: 'GBP' },
            rates: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: {
                KWD: 0.375,
                SAR: 4.58,
                BHD: 0.46,
                OMR: 0.47,
                QAR: 4.45,
                AED: 4.49,
              },
            },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        message: {
          type: 'string',
          example: 'Bulk exchange rates retrieved successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid base currency code provided',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch bulk exchange rates',
  })
  async getBulkExchangeRates(
    @Query('base') baseCurrency: string,
  ): Promise<{ data: BulkExchangeRateResponse; message: string }> {
    this.logger.log(`GET /exchange-rates/bulk?base=${baseCurrency}`);

    if (!baseCurrency) {
      throw new HttpException(
        'Base currency code is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (baseCurrency.length !== 3) {
      throw new HttpException(
        'Currency code must be 3 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }

    const bulkRates =
      await this.exchangeRateService.getBulkExchangeRatesFromTable(
        baseCurrency.toUpperCase(),
      );

    return {
      data: bulkRates,
      message: 'Bulk exchange rates retrieved successfully',
    };
  }

  @Get('convert')
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiQuery({ name: 'amount', description: 'Amount to convert', example: 100 })
  @ApiQuery({
    name: 'from',
    description: 'Source currency code',
    example: 'GBP',
  })
  @ApiQuery({ name: 'to', description: 'Target currency code', example: 'KWD' })
  @ApiResponse({
    status: 200,
    description: 'Currency conversion completed successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            originalAmount: { type: 'number', example: 100 },
            convertedAmount: { type: 'number', example: 37.5 },
            rate: { type: 'number', example: 0.375 },
            fromCurrency: { type: 'string', example: 'GBP' },
            toCurrency: { type: 'string', example: 'KWD' },
          },
        },
        message: {
          type: 'string',
          example: 'Currency conversion completed successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters provided',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to convert currency',
  })
  async convertCurrency(
    @Query('amount') amount: string,
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
  ): Promise<{
    data: {
      originalAmount: number;
      convertedAmount: number;
      rate: number;
      fromCurrency: string;
      toCurrency: string;
    };
    message: string;
  }> {
    if (!amount || !fromCurrency || !toCurrency) {
      throw new HttpException(
        'Amount, from currency, and to currency are all required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new HttpException(
        'Amount must be a positive number',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (fromCurrency.length !== 3 || toCurrency.length !== 3) {
      throw new HttpException(
        'Currency codes must be 3 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }

    const conversion = await this.exchangeRateService.convertCurrencyFromTable(
      numericAmount,
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase(),
    );

    return {
      data: {
        ...conversion,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
      },
      message: 'Currency conversion completed successfully',
    };
  }

  @Get('cache/stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get cache statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            size: { type: 'number', example: 42 },
            keys: { type: 'array', items: { type: 'string' } },
            pairCacheKeys: { type: 'array', items: { type: 'string' } },
            tableCacheKeys: { type: 'array', items: { type: 'string' } },
            metrics: {
              type: 'object',
              properties: {
                pairCacheHits: { type: 'number', example: 10 },
                pairCacheMisses: { type: 'number', example: 4 },
                tableCacheFreshHits: { type: 'number', example: 24 },
                tableCacheStaleHits: { type: 'number', example: 2 },
                tableCacheMisses: { type: 'number', example: 3 },
                providerCallsTotal: { type: 'number', example: 7 },
                providerCallsByBase: {
                  type: 'object',
                  additionalProperties: { type: 'number' },
                  example: { GBP: 3, AED: 2, SAR: 2 },
                },
              },
            },
          },
        },
        message: {
          type: 'string',
          example: 'Cache statistics retrieved successfully',
        },
      },
    },
  })
  async getCacheStats(): Promise<{
    data: {
      size: number;
      keys: string[];
      pairCacheKeys: string[];
      tableCacheKeys: string[];
      metrics: {
        pairCacheHits: number;
        pairCacheMisses: number;
        tableCacheFreshHits: number;
        tableCacheStaleHits: number;
        tableCacheMisses: number;
        providerCallsTotal: number;
        providerCallsByBase: Record<string, number>;
      };
    };
    message: string;
  }> {
    const stats = this.exchangeRateService.getCacheStats();
    return {
      data: stats,
      message: 'Cache statistics retrieved successfully',
    };
  }

  @Get('cache/clear')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Clear exchange rate cache (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object', example: {} },
        message: { type: 'string', example: 'Cache cleared successfully' },
      },
    },
  })
  async clearCache(): Promise<{ data: {}; message: string }> {
    this.exchangeRateService.clearCache();
    return {
      data: {},
      message: 'Cache cleared successfully',
    };
  }
}
