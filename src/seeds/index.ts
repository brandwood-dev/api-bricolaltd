import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { seedCountries } from './countries.seed';
import { seedCategories } from './categories.seed';
import { seedNotificationTemplates } from './notification-templates.seed';
import { seedUsers } from './users.seed';
import { seedTools } from './tools.seed';
import { seedBookings } from './bookings.seed';
import { seedTransactions } from './transactions.seed';
import { seedReviews } from './reviews.seed';
import { seedDisputes } from './disputes.seed';
import { seedNotifications } from './notifications.seed';
import { seedEmails } from './emails.seed';
import { seedDocuments } from './documents.seed';
import { seedReviewApp } from './review-app.seed';
import { seedUserSessions } from './user-session.seed';
import { seedNews } from './news.seed';
import { seedBookmarks } from './bookmarks.seed';
import { seedAccountDeletionRequests } from './account-deletion-request.seed';
import { seedPaymentProviders } from './payment-providers.seed';
import { seedPaymentTransactions } from './payment-transactions.seed';

async function runSeeds() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('🌱 Starting database seeding...');

    // Disable foreign key checks temporarily
    console.log('🔓 Disabling foreign key checks...');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');

    // Seed base data first (no dependencies)
    await seedCountries(dataSource);
    await seedCategories(dataSource);
    await seedNotificationTemplates(dataSource);

    // Re-enable foreign key checks
    console.log('🔒 Re-enabling foreign key checks...');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

    // Seed users and related data
    await seedUsers(dataSource);

    // Seed tools and related data
    await seedTools(dataSource);

    // Seed bookings and transactions
    await seedBookings(dataSource);
    await seedTransactions(dataSource);
    await seedPaymentProviders(dataSource);
    await seedPaymentTransactions(dataSource);

    // Seed reviews and disputes
    await seedReviews(dataSource);
    await seedDisputes(dataSource);

    // Seed notifications and emails
    await seedNotifications(dataSource);
    await seedEmails(dataSource);

    // Seed additional entities
    await seedDocuments(dataSource);
    await seedReviewApp(dataSource);
    await seedUserSessions(dataSource);
    await seedNews(dataSource);
    await seedBookmarks(dataSource);
    await seedAccountDeletionRequests(dataSource);

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    // Make sure to re-enable foreign key checks even if there's an error
    try {
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (fkError) {
      console.error('❌ Error re-enabling foreign key checks:', fkError);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeeds();
