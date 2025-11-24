import { DataSource } from 'typeorm';
import { Currency } from '../users/entities/currency.entity';

export async function seedCurrencies(dataSource: DataSource) {
  console.log('💱 Seeding currencies...');

  const currencyRepository = dataSource.getRepository(Currency);

  const currencies = [
    {
      code: 'GBP',
      name: 'British Pound Sterling',
      symbol: '£',
      isDefault: true,
      isActive: true,
    },
    {
      code: 'KWD',
      name: 'Kuwaiti Dinar',
      symbol: 'د.ك',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'SAR',
      name: 'Saudi Riyal',
      symbol: '﷼',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'BHD',
      name: 'Bahraini Dinar',
      symbol: '.د.ب',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'OMR',
      name: 'Omani Rial',
      symbol: '﷼',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'QAR',
      name: 'Qatari Riyal',
      symbol: '﷼',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'AED',
      name: 'United Arab Emirates Dirham',
      symbol: 'د.إ',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      isDefault: false,
      isActive: true,
    },
    {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isDefault: false,
      isActive: true,
    },
  ];

  let seedCount = 0;
  for (const currencyData of currencies) {
    const existingCurrency = await currencyRepository.findOne({
      where: { code: currencyData.code },
    });

    if (!existingCurrency) {
      console.log(
        `Creating currency: ${currencyData.code} - ${currencyData.name}`,
      );
      const currency = currencyRepository.create(currencyData);
      await currencyRepository.save(currency);
      seedCount++;
    } else {
      console.log(`Currency already exists: ${currencyData.code}`);
    }
  }

  console.log(
    `✅ Currencies seeded successfully (${seedCount} new currencies added)`,
  );
}
