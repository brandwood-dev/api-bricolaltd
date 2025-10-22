import { DataSource } from 'typeorm';
import { ExchangeRate } from '../users/entities/exchange-rate.entity';
import { Currency } from '../users/entities/currency.entity';

/**
 * Default exchange rates (realistic rates as of January 2024)
 * These serve as fallback when external API is unavailable
 */
const defaultExchangeRates = [
  // GBP as base currency
  { from: 'GBP', to: 'KWD', rate: 0.375 },
  { from: 'GBP', to: 'SAR', rate: 4.58 },
  { from: 'GBP', to: 'BHD', rate: 0.46 },
  { from: 'GBP', to: 'OMR', rate: 0.47 },
  { from: 'GBP', to: 'QAR', rate: 4.45 },
  { from: 'GBP', to: 'AED', rate: 4.49 },
  { from: 'GBP', to: 'EUR', rate: 1.16 },
  { from: 'GBP', to: 'USD', rate: 1.22 },

  // KWD as base currency
  { from: 'KWD', to: 'GBP', rate: 2.67 },
  { from: 'KWD', to: 'SAR', rate: 12.22 },
  { from: 'KWD', to: 'BHD', rate: 1.23 },
  { from: 'KWD', to: 'OMR', rate: 1.25 },
  { from: 'KWD', to: 'QAR', rate: 11.87 },
  { from: 'KWD', to: 'AED', rate: 11.98 },
  { from: 'KWD', to: 'EUR', rate: 3.09 },
  { from: 'KWD', to: 'USD', rate: 3.26 },

  // SAR as base currency
  { from: 'SAR', to: 'GBP', rate: 0.218 },
  { from: 'SAR', to: 'KWD', rate: 0.082 },
  { from: 'SAR', to: 'BHD', rate: 0.100 },
  { from: 'SAR', to: 'OMR', rate: 0.102 },
  { from: 'SAR', to: 'QAR', rate: 0.971 },
  { from: 'SAR', to: 'AED', rate: 0.980 },
  { from: 'SAR', to: 'EUR', rate: 0.253 },
  { from: 'SAR', to: 'USD', rate: 0.267 },

  // BHD as base currency
  { from: 'BHD', to: 'GBP', rate: 2.17 },
  { from: 'BHD', to: 'KWD', rate: 0.813 },
  { from: 'BHD', to: 'SAR', rate: 9.95 },
  { from: 'BHD', to: 'OMR', rate: 1.02 },
  { from: 'BHD', to: 'QAR', rate: 9.67 },
  { from: 'BHD', to: 'AED', rate: 9.75 },
  { from: 'BHD', to: 'EUR', rate: 2.52 },
  { from: 'BHD', to: 'USD', rate: 2.65 },

  // OMR as base currency
  { from: 'OMR', to: 'GBP', rate: 2.13 },
  { from: 'OMR', to: 'KWD', rate: 0.800 },
  { from: 'OMR', to: 'SAR', rate: 9.75 },
  { from: 'OMR', to: 'BHD', rate: 0.980 },
  { from: 'OMR', to: 'QAR', rate: 9.47 },
  { from: 'OMR', to: 'AED', rate: 9.55 },
  { from: 'OMR', to: 'EUR', rate: 2.47 },
  { from: 'OMR', to: 'USD', rate: 2.60 },

  // QAR as base currency
  { from: 'QAR', to: 'GBP', rate: 0.225 },
  { from: 'QAR', to: 'KWD', rate: 0.084 },
  { from: 'QAR', to: 'SAR', rate: 1.03 },
  { from: 'QAR', to: 'BHD', rate: 0.103 },
  { from: 'QAR', to: 'OMR', rate: 0.106 },
  { from: 'QAR', to: 'AED', rate: 1.01 },
  { from: 'QAR', to: 'EUR', rate: 0.261 },
  { from: 'QAR', to: 'USD', rate: 0.275 },

  // AED as base currency
  { from: 'AED', to: 'GBP', rate: 0.223 },
  { from: 'AED', to: 'KWD', rate: 0.083 },
  { from: 'AED', to: 'SAR', rate: 1.02 },
  { from: 'AED', to: 'BHD', rate: 0.103 },
  { from: 'AED', to: 'OMR', rate: 0.105 },
  { from: 'AED', to: 'QAR', rate: 0.99 },
  { from: 'AED', to: 'EUR', rate: 0.258 },
  { from: 'AED', to: 'USD', rate: 0.272 },

  // EUR as base currency
  { from: 'EUR', to: 'GBP', rate: 0.862 },
  { from: 'EUR', to: 'KWD', rate: 0.323 },
  { from: 'EUR', to: 'SAR', rate: 3.95 },
  { from: 'EUR', to: 'BHD', rate: 0.397 },
  { from: 'EUR', to: 'OMR', rate: 0.405 },
  { from: 'EUR', to: 'QAR', rate: 3.83 },
  { from: 'EUR', to: 'AED', rate: 3.87 },
  { from: 'EUR', to: 'USD', rate: 1.05 },

  // USD as base currency
  { from: 'USD', to: 'GBP', rate: 0.820 },
  { from: 'USD', to: 'KWD', rate: 0.307 },
  { from: 'USD', to: 'SAR', rate: 3.75 },
  { from: 'USD', to: 'BHD', rate: 0.377 },
  { from: 'USD', to: 'OMR', rate: 0.385 },
  { from: 'USD', to: 'QAR', rate: 3.64 },
  { from: 'USD', to: 'AED', rate: 3.67 },
  { from: 'USD', to: 'EUR', rate: 0.952 },
];

