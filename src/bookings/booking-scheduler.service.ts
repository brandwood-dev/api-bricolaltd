import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { BookingNotificationService } from './booking-notification.service';
import { BookingNotificationsService } from './booking-notifications.service';

@Injectable()
export class BookingSchedulerService {
  private readonly logger = new Logger(BookingSchedulerService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private bookingNotificationService: BookingNotificationService,
    private bookingNotificationsService: BookingNotificationsService,
  ) {}

  // Run every day at 9:00 AM
  @Cron('0 9 * * *')
  async sendStartReminders() {
    this.logger.log('Checking for booking start reminders...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    try {
      const bookingsStartingTomorrow = await this.bookingsRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          startDate: Between(tomorrow, dayAfterTomorrow),
        },
        relations: ['user', 'tool'],
      });

      this.logger.log(`Found ${bookingsStartingTomorrow.length} bookings starting tomorrow`);

      for (const booking of bookingsStartingTomorrow) {
        try {
          await this.bookingNotificationService.notifyBookingReminder(booking, 'start');
          // Envoyer un rappel pour cette réservation
        console.log(`Rappel envoyé pour la réservation ${booking.id}`);
          this.logger.log(`Sent start reminder for booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to send start reminder for booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error checking for start reminders:', error);
    }
  }

  // Run every day at 6:00 PM
  @Cron('0 18 * * *')
  async sendEndReminders() {
    this.logger.log('Checking for booking end reminders...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    try {
      const bookingsEndingTomorrow = await this.bookingsRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          endDate: Between(tomorrow, dayAfterTomorrow),
        },
        relations: ['user', 'tool'],
      });

      this.logger.log(`Found ${bookingsEndingTomorrow.length} bookings ending tomorrow`);

      for (const booking of bookingsEndingTomorrow) {
        try {
          await this.bookingNotificationService.notifyBookingReminder(booking, 'end');
          this.logger.log(`Sent end reminder for booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to send end reminder for booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error checking for end reminders:', error);
    }
  }

  // Run every day at 10:00 AM
  @Cron('0 10 * * *')
  async checkOverdueBookings() {
    this.logger.log('Checking for overdue bookings...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const overdueBookings = await this.bookingsRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          endDate: LessThan(today),
        },
        relations: ['user', 'tool'],
      });

      this.logger.log(`Found ${overdueBookings.length} overdue bookings`);

      for (const booking of overdueBookings) {
        try {
          await this.bookingNotificationService.notifyBookingOverdue(booking);
          this.logger.log(`Sent overdue notification for booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to send overdue notification for booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error checking for overdue bookings:', error);
    }
  }

  // Run every hour to check for bookings that should be auto-completed
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteBookings() {
    this.logger.log('Checking for bookings to auto-complete...');
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(23, 59, 59, 999);
    
    try {
      const bookingsToComplete = await this.bookingsRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          endDate: LessThan(threeDaysAgo),
        },
        relations: ['user', 'tool'],
      });

      this.logger.log(`Found ${bookingsToComplete.length} bookings to auto-complete`);

      for (const booking of bookingsToComplete) {
        try {
          booking.status = BookingStatus.COMPLETED;
          await this.bookingsRepository.save(booking);
          
          await this.bookingNotificationService.notifyBookingCompleted(booking);
          this.logger.log(`Auto-completed booking ${booking.id}`);
        } catch (error) {
          this.logger.error(`Failed to auto-complete booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error auto-completing bookings:', error);
    }
  }

  // Manual method to send payment notifications
  async notifyPaymentReceived(bookingId: string): Promise<void> {
    try {
      const booking = await this.bookingsRepository.findOne({
        where: { id: bookingId },
        relations: ['user', 'tool'],
      });

      if (booking) {
        await this.bookingNotificationService.notifyPaymentReceived(booking);
        this.logger.log(`Sent payment received notification for booking ${bookingId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send payment notification for booking ${bookingId}:`, error);
      throw error;
    }
  }

  // Manual method to send payment failed notifications
  async notifyPaymentFailed(bookingId: string): Promise<void> {
    try {
      const booking = await this.bookingsRepository.findOne({
        where: { id: bookingId },
        relations: ['user', 'tool'],
      });

      if (booking) {
        await this.bookingNotificationService.notifyPaymentFailed(booking);
        this.logger.log(`Sent payment failed notification for booking ${bookingId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send payment failed notification for booking ${bookingId}:`, error);
      throw error;
    }
  }
}