import { DataSource } from 'typeorm';
import { Country } from '../users/entities/country.entity';

export async function seedCountries(dataSource: DataSource) {
  console.log('🌍 Starting countries seeding...');
  try {
    const countryRepository = dataSource.getRepository(Country);
    
    // Check if repository is working
    console.log('📊 Checking countries table status...');
    const existingCount = await countryRepository.count();
    console.log(`📊 Current countries in database: ${existingCount}`);

    const countries = [
      // European Countries
      { 
        id: 'FR', 
        name: 'France', 
        code: 'FR', 
        currency: 'EUR', 
        phonePrefix: '+33', 
        continent: 'Europe', 
        isActive: true 
      },
      { 
        id: 'BE', 
        name: 'Belgium', 
        code: 'BE', 
        currency: 'EUR', 
        phonePrefix: '+32', 
        continent: 'Europe', 
        isActive: true 
      },
      { 
        id: 'CH', 
        name: 'Switzerland', 
        code: 'CH', 
        currency: 'CHF', 
        phonePrefix: '+41', 
        continent: 'Europe', 
        isActive: true 
      },
      { 
        id: 'LU', 
        name: 'Luxembourg', 
        code: 'LU', 
        currency: 'EUR', 
        phonePrefix: '+352', 
        continent: 'Europe', 
        isActive: true 
      },
      { 
        id: 'MC', 
        name: 'Monaco', 
        code: 'MC', 
        currency: 'EUR', 
        phonePrefix: '+377', 
        continent: 'Europe', 
        isActive: true 
      },
      // North America
      { 
        id: 'CA', 
        name: 'Canada', 
        code: 'CA', 
        currency: 'CAD', 
        phonePrefix: '+1', 
        continent: 'North America', 
        isActive: true 
      },
      // African Countries
      { 
        id: 'MA', 
        name: 'Morocco', 
        code: 'MA', 
        currency: 'MAD', 
        phonePrefix: '+212', 
        continent: 'Africa', 
        isActive: true 
      },
      { 
        id: 'TN', 
        name: 'Tunisia', 
        code: 'TN', 
        currency: 'TND', 
        phonePrefix: '+216', 
        continent: 'Africa', 
        isActive: true 
      },
      { 
        id: 'DZ', 
        name: 'Algeria', 
        code: 'DZ', 
        currency: 'DZD', 
        phonePrefix: '+213', 
        continent: 'Africa', 
        isActive: true 
      },
      { 
        id: 'SN', 
        name: 'Senegal', 
        code: 'SN', 
        currency: 'XOF', 
        phonePrefix: '+221', 
        continent: 'Africa', 
        isActive: true 
      },
      // Gulf Countries (GCC)
      { 
        id: 'AE', 
        name: 'United Arab Emirates', 
        code: 'AE', 
        currency: 'AED', 
        phonePrefix: '+971', 
        continent: 'Asia', 
        isActive: true 
      },
      { 
        id: 'SA', 
        name: 'Saudi Arabia', 
        code: 'SA', 
        currency: 'SAR', 
        phonePrefix: '+966', 
        continent: 'Asia', 
        isActive: true 
      },
      { 
        id: 'QA', 
        name: 'Qatar', 
        code: 'QA', 
        currency: 'QAR', 
        phonePrefix: '+974', 
        continent: 'Asia', 
        isActive: true 
      },
      { 
        id: 'KW', 
        name: 'Kuwait', 
        code: 'KW', 
        currency: 'KWD', 
        phonePrefix: '+965', 
        continent: 'Asia', 
        isActive: true 
      },
      { 
        id: 'BH', 
        name: 'Bahrain', 
        code: 'BH', 
        currency: 'BHD', 
        phonePrefix: '+973', 
        continent: 'Asia', 
        isActive: true 
      },
      { 
        id: 'OM', 
        name: 'Oman', 
        code: 'OM', 
        currency: 'OMR', 
        phonePrefix: '+968', 
        continent: 'Asia', 
        isActive: true 
      },
    ];

    console.log(`📝 Processing ${countries.length} countries...`);
    let seedCount = 0;
    for (const countryData of countries) {
      try {
        console.log(`🔍 Processing country: ${countryData.name} (${countryData.id})`);
        const existingCountry = await countryRepository.findOne({
          where: { id: countryData.id },
        });
        if (!existingCountry) {
          console.log(`➕ Creating new country: ${countryData.name}`);
          const country = countryRepository.create(countryData);
          const savedCountry = await countryRepository.save(country);
          seedCount++;
          console.log(`✅ Successfully saved country: ${savedCountry.name} (${savedCountry.id})`);
        } else {
          console.log(`⏭️ Country already exists: ${countryData.name} (${countryData.id})`);
        }
      } catch (countryError) {
        console.error(`❌ Error processing country ${countryData.name}:`, countryError);
        throw countryError;
      }
    }

    // Verify seeding results
    const finalCount = await countryRepository.count();
    console.log(`📊 Final countries in database: ${finalCount}`);
    
    // Specifically check for FR and BE
    const frCountry = await countryRepository.findOne({ where: { id: 'FR' } });
    const beCountry = await countryRepository.findOne({ where: { id: 'BE' } });
    console.log(`🇫🇷 France (FR) exists: ${!!frCountry}`);
    console.log(`🇧🇪 Belgium (BE) exists: ${!!beCountry}`);

    console.log(`✅ Countries seeded successfully (${seedCount} new countries added)`);
  } catch (error) {
    console.error('❌ Error seeding countries:', error);
    throw error;
  }
}