export async function seedExchangeRates(dataSource: DataSource): Promise<void> {
  console.log('🔄 Seeding default exchange rates...');

  const exchangeRateRepository = dataSource.getRepository(ExchangeRate);
  const currencyRepository = dataSource.getRepository(Currency);

  try {
    // Verify all currencies exist
    const currencies = await currencyRepository.find({ where: { isActive: true } });
    const currencyCodes = currencies.map(c => c.code);
    
    console.log(`📊 Found ${currencies.length} active currencies: ${currencyCodes.join(', ')}`);

    // Insert default exchange rates
    let insertedCount = 0;
    let skippedCount = 0;

    for (const rateData of defaultExchangeRates) {
      // Check if both currencies exist
      if (!currencyCodes.includes(rateData.from) || !currencyCodes.includes(rateData.to)) {
        console.log(`⚠️  Skipping rate ${rateData.from}->${rateData.to}: Currency not found`);
        skippedCount++;
        continue;
      }

      // Check if exchange rate already exists
      const existingRate = await exchangeRateRepository.findOne({
        where: {
          fromCurrencyCode: rateData.from,
          toCurrencyCode: rateData.to,
        },
      });

      if (existingRate) {
        console.log(`⏭️  Rate ${rateData.from}->${rateData.to} already exists, skipping`);
        skippedCount++;
        continue;
      }

      // Create new exchange rate
      const exchangeRate = exchangeRateRepository.create({
        fromCurrencyCode: rateData.from,
        toCurrencyCode: rateData.to,
        rate: rateData.rate,
        lastUpdated: new Date(),
        isActive: true,
      });

      await exchangeRateRepository.save(exchangeRate);
      console.log(`✅ Created rate: ${rateData.from} -> ${rateData.to} = ${rateData.rate}`);
      insertedCount++;
    }

    console.log(`🎉 Exchange rates seeding completed!`);
    console.log(`   📈 Inserted: ${insertedCount} rates`);
    console.log(`   ⏭️  Skipped: ${skippedCount} rates`);
    
  } catch (error) {
    console.error('❌ Error seeding exchange rates:', error);
    throw error;
  }
}