import {
  Module,
  NestModule,
  MiddlewareConsumer,
  forwardRef,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { BookingsModule } from '../bookings/bookings.module';
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';
import { RateLimitMiddleware } from '../common/middleware/rate-limit.middleware';
import { SecurityHeadersMiddleware } from '../common/middleware/security-headers.middleware';
import { User } from '../users/entities/user.entity';
import { Country } from '../users/entities/country.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';
import { Review } from '../reviews/entities/review.entity';
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { ReviewApp } from '../reviews/entities/review-app.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { UserActivity } from '../users/entities/user-activity.entity';
import { News } from '../news/entities/news.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Setting } from './entities/setting.entity';
import { SecurityLog } from './entities/security-log.entity';
import { BlockedIp } from './entities/blocked-ip.entity';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSecurityController } from './admin-security.controller';
import { AdminToolsController } from './admin-tools.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminSecurityService } from './admin-security.service';
import { AdminToolsService } from './admin-tools.service';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminNotification } from './entities/admin-notification.entity';
import { WithdrawalProcessingService } from '../wallets/withdrawal-processing.service';
import { WalletsModule } from '../wallets/wallets.module';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminBookingsController } from './admin-bookings.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailsModule } from '../emails/emails.module';
import { ToolRejectionEmailService } from '../tools/services/tool-rejection-email.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => BookingsModule),
    forwardRef(() => NotificationsModule),
    EmailsModule,
    forwardRef(() => WalletsModule),
    TypeOrmModule.forFeature([
      User,
      Country,
      Transaction,
      PaymentTransaction,
      Booking,
      Tool,
      Category,
      Subcategory,
      Review,
      ReviewTool,
      ReviewApp,
      Dispute,
      UserSession,
      UserActivity,
      News,
      Notification,
      Setting,
      SecurityLog,
      BlockedIp,
      AdminNotification,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AdminDashboardController,
    AdminAnalyticsController,
    AdminSettingsController,
    AdminSecurityController,
    AdminToolsController,
    AdminTransactionsController,
    AdminWithdrawalsController,
    AdminNotificationsController,
    AdminReviewsController,
    AdminBookingsController,
  ],
  providers: [
    AdminDashboardService,
    AdminAnalyticsService,
    AdminSettingsService,
    AdminSecurityService,
    AdminToolsService,
    AdminTransactionsService,
    AdminNotificationsService,
    AdminReviewsService,

    EnhancedAdminGuard,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    ToolRejectionEmailService,
  ],
  exports: [
    AdminDashboardService,
    AdminAnalyticsService,
    AdminSettingsService,
    AdminSecurityService,
    AdminToolsService,
    AdminTransactionsService,
    AdminNotificationsService,
    AdminReviewsService,
    EnhancedAdminGuard,
  ],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityHeadersMiddleware, RateLimitMiddleware)
      .forRoutes('admin/*');
  }
}
