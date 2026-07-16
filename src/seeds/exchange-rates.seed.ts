import { DataSource } from 'typeorm';
import { ExchangeRate } from '../users/entities/exchange-rate.entity';
import { Currency } from '../users/entities/currency.entity';

/**
 * Default exchange rates used only as last-resort fallback data.
 * Scope is intentionally restricted to the supported business currencies.
 */
const defaultExchangeRates = [
  { from: 'GBP', to: 'KWD', rate: 0.375 },
  { from: 'GBP', to: 'SAR', rate: 4.58 },
  { from: 'GBP', to: 'BHD', rate: 0.46 },
  { from: 'GBP', to: 'OMR', rate: 0.47 },
  { from: 'GBP', to: 'QAR', rate: 4.45 },
  { from: 'GBP', to: 'AED', rate: 4.49 },

  { from: 'KWD', to: 'GBP', rate: 2.67 },
  { from: 'KWD', to: 'SAR', rate: 12.22 },
  { from: 'KWD', to: 'BHD', rate: 1.23 },
  { from: 'KWD', to: 'OMR', rate: 1.25 },
  { from: 'KWD', to: 'QAR', rate: 11.87 },
  { from: 'KWD', to: 'AED', rate: 11.98 },

  { from: 'SAR', to: 'GBP', rate: 0.218 },
  { from: 'SAR', to: 'KWD', rate: 0.082 },
  { from: 'SAR', to: 'BHD', rate: 0.1 },
  { from: 'SAR', to: 'OMR', rate: 0.102 },
  { from: 'SAR', to: 'QAR', rate: 0.971 },
  { from: 'SAR', to: 'AED', rate: 0.98 },

  { from: 'BHD', to: 'GBP', rate: 2.17 },
  { from: 'BHD', to: 'KWD', rate: 0.813 },
  { from: 'BHD', to: 'SAR', rate: 9.95 },
  { from: 'BHD', to: 'OMR', rate: 1.02 },
  { from: 'BHD', to: 'QAR', rate: 9.67 },
  { from: 'BHD', to: 'AED', rate: 9.75 },

  { from: 'OMR', to: 'GBP', rate: 2.13 },
  { from: 'OMR', to: 'KWD', rate: 0.8 },
  { from: 'OMR', to: 'SAR', rate: 9.75 },
  { from: 'OMR', to: 'BHD', rate: 0.98 },
  { from: 'OMR', to: 'QAR', rate: 9.47 },
  { from: 'OMR', to: 'AED', rate: 9.55 },

  { from: 'QAR', to: 'GBP', rate: 0.225 },
  { from: 'QAR', to: 'KWD', rate: 0.084 },
  { from: 'QAR', to: 'SAR', rate: 1.03 },
  { from: 'QAR', to: 'BHD', rate: 0.103 },
  { from: 'QAR', to: 'OMR', rate: 0.106 },
  { from: 'QAR', to: 'AED', rate: 1.01 },

  { from: 'AED', to: 'GBP', rate: 0.223 },
  { from: 'AED', to: 'KWD', rate: 0.083 },
  { from: 'AED', to: 'SAR', rate: 1.02 },
  { from: 'AED', to: 'BHD', rate: 0.103 },
  { from: 'AED', to: 'OMR', rate: 0.105 },
  { from: 'AED', to: 'QAR', rate: 0.99 },
];

export async function seedExchangeRates(dataSource: DataSource): Promise<void> {
  console.log('Seeding default exchange rates...');

  const exchangeRateRepository = dataSource.getRepository(ExchangeRate);
  const currencyRepository = dataSource.getRepository(Currency);

  try {
    const currencies = await currencyRepository.find({
      where: { isActive: true },
    });
    const currencyCodes = currencies.map((c) => c.code);

    console.log(
      `Found ${currencies.length} active currencies: ${currencyCodes.join(', ')}`,
    );

    let insertedCount = 0;
    let skippedCount = 0;

    for (const rateData of defaultExchangeRates) {
      if (
        !currencyCodes.includes(rateData.from) ||
        !currencyCodes.includes(rateData.to)
      ) {
        console.log(
          `Skipping rate ${rateData.from}->${rateData.to}: currency not found`,
        );
        skippedCount++;
        continue;
      }

      const existingRate = await exchangeRateRepository.findOne({
        where: {
          fromCurrencyCode: rateData.from,
          toCurrencyCode: rateData.to,
        },
      });

      if (existingRate) {
        console.log(
          `Rate ${rateData.from}->${rateData.to} already exists, skipping`,
        );
        skippedCount++;
        continue;
      }

      const exchangeRate = exchangeRateRepository.create({
        fromCurrencyCode: rateData.from,
        toCurrencyCode: rateData.to,
        rate: rateData.rate,
        lastUpdated: new Date(),
        isActive: true,
      });

      await exchangeRateRepository.save(exchangeRate);
      console.log(
        `Created rate: ${rateData.from} -> ${rateData.to} = ${rateData.rate}`,
      );
      insertedCount++;
    }

    console.log('Exchange rates seeding completed');
    console.log(`Inserted: ${insertedCount} rates`);
    console.log(`Skipped: ${skippedCount} rates`);
  } catch (error) {
    console.error('Error seeding exchange rates:', error);
    throw error;
  }
}
