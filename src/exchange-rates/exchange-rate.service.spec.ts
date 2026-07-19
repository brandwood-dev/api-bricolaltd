import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { ExchangeRateService } from './exchange-rate.service';

jest.mock('axios');

type MockRepository<T = any> = {
  find: jest.Mock<Promise<T[]>, any[]>;
  findOne: jest.Mock<Promise<T | null>, any[]>;
  save: jest.Mock<Promise<T>, any[]>;
  create: jest.Mock<T, any[]>;
};

const SUPPORTED_CURRENCIES = [
  'GBP',
  'KWD',
  'SAR',
  'BHD',
  'OMR',
  'QAR',
  'AED',
] as const;

const createRepositoryMock = <T = any>(): MockRepository<T> => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation(async (entity: T) => entity),
  create: jest.fn().mockImplementation((entity: T) => entity),
});

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let exchangeRateRepository: MockRepository;
  let currencyRepository: MockRepository;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    delete process.env.EXCHANGE_RATE_API_KEY;

    exchangeRateRepository = createRepositoryMock();
    currencyRepository = createRepositoryMock();
    currencyRepository.find.mockResolvedValue(
      SUPPORTED_CURRENCIES.map((code) => ({ code, isActive: true })),
    );

    mockedAxios.get.mockReset();
    service = new ExchangeRateService(
      exchangeRateRepository as any,
      currencyRepository as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each(SUPPORTED_CURRENCIES)(
    'returns a complete hardcoded table for base %s when provider is unavailable',
    async (baseCurrency) => {
      const table = await service.getExchangeRateTable(baseCurrency);

      expect(table.baseCurrency).toBe(baseCurrency);
      expect(table.source).toBe('hardcoded');
      expect(table.rates[baseCurrency]).toBe(1);

      for (const currency of SUPPORTED_CURRENCIES) {
        expect(table.rates[currency]).toEqual(expect.any(Number));
        expect(table.rates[currency]).toBeGreaterThan(0);
      }
    },
  );

  it.each(
    SUPPORTED_CURRENCIES.flatMap((fromCurrency) =>
      SUPPORTED_CURRENCIES
        .filter((toCurrency) => toCurrency !== fromCurrency)
        .map((toCurrency) => [fromCurrency, toCurrency] as const),
    ),
  )(
    'returns a valid pair rate for %s -> %s',
    async (fromCurrency, toCurrency) => {
      const result = await service.getExchangeRateFromTable(
        fromCurrency,
        toCurrency,
      );

      expect(result.fromCurrency).toBe(fromCurrency);
      expect(result.toCurrency).toBe(toCurrency);
      expect(result.rate).toBeGreaterThan(0);
    },
  );

  it.each(
    SUPPORTED_CURRENCIES.map((baseCurrency) => [baseCurrency] as const),
  )('returns bulk rates for base %s', async (baseCurrency) => {
    const result = await service.getBulkExchangeRatesFromTable(baseCurrency);

    expect(result.baseCurrency).toBe(baseCurrency);
    expect(result.lastUpdated).toBeInstanceOf(Date);

    for (const currency of SUPPORTED_CURRENCIES) {
      expect(result.rates[currency]).toEqual(expect.any(Number));
      expect(result.rates[currency]).toBeGreaterThan(0);
    }
  });

  it('converts between supported currencies using the table path', async () => {
    const result = await service.convertCurrencyFromTable(100, 'GBP', 'KWD');

    expect(result.originalAmount).toBe(100);
    expect(result.rate).toBeGreaterThan(0);
    expect(result.convertedAmount).toBeCloseTo(37.5, 2);
  });

  it('rejects unsupported base currencies', async () => {
    await expect(service.getExchangeRateTable('USD')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('filters provider tables down to supported currencies only', async () => {
    process.env.EXCHANGE_RATE_API_KEY = 'test-key';
    service = new ExchangeRateService(
      exchangeRateRepository as any,
      currencyRepository as any,
    );

    mockedAxios.get.mockResolvedValue({
      data: {
        result: 'success',
        conversion_rates: {
          GBP: 1,
          KWD: 0.375,
          SAR: 4.58,
          BHD: 0.46,
          OMR: 0.47,
          QAR: 4.45,
          AED: 4.49,
          USD: 1.29,
          EUR: 1.17,
        },
        time_last_update_utc: 'Sat, 18 Jul 2026 00:00:00 +0000',
      },
    } as any);

    const table = await service.getExchangeRateTable('GBP');

    expect(table.source).toBe('provider');
    expect(Object.keys(table.rates).sort()).toEqual(
      [...SUPPORTED_CURRENCIES].sort(),
    );
    expect(table.rates).not.toHaveProperty('USD');
    expect(table.rates).not.toHaveProperty('EUR');
  });
});
