import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ExchangeRate } from '../users/entities/exchange-rate.entity';
import { Currency } from '../users/entities/currency.entity';
import axios from 'axios';

export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: Date;
}

export interface BulkExchangeRateResponse {
  baseCurrency: string;
  rates: Record<string, number>;
  lastUpdated: Date;
}

export interface ExchangeRateTableResponse {
  baseCurrency: string;
  rates: Record<string, number>;
  fetchedAt: string;
  freshUntil: string;
  staleUntil: string;
  stale: boolean;
  source: 'provider' | 'database' | 'hardcoded';
}

interface ExchangeRateTableCacheEntry {
  baseCurrency: string;
  rates: Record<string, number>;
  fetchedAt: number;
  freshUntil: number;
  staleUntil: number;
  source: 'provider' | 'database' | 'hardcoded';
}

interface ExchangeRateObservabilityStats {
  pairCacheHits: number;
  pairCacheMisses: number;
  tableCacheFreshHits: number;
  tableCacheStaleHits: number;
  tableCacheMisses: number;
  providerCallsTotal: number;
  providerCallsByBase: Record<string, number>;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  private readonly TABLE_FRESH_DURATION = 6 * 60 * 60 * 1000;
  private readonly TABLE_STALE_DURATION = 24 * 60 * 60 * 1000;
  private readonly API_BASE_URL = 'https://v6.exchangerate-api.com/v6';
  private readonly API_KEY = process.env.EXCHANGE_RATE_API_KEY;
  private readonly SUPPORTED_CURRENCIES = [
    'GBP',
    'KWD',
    'SAR',
    'BHD',
    'OMR',
    'QAR',
    'AED',
  ] as const;

  private rateCache = new Map<string, { rate: number; timestamp: number }>();
  private exchangeRateTableCache = new Map<
    string,
    ExchangeRateTableCacheEntry
  >();
  private inFlightTableFetches = new Map<
    string,
    Promise<ExchangeRateTableResponse>
  >();
  private observabilityStats: ExchangeRateObservabilityStats = {
    pairCacheHits: 0,
    pairCacheMisses: 0,
    tableCacheFreshHits: 0,
    tableCacheStaleHits: 0,
    tableCacheMisses: 0,
    providerCallsTotal: 0,
    providerCallsByBase: {},
  };

  constructor(
    @InjectRepository(ExchangeRate)
    private exchangeRateRepository: Repository<ExchangeRate>,
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
  ) {
    this.logger.log('ExchangeRateService initialized');
    this.logger.log(`Cache duration: ${this.CACHE_DURATION}ms`);
    this.logger.log(`Provider URL configured: ${this.API_BASE_URL}`);
    this.logger.log(`API key configured: ${this.API_KEY ? 'Yes' : 'No'}`);

    if (!this.API_KEY) {
      this.logger.warn('EXCHANGE_RATE_API_KEY not found in environment');
    }
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ExchangeRateResponse> {
    try {
      if (fromCurrency === toCurrency) {
        return {
          fromCurrency,
          toCurrency,
          rate: 1,
          lastUpdated: new Date(),
        };
      }

      const cacheKey = `${fromCurrency}_${toCurrency}`;
      const cached = this.rateCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        this.observabilityStats.pairCacheHits++;
        return {
          fromCurrency,
          toCurrency,
          rate: cached.rate,
          lastUpdated: new Date(cached.timestamp),
        };
      }

      this.observabilityStats.pairCacheMisses++;

      const rate = await this.fetchExchangeRateFromAPI(
        fromCurrency,
        toCurrency,
      );

      this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });

