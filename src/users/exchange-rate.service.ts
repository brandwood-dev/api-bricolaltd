import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { Currency } from './entities/currency.entity';
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

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly API_BASE_URL = 'https://v6.exchangerate-api.com/v6';
  private readonly API_KEY = process.env.EXCHANGE_RATE_API_KEY;
  
  // In-memory cache for exchange rates
  private rateCache = new Map<string, { rate: number; timestamp: number }>();

  constructor(
    @InjectRepository(ExchangeRate)
    private exchangeRateRepository: Repository<ExchangeRate>,
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
  ) {
    this.logger.log('🏦 ExchangeRateService initialized with Pro API');
    this.logger.log(`📊 Cache duration: ${this.CACHE_DURATION}ms`);
    this.logger.log(`🌐 Pro API URL: ${this.API_BASE_URL}`);
    this.logger.log(`🔑 API Key configured: ${this.API_KEY ? 'Yes' : 'No'}`);
    
    if (!this.API_KEY) {
      this.logger.warn('⚠️ EXCHANGE_RATE_API_KEY not found in environment variables');
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRateResponse> {
    this.logger.log(`🔄 Getting exchange rate: ${fromCurrency} → ${toCurrency}`);
    
    try {
      // If same currency, return rate of 1
      if (fromCurrency === toCurrency) {
        this.logger.log(`✅ Same currency detected: ${fromCurrency} = ${toCurrency}, rate = 1`);
        return {
          fromCurrency,
          toCurrency,
          rate: 1,
          lastUpdated: new Date(),
        };
      }

      // Check cache first
      const cacheKey = `${fromCurrency}_${toCurrency}`;
      this.logger.log(`🔍 Checking cache for key: ${cacheKey}`);
      
      const cached = this.rateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        this.logger.log(`✅ Cache hit for ${cacheKey}: rate = ${cached.rate}`);
        return {
          fromCurrency,
          toCurrency,
          rate: cached.rate,
          lastUpdated: new Date(cached.timestamp),
        };
      } else if (cached) {
        this.logger.log(`⏰ Cache expired for ${cacheKey} (age: ${Date.now() - cached.timestamp}ms)`);
      } else {
        this.logger.log(`❌ Cache miss for ${cacheKey}`);
      }

      // Fetch from API
      this.logger.log(`🌐 Fetching rate from API: ${fromCurrency} → ${toCurrency}`);
      const rate = await this.fetchExchangeRateFromAPI(fromCurrency, toCurrency);
      
      // Cache the result
      this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });
      this.logger.log(`💾 Cached rate for ${cacheKey}: ${rate}`);

      return {
        fromCurrency,
        toCurrency,
        rate,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ Error getting exchange rate ${fromCurrency} → ${toCurrency}:`, error.message);
      this.logger.error(`📊 Error stack:`, error.stack);
      
      // Try to get from database as fallback
      this.logger.log(`🔄 Attempting database fallback for ${fromCurrency} → ${toCurrency}`);
      try {
        const dbRate = await this.exchangeRateRepository.findOne({
          where: { fromCurrencyCode: fromCurrency, toCurrencyCode: toCurrency },
          order: { lastUpdated: 'DESC' }
        });
        
        if (dbRate) {
          this.logger.log(`✅ Database fallback successful: rate = ${dbRate.rate}`);
          return {
            fromCurrency,
            toCurrency,
            rate: dbRate.rate,
            lastUpdated: dbRate.lastUpdated,
          };
        }
      } catch (dbError) {
        this.logger.error(`❌ Database fallback failed:`, dbError.message);
      }
      
      throw new HttpException(
        `Failed to get exchange rate for ${fromCurrency} to ${toCurrency}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get bulk exchange rates for a base currency
   */
  async getBulkExchangeRates(baseCurrency: string): Promise<BulkExchangeRateResponse> {
    this.logger.log(`📊 Getting bulk exchange rates for base currency: ${baseCurrency}`);
    
    try {
      // Get all active currencies
      this.logger.log(`🔍 Fetching active currencies from database`);
      const currencies = await this.currencyRepository.find({
        where: { isActive: true },
      });
      
      this.logger.log(`✅ Found ${currencies.length} active currencies: ${currencies.map(c => c.code).join(', ')}`);

      const rates: Record<string, number> = {};
      let lastUpdated = new Date();

      // Get rates for each currency
      for (const currency of currencies) {
        if (currency.code !== baseCurrency) {
          this.logger.log(`🔄 Getting rate: ${baseCurrency} → ${currency.code}`);
          const exchangeRate = await this.getExchangeRate(baseCurrency, currency.code);
          rates[currency.code] = exchangeRate.rate;
          this.logger.log(`✅ Rate ${baseCurrency} → ${currency.code}: ${exchangeRate.rate}`);
          
          // Keep track of the oldest update time
          if (exchangeRate.lastUpdated < lastUpdated) {
            lastUpdated = exchangeRate.lastUpdated;
          }
        } else {
          this.logger.log(`✅ Same currency ${currency.code}: rate = 1`);
          rates[currency.code] = 1; // Same currency
        }
      }

      const result = {
        baseCurrency,
        rates,
        lastUpdated,
      };
      
      this.logger.log(`📊 Bulk rates result for ${baseCurrency}:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to get bulk exchange rates for ${baseCurrency}:`, error.message);
      this.logger.error(`📊 Error stack:`, error.stack);
      throw new HttpException(
        `Failed to fetch bulk exchange rates for ${baseCurrency}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ convertedAmount: number; rate: number; originalAmount: number }> {
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * exchangeRate.rate;

    return {
      originalAmount: amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
      rate: exchangeRate.rate,
    };
  }

  /**
   * Fetch exchange rate from external API with fallback to database
   */
  private async fetchExchangeRateFromAPI(fromCurrency: string, toCurrency: string, preventRecursion: boolean = false): Promise<number> {
    try {
      this.logger.log(`Attempting to fetch exchange rate from Pro API: ${fromCurrency} -> ${toCurrency}`);
      
      if (!this.API_KEY) {
        throw new Error('EXCHANGE_RATE_API_KEY not configured');
      }
      
      const apiUrl = `${this.API_BASE_URL}/${this.API_KEY}/latest/${fromCurrency}`;
      this.logger.log(`🌐 Pro API Request URL: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        timeout: 10000, // 10 seconds timeout
      });

      if (!response.data || response.data.result !== 'success' || !response.data.conversion_rates || !response.data.conversion_rates[toCurrency]) {
        throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency} in Pro API response`);
      }

      this.logger.log(`✅ Successfully fetched rate from Pro API: ${fromCurrency} -> ${toCurrency} = ${response.data.conversion_rates[toCurrency]}`);
      return response.data.conversion_rates[toCurrency];
    } catch (error) {
      this.logger.warn(`Failed to fetch exchange rate from API: ${fromCurrency} to ${toCurrency}`, error.message);
      
      // Fallback 1: try to get inverse rate from API (only if not preventing recursion)
      if (!preventRecursion && fromCurrency !== 'USD' && toCurrency !== 'USD') {
        try {
          this.logger.log(`Trying fallback via USD: ${fromCurrency} -> USD -> ${toCurrency}`);
          // Prevent infinite recursion by setting preventRecursion to true
          const usdToFrom = await this.fetchExchangeRateFromAPI('USD', fromCurrency, true);
          const usdToTo = await this.fetchExchangeRateFromAPI('USD', toCurrency, true);
          const calculatedRate = usdToTo / usdToFrom;
          this.logger.log(`Successfully calculated rate via USD: ${fromCurrency} -> ${toCurrency} = ${calculatedRate}`);
          return calculatedRate;
        } catch (fallbackError) {
          this.logger.warn('USD fallback also failed', fallbackError.message);
        }
      } else if (preventRecursion) {
        this.logger.log(`Skipping USD fallback to prevent recursion: ${fromCurrency} -> ${toCurrency}`);
      }
      
      // Fallback 2: try to get from database (existing rates)
      try {
        this.logger.log(`Trying database fallback for: ${fromCurrency} -> ${toCurrency}`);
        const existingRate = await this.exchangeRateRepository.findOne({
          where: {
            fromCurrencyCode: fromCurrency,
            toCurrencyCode: toCurrency,
            isActive: true,
          },
        });

        if (existingRate) {
          this.logger.log(`Found existing rate in database: ${fromCurrency} -> ${toCurrency} = ${existingRate.rate}`);
          return existingRate.rate;
        }

        // Try inverse rate from database
        const inverseRate = await this.exchangeRateRepository.findOne({
          where: {
            fromCurrencyCode: toCurrency,
            toCurrencyCode: fromCurrency,
            isActive: true,
          },
        });

        if (inverseRate) {
          const calculatedRate = 1 / inverseRate.rate;
          this.logger.log(`Found inverse rate in database: ${toCurrency} -> ${fromCurrency} = ${inverseRate.rate}, calculated: ${calculatedRate}`);
          return calculatedRate;
        }
      } catch (dbError) {
        this.logger.error('Database fallback also failed', dbError);
      }
      
      // Fallback 3: Use hardcoded default rates as last resort
      const defaultRate = this.getDefaultExchangeRate(fromCurrency, toCurrency);
      if (defaultRate) {
        this.logger.warn(`Using hardcoded default rate: ${fromCurrency} -> ${toCurrency} = ${defaultRate}`);
        return defaultRate;
      }
      
      throw new Error(`Unable to fetch exchange rate for ${fromCurrency} to ${toCurrency} from any source`);
    }
  }

  /**
   * Get hardcoded default exchange rates as last resort
   */
  private getDefaultExchangeRate(fromCurrency: string, toCurrency: string): number | null {
    // Default rates based on realistic market values (January 2024)
    const defaultRates: Record<string, Record<string, number>> = {
      'GBP': { 'KWD': 0.375, 'SAR': 4.58, 'BHD': 0.46, 'OMR': 0.47, 'QAR': 4.45, 'AED': 4.49, 'EUR': 1.16, 'USD': 1.22 },
      'KWD': { 'GBP': 2.67, 'SAR': 12.22, 'BHD': 1.23, 'OMR': 1.25, 'QAR': 11.87, 'AED': 11.98, 'EUR': 3.09, 'USD': 3.26 },
      'SAR': { 'GBP': 0.218, 'KWD': 0.082, 'BHD': 0.100, 'OMR': 0.102, 'QAR': 0.971, 'AED': 0.980, 'EUR': 0.253, 'USD': 0.267 },
      'BHD': { 'GBP': 2.17, 'KWD': 0.813, 'SAR': 9.95, 'OMR': 1.02, 'QAR': 9.67, 'AED': 9.75, 'EUR': 2.52, 'USD': 2.65 },
      'OMR': { 'GBP': 2.13, 'KWD': 0.800, 'SAR': 9.75, 'BHD': 0.980, 'QAR': 9.47, 'AED': 9.55, 'EUR': 2.47, 'USD': 2.60 },
      'QAR': { 'GBP': 0.225, 'KWD': 0.084, 'SAR': 1.03, 'BHD': 0.103, 'OMR': 0.106, 'AED': 1.01, 'EUR': 0.261, 'USD': 0.275 },
      'AED': { 'GBP': 0.223, 'KWD': 0.083, 'SAR': 1.02, 'BHD': 0.103, 'OMR': 0.105, 'QAR': 0.99, 'EUR': 0.258, 'USD': 0.272 },
      'EUR': { 'GBP': 0.862, 'KWD': 0.323, 'SAR': 3.95, 'BHD': 0.397, 'OMR': 0.405, 'QAR': 3.83, 'AED': 3.87, 'USD': 1.05 },
      'USD': { 'GBP': 0.820, 'KWD': 0.307, 'SAR': 3.75, 'BHD': 0.377, 'OMR': 0.385, 'QAR': 3.64, 'AED': 3.67, 'EUR': 0.952 },
    };

    return defaultRates[fromCurrency]?.[toCurrency] || null;
  }

  /**
   * Check if exchange rate is outdated (older than 1 hour)
   */
  private isRateOutdated(lastUpdated: Date): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastUpdated < oneHourAgo;
  }

  /**
   * Scheduled task to update exchange rates every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateExchangeRates(): Promise<void> {
    this.logger.log('Starting scheduled exchange rate update');
    
    try {
      const currencies = await this.currencyRepository.find({
        where: { isActive: true },
      });

      const currencyCodes = currencies.map(c => c.code);
      
      // Update rates for all currency pairs
      for (const fromCurrency of currencyCodes) {
        for (const toCurrency of currencyCodes) {
          if (fromCurrency !== toCurrency) {
            try {
              await this.getExchangeRate(fromCurrency, toCurrency);
              // Small delay to avoid hitting API rate limits
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              this.logger.warn(`Failed to update rate ${fromCurrency} to ${toCurrency}`, error);
            }
          }
        }
      }
      
      this.logger.log('Completed scheduled exchange rate update');
    } catch (error) {
      this.logger.error('Failed to complete scheduled exchange rate update', error);
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.rateCache.clear();
    this.logger.log('Exchange rate cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.rateCache.size,
      keys: Array.from(this.rateCache.keys()),
    };
  }
}