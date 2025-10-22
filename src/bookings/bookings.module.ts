import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Booking } from './entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingNotificationsService } from './booking-notifications.service';
import { BookingNotificationService } from './booking-notification.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';
import { ToolsModule } from '../tools/tools.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin/admin.module';
import { PaymentModule } from '../payments/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, User, Tool]),
    ScheduleModule.forRoot(),
    WalletsModule,
    UsersModule,
    ToolsModule,
    NotificationsModule,
    forwardRef(() => AdminModule),
    PaymentModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingNotificationsService, BookingNotificationService, BookingSchedulerService],
  exports: [BookingsService, BookingNotificationsService, BookingNotificationService, BookingSchedulerService],
})
export class BookingsModule {}
