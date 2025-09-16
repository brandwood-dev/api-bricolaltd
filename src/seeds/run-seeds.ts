import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { seedCountries } from './countries.seed';
import { seedCategories } from './categories.seed';

async function runSeeds() {
  console.log('🌱 Starting database seeding...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Run seeds in order
    console.log('\n1️⃣ Seeding countries...');
    await seedCountries(dataSource);

    console.log('\n2️⃣ Seeding categories...');
    await seedCategories(dataSource);

    console.log('\n🎉 All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Error running seeds:', error);
    throw error;
  } finally {
    await app.close();
    console.log('🔌 Application context closed');
  }
}

// Run seeds if this file is executed directly
if (require.main === module) {
  runSeeds();
}

export { runSeeds };
