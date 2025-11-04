import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Booking } from './entities/booking.entity';
import { DepositCaptureJob } from './entities/deposit-capture-job.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingNotificationsService } from './booking-notifications.service';
import { BookingNotificationService } from './booking-notification.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { StripeDepositService } from './services/stripe-deposit.service';
import { DepositSchedulerService } from './services/deposit-scheduler.service';
import { DepositNotificationService } from './services/deposit-notification.service';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';
import { ToolsModule } from '../tools/tools.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin/admin.module';
import { PaymentModule } from '../payments/payment.module';
import { EmailsModule } from '../emails/emails.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, DepositCaptureJob, User, Tool]),
    ScheduleModule.forRoot(),
    WalletsModule,
    UsersModule,
    ToolsModule,
    NotificationsModule,
    forwardRef(() => AdminModule),
    PaymentModule,
    EmailsModule,
    TransactionsModule,
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService, 
    BookingNotificationsService, 
    BookingNotificationService, 
    BookingSchedulerService,
    StripeDepositService,
    DepositSchedulerService,
    DepositNotificationService,
  ],
  exports: [
    BookingsService, 
    BookingNotificationsService, 
    BookingNotificationService, 
    BookingSchedulerService,
    StripeDepositService,
    DepositSchedulerService,
    DepositNotificationService,
  ],
})
export class BookingsModule {}
