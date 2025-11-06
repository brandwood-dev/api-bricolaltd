import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Document } from '../documents/entities/document.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Review } from '../reviews/entities/review.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { News } from '../news/entities/news.entity';
import { Email } from '../emails/entities/email.entity';
import { Bookmark } from '../bookmarks/entities/bookmark.entity';
import { Tool } from '../tools/entities/tool.entity';
import { ToolPhoto } from '../tools/entities/tool-photo.entity';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';
import { Country } from '../users/entities/country.entity';
import { Currency } from '../users/entities/currency.entity';
import { ExchangeRate } from '../users/entities/exchange-rate.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { UserActivity } from '../users/entities/user-activity.entity';
import { AccountDeletionRequest } from '../users/entities/account-deletion-request.entity';
import { Notification, NotificationTemplate } from '../notifications/entities';
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { ReviewApp } from '../reviews/entities/review-app.entity';
import { PaymentProvider } from '../transactions/entities/payment-provider.entity';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { Setting } from '../admin/entities/setting.entity';
import { SecurityLog } from '../admin/entities/security-log.entity';
import { BlockedIp } from '../admin/entities/blocked-ip.entity';
import { Contact } from '../contact/entities/contact.entity';
import { AdminNotification } from '../admin/entities/admin-notification.entity';
import { DepositCaptureJob } from '../bookings/entities/deposit-capture-job.entity';

export const databaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: configService.get('DB_HOST'),
  port: parseInt(configService.get('DB_PORT') || '3306', 10),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: [
    User,
    Country,
    Currency,
    ExchangeRate,
    UserPreference,
    UserSession,
    UserActivity,
    AccountDeletionRequest,
    Notification,
    NotificationTemplate,
    Category,
    Subcategory,
    Document,
    Wallet,
    Transaction,
    PaymentProvider,
    PaymentTransaction,
    Booking,
    Review,
    ReviewTool,
    ReviewApp,
    Dispute,
    News,
    Email,
    Bookmark,
    Tool,
    ToolPhoto,
    Setting,
    SecurityLog,
    BlockedIp,
    Contact,
    AdminNotification,
    DepositCaptureJob,
  ],
  migrations: ['dist/migrations/*.js'],
  synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
  logging: configService.get('DB_LOGGING') === 'false',
});