      return {
        fromCurrency,
        toCurrency,
        rate,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get exchange rate ${fromCurrency} -> ${toCurrency}`,
        error.message,
      );

      try {
        const dbRate = await this.exchangeRateRepository.findOne({
          where: { fromCurrencyCode: fromCurrency, toCurrencyCode: toCurrency },
          order: { lastUpdated: 'DESC' },
        });

        if (dbRate) {
          return {
            fromCurrency,
            toCurrency,
            rate: dbRate.rate,
            lastUpdated: dbRate.lastUpdated,
          };
        }
      } catch (dbError) {
        this.logger.error('Database fallback failed', dbError.message);
      }

      throw new HttpException(
        `Failed to get exchange rate for ${fromCurrency} to ${toCurrency}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getBulkExchangeRates(
    baseCurrency: string,
  ): Promise<BulkExchangeRateResponse> {
    try {
      const currencies = await this.currencyRepository.find({
        where: { isActive: true },
      });

      const rates: Record<string, number> = {};
      let lastUpdated = new Date();

      for (const currency of currencies) {
        if (currency.code !== baseCurrency) {
          const exchangeRate = await this.getExchangeRate(
            baseCurrency,
            currency.code,
          );
          rates[currency.code] = exchangeRate.rate;

          if (exchangeRate.lastUpdated < lastUpdated) {
            lastUpdated = exchangeRate.lastUpdated;
          }
        } else {
          rates[currency.code] = 1;
        }
      }

      return {
        baseCurrency,
        rates,
        lastUpdated,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch bulk exchange rates for ${baseCurrency}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getExchangeRateTable(
    baseCurrency: string,
  ): Promise<ExchangeRateTableResponse> {
    const normalizedBaseCurrency = baseCurrency.toUpperCase();
    const cacheKey = this.getExchangeRateTableCacheKey(normalizedBaseCurrency);

    if (!this.isSupportedCurrency(normalizedBaseCurrency)) {
      throw new HttpException(
        `Unsupported base currency: ${normalizedBaseCurrency}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const cachedTable = this.getCachedExchangeRateTable(cacheKey);
    if (cachedTable?.state === 'fresh') {
      return this.mapCacheEntryToResponse(cachedTable.entry, false);
    }

    if (cachedTable?.state === 'stale') {
      this.refreshExchangeRateTableInBackground(normalizedBaseCurrency);
      return this.mapCacheEntryToResponse(cachedTable.entry, true);
    }

    return this.fetchAndCacheExchangeRateTable(normalizedBaseCurrency);
  }

  async getExchangeRateFromTable(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ExchangeRateResponse> {
    const normalizedFromCurrency = fromCurrency.toUpperCase();
    const normalizedToCurrency = toCurrency.toUpperCase();

    if (
      !this.isSupportedCurrency(normalizedFromCurrency) ||
      !this.isSupportedCurrency(normalizedToCurrency)
    ) {
      throw new HttpException(
        `Unsupported currency pair: ${normalizedFromCurrency} to ${normalizedToCurrency}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (normalizedFromCurrency === normalizedToCurrency) {
      return {
        fromCurrency: normalizedFromCurrency,
        toCurrency: normalizedToCurrency,
        rate: 1,
        lastUpdated: new Date(),
      };
    }

    const exchangeRateTable = await this.getExchangeRateTable(
      normalizedFromCurrency,
    );
    const rate = exchangeRateTable.rates[normalizedToCurrency];

    if (typeof rate !== 'number') {
      throw new HttpException(
        `Exchange rate not found for ${normalizedFromCurrency} to ${normalizedToCurrency}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const lastUpdated = new Date(exchangeRateTable.fetchedAt);
    this.rateCache.set(`${normalizedFromCurrency}_${normalizedToCurrency}`, {
      rate,
      timestamp: lastUpdated.getTime(),
    });

    return {
      fromCurrency: normalizedFromCurrency,
      toCurrency: normalizedToCurrency,
      rate,
      lastUpdated,
    };
  }

  async getBulkExchangeRatesFromTable(
    baseCurrency: string,
  ): Promise<BulkExchangeRateResponse> {
    const normalizedBaseCurrency = baseCurrency.toUpperCase();
    const exchangeRateTable = await this.getExchangeRateTable(
      normalizedBaseCurrency,
    );

    return {
      baseCurrency: exchangeRateTable.baseCurrency,
      rates: exchangeRateTable.rates,
      lastUpdated: new Date(exchangeRateTable.fetchedAt),
    };
  }

  async convertCurrencyFromTable(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{
    convertedAmount: number;
    rate: number;
    originalAmount: number;
  }> {
    const exchangeRate = await this.getExchangeRateFromTable(
      fromCurrency,
      toCurrency,
    );
    const convertedAmount = amount * exchangeRate.rate;

    return {
      originalAmount: amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      rate: exchangeRate.rate,
    };
  }

  private async fetchAndCacheExchangeRateTable(
    baseCurrency: string,
  ): Promise<ExchangeRateTableResponse> {
    const cacheKey = this.getExchangeRateTableCacheKey(baseCurrency);
    const inFlightFetch = this.inFlightTableFetches.get(cacheKey);

    if (inFlightFetch) {
      this.logger.log(
        `Reusing in-flight exchange rate table fetch for ${baseCurrency}`,
      );
      return inFlightFetch;
    }

    const fetchPromise = this.loadExchangeRateTable(baseCurrency)
      .then((table) => {
        this.setCachedExchangeRateTable(table);
        return table;
      })
      .finally(() => {
        this.inFlightTableFetches.delete(cacheKey);
      });

    this.inFlightTableFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  private refreshExchangeRateTableInBackground(baseCurrency: string): void {
    const cacheKey = this.getExchangeRateTableCacheKey(baseCurrency);

    if (this.inFlightTableFetches.has(cacheKey)) {
      return;
    }

    void this.fetchAndCacheExchangeRateTable(baseCurrency).catch((error) => {
      this.logger.warn(
        `Background refresh failed for exchange rate table ${baseCurrency}`,
        error.message,
      );
    });
  }

  private async loadExchangeRateTable(
    normalizedBaseCurrency: string,
  ): Promise<ExchangeRateTableResponse> {
    try {
      const providerTable = await this.fetchExchangeRateTableFromAPI(
        normalizedBaseCurrency,
      );
      await this.persistExchangeRateTableToDatabase(
        normalizedBaseCurrency,
        providerTable.rates,
        providerTable.fetchedAt,
      );

      return this.buildExchangeRateTableResponse(
        normalizedBaseCurrency,
        providerTable.rates,
        providerTable.fetchedAt,
        'provider',
      );
    } catch (providerError) {
      this.logger.warn(
        `Failed to fetch exchange rate table from provider for ${normalizedBaseCurrency}`,
        providerError.message,
      );

      const dbTable = await this.getExchangeRateTableFromDatabase(
        normalizedBaseCurrency,
      );
      if (dbTable) {
        return this.buildExchangeRateTableResponse(
          normalizedBaseCurrency,
          dbTable.rates,
          dbTable.fetchedAt,
          'database',
        );
      }

      const defaultRates = this.getDefaultExchangeRateTable(
        normalizedBaseCurrency,
      );
      if (defaultRates) {
        return this.buildExchangeRateTableResponse(
          normalizedBaseCurrency,
          defaultRates,
          new Date(),
          'hardcoded',
        );
      }

      throw new HttpException(
        `Failed to build exchange rate table for ${normalizedBaseCurrency}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getExchangeRateTableCacheKey(baseCurrency: string): string {
    return `rates:table:${baseCurrency}`;
  }

  private getCachedExchangeRateTable(cacheKey: string): {
    entry: ExchangeRateTableCacheEntry;
    state: 'fresh' | 'stale';
  } | null {
    const cachedEntry = this.exchangeRateTableCache.get(cacheKey);
    if (!cachedEntry) {
      this.observabilityStats.tableCacheMisses++;
      return null;
    }

    const now = Date.now();
    if (now <= cachedEntry.freshUntil) {
      this.observabilityStats.tableCacheFreshHits++;
      return {
        entry: cachedEntry,
        state: 'fresh',
      };
    }

    if (now <= cachedEntry.staleUntil) {
      this.observabilityStats.tableCacheStaleHits++;
      return {
        entry: cachedEntry,
        state: 'stale',
      };
    }

    this.observabilityStats.tableCacheMisses++;
    this.exchangeRateTableCache.delete(cacheKey);
    return null;
  }

  private setCachedExchangeRateTable(
    table: ExchangeRateTableResponse,
  ): ExchangeRateTableCacheEntry {
    const cacheKey = this.getExchangeRateTableCacheKey(table.baseCurrency);
    const cacheEntry: ExchangeRateTableCacheEntry = {
      baseCurrency: table.baseCurrency,
      rates: this.filterSupportedRates(table.baseCurrency, table.rates),
      fetchedAt: new Date(table.fetchedAt).getTime(),
      freshUntil: new Date(table.freshUntil).getTime(),
      staleUntil: new Date(table.staleUntil).getTime(),
      source: table.source,
    };

    this.exchangeRateTableCache.set(cacheKey, cacheEntry);
    return cacheEntry;
  }

  private mapCacheEntryToResponse(
    entry: ExchangeRateTableCacheEntry,
    stale: boolean,
  ): ExchangeRateTableResponse {
    return {
      baseCurrency: entry.baseCurrency,
      rates: this.filterSupportedRates(entry.baseCurrency, entry.rates),
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
      freshUntil: new Date(entry.freshUntil).toISOString(),
      staleUntil: new Date(entry.staleUntil).toISOString(),
      stale,
      source: entry.source,
    };
  }

  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{
    convertedAmount: number;
    rate: number;
    originalAmount: number;
  }> {
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * exchangeRate.rate;

    return {
      originalAmount: amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      rate: exchangeRate.rate,
    };
  }

  private async fetchExchangeRateFromAPI(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    try {
      if (!this.API_KEY) {
        throw new Error('EXCHANGE_RATE_API_KEY not configured');
      }

      const apiUrl = `${this.API_BASE_URL}/${this.API_KEY}/latest/${fromCurrency}`;
      this.incrementProviderCall(fromCurrency);
      this.logger.log(
        `Calling provider latest endpoint for base currency ${fromCurrency}`,
      );

      const response = await axios.get(apiUrl, {
        timeout: 10000,
      });

      if (
        !response.data ||
        response.data.result !== 'success' ||
        !response.data.conversion_rates ||
        !response.data.conversion_rates[toCurrency]
      ) {
        throw new Error(
          `Exchange rate not found for ${fromCurrency} to ${toCurrency} in provider response`,
        );
      }

      return response.data.conversion_rates[toCurrency];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch exchange rate from API: ${fromCurrency} to ${toCurrency}`,
        error.message,
      );

      try {
        const existingRate = await this.exchangeRateRepository.findOne({
          where: {
            fromCurrencyCode: fromCurrency,
            toCurrencyCode: toCurrency,
            isActive: true,
          },
        });

        if (existingRate) {
          return existingRate.rate;
        }

        const inverseRate = await this.exchangeRateRepository.findOne({
          where: {
            fromCurrencyCode: toCurrency,
            toCurrencyCode: fromCurrency,
            isActive: true,
          },
        });

        if (inverseRate) {
          return 1 / inverseRate.rate;
        }
      } catch (dbError) {
        this.logger.error('Database fallback also failed', dbError);
      }

      const defaultRate = this.getDefaultExchangeRate(fromCurrency, toCurrency);
      if (defaultRate) {
        return defaultRate;
      }

      throw new Error(
        `Unable to fetch exchange rate for ${fromCurrency} to ${toCurrency} from any source`,
      );
    }
  }

  private async fetchExchangeRateTableFromAPI(baseCurrency: string): Promise<{
    rates: Record<string, number>;
    fetchedAt: Date;
  }> {
    if (!this.API_KEY) {
      throw new Error('EXCHANGE_RATE_API_KEY not configured');
    }

    const apiUrl = `${this.API_BASE_URL}/${this.API_KEY}/latest/${baseCurrency}`;
    this.incrementProviderCall(baseCurrency);
    this.logger.log(
      `Fetching exchange rate table from provider for base currency ${baseCurrency}`,
    );

    const response = await axios.get(apiUrl, {
      timeout: 10000,
    });

    if (
      !response.data ||
      response.data.result !== 'success' ||
      !response.data.conversion_rates
    ) {
      throw new Error(
        `Exchange rate table not found for base currency ${baseCurrency}`,
      );
    }

    const filteredRates = this.filterSupportedRates(
      baseCurrency,
      response.data.conversion_rates,
    );

    return {
      rates: filteredRates,
      fetchedAt: new Date(response.data.time_last_update_utc || Date.now()),
    };
  }

  private async getExchangeRateTableFromDatabase(
    baseCurrency: string,
  ): Promise<{
    rates: Record<string, number>;
    fetchedAt: Date;
  } | null> {
    const directRates = await this.exchangeRateRepository.find({
      where: {
        fromCurrencyCode: baseCurrency,
        isActive: true,
      },
      order: { lastUpdated: 'DESC' },
    });

    const rates: Record<string, number> = { [baseCurrency]: 1 };
    let fetchedAt: Date | null = null;

    for (const targetCurrency of this.SUPPORTED_CURRENCIES) {
      if (targetCurrency === baseCurrency) {
        continue;
      }

      const directRate = directRates.find(
        (rate) => rate.toCurrencyCode === targetCurrency,
      );

      if (directRate) {
        rates[targetCurrency] = directRate.rate;
        if (!fetchedAt || directRate.lastUpdated < fetchedAt) {
          fetchedAt = directRate.lastUpdated;
        }
        continue;
      }

      const inverseRate = await this.exchangeRateRepository.findOne({
        where: {
          fromCurrencyCode: targetCurrency,
          toCurrencyCode: baseCurrency,
          isActive: true,
        },
        order: { lastUpdated: 'DESC' },
      });

      if (inverseRate) {
        rates[targetCurrency] = 1 / inverseRate.rate;
        if (!fetchedAt || inverseRate.lastUpdated < fetchedAt) {
          fetchedAt = inverseRate.lastUpdated;
        }
      }
    }

    if (Object.keys(rates).length <= 1) {
      return null;
    }

    return {
      rates: this.filterSupportedRates(baseCurrency, rates),
      fetchedAt: fetchedAt || new Date(),
    };
  }

  private async persistExchangeRateTableToDatabase(
    baseCurrency: string,
    rates: Record<string, number>,
    fetchedAt: Date,
  ): Promise<void> {
    const filteredRates = this.filterSupportedRates(baseCurrency, rates);

    for (const [targetCurrency, rate] of Object.entries(filteredRates)) {
      if (targetCurrency === baseCurrency) {
        continue;
      }

      const existingRate = await this.exchangeRateRepository.findOne({
        where: {
          fromCurrencyCode: baseCurrency,
          toCurrencyCode: targetCurrency,
        },
      });

      if (existingRate) {
        existingRate.rate = rate;
        existingRate.lastUpdated = fetchedAt;
        existingRate.isActive = true;
        await this.exchangeRateRepository.save(existingRate);
        continue;
      }

      const exchangeRate = this.exchangeRateRepository.create({
        fromCurrencyCode: baseCurrency,
        toCurrencyCode: targetCurrency,
        rate,
        lastUpdated: fetchedAt,
        isActive: true,
      });

      await this.exchangeRateRepository.save(exchangeRate);
    }
  }

  private buildExchangeRateTableResponse(
    baseCurrency: string,
    rates: Record<string, number>,
    fetchedAt: Date,
    source: 'provider' | 'database' | 'hardcoded',
  ): ExchangeRateTableResponse {
    const freshUntil = new Date(
      fetchedAt.getTime() + this.TABLE_FRESH_DURATION,
    );
    const staleUntil = new Date(
      fetchedAt.getTime() + this.TABLE_STALE_DURATION,
    );

    return {
      baseCurrency,
      rates: this.filterSupportedRates(baseCurrency, rates),
      fetchedAt: fetchedAt.toISOString(),
      freshUntil: freshUntil.toISOString(),
      staleUntil: staleUntil.toISOString(),
      stale: false,
      source,
    };
  }

  private filterSupportedRates(
    baseCurrency: string,
    rates: Record<string, number>,
  ): Record<string, number> {
    const filteredRates: Record<string, number> = {
      [baseCurrency]: 1,
    };

    for (const currencyCode of this.SUPPORTED_CURRENCIES) {
      if (currencyCode === baseCurrency) {
        filteredRates[currencyCode] = 1;
        continue;
      }

      if (typeof rates[currencyCode] === 'number') {
        filteredRates[currencyCode] = rates[currencyCode];
      }
    }

    return filteredRates;
  }

  private isSupportedCurrency(currencyCode: string): boolean {
    return this.SUPPORTED_CURRENCIES.includes(
      currencyCode as (typeof this.SUPPORTED_CURRENCIES)[number],
    );
  }

  private incrementProviderCall(baseCurrency: string): void {
    this.observabilityStats.providerCallsTotal++;
    this.observabilityStats.providerCallsByBase[baseCurrency] =
      (this.observabilityStats.providerCallsByBase[baseCurrency] || 0) + 1;
  }

  private getDefaultExchangeRateTable(
    baseCurrency: string,
  ): Record<string, number> | null {
    const rates: Record<string, number> = {
      [baseCurrency]: 1,
    };

    for (const targetCurrency of this.SUPPORTED_CURRENCIES) {
      if (targetCurrency === baseCurrency) {
        continue;
      }

      const rate = this.getDefaultExchangeRate(baseCurrency, targetCurrency);
      if (rate) {
        rates[targetCurrency] = rate;
      }
    }

    return Object.keys(rates).length > 1 ? rates : null;
  }

  private getDefaultExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): number | null {
    const defaultRates: Record<string, Record<string, number>> = {
      GBP: {
        KWD: 0.375,
        SAR: 4.58,
        BHD: 0.46,
        OMR: 0.47,
        QAR: 4.45,
        AED: 4.49,
      },
      KWD: {
        GBP: 2.67,
        SAR: 12.22,
        BHD: 1.23,
        OMR: 1.25,
        QAR: 11.87,
        AED: 11.98,
      },
      SAR: {
        GBP: 0.218,
        KWD: 0.082,
        BHD: 0.1,
        OMR: 0.102,
        QAR: 0.971,
        AED: 0.98,
      },
      BHD: {
        GBP: 2.17,
        KWD: 0.813,
        SAR: 9.95,
        OMR: 1.02,
        QAR: 9.67,
        AED: 9.75,
      },
      OMR: {
        GBP: 2.13,
        KWD: 0.8,
        SAR: 9.75,
        BHD: 0.98,
        QAR: 9.47,
        AED: 9.55,
      },
      QAR: {
        GBP: 0.225,
        KWD: 0.084,
        SAR: 1.03,
        BHD: 0.103,
        OMR: 0.106,
        AED: 1.01,
      },
      AED: {
        GBP: 0.223,
        KWD: 0.083,
        SAR: 1.02,
        BHD: 0.103,
        OMR: 0.105,
        QAR: 0.99,
      },
    };

    return defaultRates[fromCurrency]?.[toCurrency] || null;
  }

  @Cron('0 */6 * * *')
  async updateExchangeRates(): Promise<void> {
    this.logger.log('Starting scheduled exchange rate table refresh');

    try {
      const currencies = await this.currencyRepository.find({
        where: { isActive: true },
      });

      const baseCurrencies = currencies
        .map((currency) => currency.code)
        .filter((code) => this.isSupportedCurrency(code));

      for (const baseCurrency of baseCurrencies) {
        try {
          await this.fetchAndCacheExchangeRateTable(baseCurrency);
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          this.logger.warn(
            `Failed to refresh exchange rate table for ${baseCurrency}`,
            error.message,
          );
        }
      }

      this.logger.log('Completed scheduled exchange rate table refresh');
    } catch (error) {
      this.logger.error(
        'Failed to complete scheduled exchange rate table refresh',
        error.message,
      );
    }
  }

  clearCache(): void {
    this.rateCache.clear();
    this.exchangeRateTableCache.clear();
    this.inFlightTableFetches.clear();
    this.logger.log('Exchange rate cache cleared');
  }

  getCacheStats(): {
    size: number;
    keys: string[];
    pairCacheKeys: string[];
    tableCacheKeys: string[];
    metrics: ExchangeRateObservabilityStats;
  } {
    const pairKeys = Array.from(this.rateCache.keys());
    const tableKeys = Array.from(this.exchangeRateTableCache.keys());

    return {
      size: pairKeys.length + tableKeys.length,
      keys: [...pairKeys, ...tableKeys],
      pairCacheKeys: pairKeys,
      tableCacheKeys: tableKeys,
      metrics: {
        ...this.observabilityStats,
        providerCallsByBase: { ...this.observabilityStats.providerCallsByBase },
      },
    };
  }
}
