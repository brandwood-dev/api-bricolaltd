import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { PaymentService } from '../../payments/payment.service';
import { RefundsService } from '../../refunds/refunds.service';
import { WalletsService } from '../../wallets/wallets.service';
import { AdminNotificationsService } from '../../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../../admin/dto/admin-notifications.dto';
import {
  RefundStatus,
  RefundReason,
} from '../../refunds/entities/refund.entity';

import { TransactionType } from '../../transactions/enums/transaction-type.enum';

@Injectable()
export class BookingsCancellationService {
  private readonly logger = new Logger(BookingsCancellationService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private paymentService: PaymentService,
    private refundsService: RefundsService,
    private walletsService: WalletsService,
    private adminNotificationsService: AdminNotificationsService,
    private dataSource: DataSource,
  ) {}

  /**
   * Helper to clean up invalid transactions (RENTAL_INCOME, etc.) after cancellation
   */
  private async cleanupBookingTransactions(
    bookingId: string,
    queryRunner: any,
  ): Promise<void> {
    try {
      this.logger.log(
        `Cleaning up internal transactions for booking ${bookingId}`,
      );
      // Delete internal transactions that are no longer valid
      // We keep PAYMENT and REFUND types as they represent real money movement
      // We delete RENTAL_INCOME (owner revenue) and similar internal records
      await queryRunner.manager.delete(Transaction, {
        bookingId: bookingId,
        type: TransactionType.RENTAL_INCOME,
      });
      this.logger.log(
        `Internal transactions cleanup completed for ${bookingId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup transactions for ${bookingId}: ${error.message}`,
      );
      // Don't throw, as this is a cleanup operation
    }
  }

  /**
   * Cancel a booking by Renter
   * Handles refund logic based on 24h rule
   */
  async cancelBookingByRenter(
    bookingId: string,
    userId: string,
    reason?: string,
    message?: string,
  ): Promise<Booking> {
    console.log(
      `[CANCEL_SERVICE] 🚀 Starting Renter Cancellation for booking ${bookingId}`,
    );
    console.log(`[CANCEL_SERVICE] 👤 User: ${userId}`);

    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['tool', 'tool.owner'],
    });

    if (!booking) {
      console.error(`[CANCEL_SERVICE] ❌ Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }

    console.log(
      `[CANCEL_SERVICE] 📦 Booking found: Status=${booking.status}, Start=${booking.startDate}, PaymentIntent=${booking.paymentIntentId}`,
    );

    if (booking.renterId !== userId) {
      console.error(
        `[CANCEL_SERVICE] ❌ User ${userId} is not the renter of ${bookingId}`,
      );
      throw new BadRequestException('You can only cancel your own bookings');
    }

    if (
      ![BookingStatus.PENDING, BookingStatus.ACCEPTED].includes(booking.status)
    ) {
      console.error(
        `[CANCEL_SERVICE] ❌ Invalid status for cancellation: ${booking.status}`,
      );
      throw new BadRequestException(
        'Only pending or accepted bookings can be cancelled',
      );
    }

    // Determine Refund Eligibility
    let shouldRefund = false;
    let refundAmount = 0;

    if (booking.status === BookingStatus.PENDING) {
      // PENDING: 100% Refund
      shouldRefund = true;
      refundAmount = booking.totalPrice;
      console.log(
        `[CANCEL_SERVICE] ℹ️ Booking is PENDING. Eligible for 100% refund.`,
      );
    } else if (booking.status === BookingStatus.ACCEPTED) {
      // ACCEPTED: Check 24h rule
      const pickupDate = new Date(booking.startDate);
      // Parse pickup hour if possible, otherwise default to start of day or specific time
      // Assuming booking.pickupHour is "HH:mm" string
      if (booking.pickupHour) {
        let hours = 0;
        let minutes = 0;

        if (booking.pickupHour instanceof Date) {
          hours = booking.pickupHour.getHours();
          minutes = booking.pickupHour.getMinutes();
        } else if (typeof booking.pickupHour === 'string') {
          const parts = (booking.pickupHour as string).split(':');
          hours = parseInt(parts[0], 10);
          minutes = parseInt(parts[1], 10);
        }

        pickupDate.setHours(hours, minutes, 0, 0);
      }

      const now = new Date();
      const hoursDiff =
        (pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      console.log(
        `[CANCEL_SERVICE] 🕒 Time check: Now=${now.toISOString()}, Pickup=${pickupDate.toISOString()}, Diff=${hoursDiff.toFixed(2)}h`,
      );

      if (hoursDiff >= 24) {
        // > 24h before: 100% Refund
        shouldRefund = true;
        refundAmount = booking.totalPrice;
        console.log(
          `[CANCEL_SERVICE] ✅ > 24h before pickup. Eligible for 100% refund.`,
        );
      } else {
        // < 24h before: 0% Refund (Late cancellation)
        shouldRefund = false;
        refundAmount = 0;
        console.log(
          `[CANCEL_SERVICE] ⚠️ < 24h before pickup. No refund (Late cancellation).`,
        );
      }
    }

    // Process Cancellation and Refund
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Booking Status
      booking.status = BookingStatus.CANCELLED;
      booking.cancellationReason = reason;
      booking.cancellationMessage = message;
      // booking.cancelledAt = new Date(); // Using UpdateDateColumn or similar if needed, but entity has cancelledAt
      if ('cancelledAt' in booking) {
        (booking as any).cancelledAt = new Date();
      }
      // booking.cancelledBy = userId; // Removed as it doesn't exist in entity

      // DO NOT SAVE YET. Wait for payment actions.
      // await queryRunner.manager.save(Booking, booking);
      // console.log(`[CANCEL_SERVICE] 💾 Booking status updated to CANCELLED in DB.`);

      // Handle Payment / Refund
      if (booking.paymentIntentId) {
        console.log(
          `[CANCEL_SERVICE] 💳 Found PaymentIntent: ${booking.paymentIntentId}. Fetching status...`,
        );
        let paymentIntent;
        try {
          if (booking.paymentIntentId.startsWith('pm_')) {
            console.warn(
              `[CANCEL_SERVICE] ⚠️ PaymentIntentId starts with 'pm_', which is a PaymentMethod ID, not a PaymentIntent ID. Stripe cannot find this intent.`,
            );
            throw new Error(
              'Invalid PaymentIntent ID format (PaymentMethod ID stored instead of PaymentIntent ID)',
            );
          }
          paymentIntent = await this.paymentService.getPaymentIntent(
            booking.paymentIntentId,
          );
        } catch (e) {
          console.warn(
            `[CANCEL_SERVICE] ⚠️ Failed to fetch PaymentIntent: ${e.message}`,
          );
          // If it's a 404 from Stripe, maybe it's a test data issue.
          // We should NOT fail the DB transaction if we can't find the payment intent,
          // but we should log it.
          paymentIntent = null;
        }

        if (paymentIntent) {
          console.log(
            `[CANCEL_SERVICE] 💳 PaymentIntent Status: ${paymentIntent.status}`,
          );

          if (paymentIntent.status === 'requires_capture') {
            // If funds are only held (not captured), cancel the hold
            console.log(
              `[CANCEL_SERVICE] 🔄 Payment is 'requires_capture'. Cancelling hold...`,
            );
            await this.paymentService.cancelPaymentIntent(
              booking.paymentIntentId,
            );
            this.logger.log(`Released hold for booking ${bookingId}`);
            console.log(`[CANCEL_SERVICE] ✅ Hold released.`);
          } else if (paymentIntent.status === 'succeeded') {
            // If funds are captured, issue refund if eligible
            console.log(
              `[CANCEL_SERVICE] 💰 Payment is 'succeeded'. Checking refund eligibility...`,
            );
            if (shouldRefund) {
              console.log(
                `[CANCEL_SERVICE] 💸 Initiating refund of £${refundAmount}...`,
              );

              // Find transaction matching the payment intent
              const transaction = await this.transactionRepository.findOne({
                where: {
                  bookingId: booking.id,
                  externalReference: booking.paymentIntentId,
                },
              });

              // Using RefundService to track it properly
              if (transaction) {
                console.log(
                  `[CANCEL_SERVICE] 🧾 Found transaction ${transaction.id}. Creating Refund Request...`,
                );
                await this.refundsService.createRefundRequest(
                  {
                    transactionId: transaction.id,
                    amount: refundAmount,
                    reason: RefundReason.CUSTOMER_REQUEST,
                    reasonDetails: `Renter cancellation: ${reason}`,
                  },
                  userId,
                );

                // Auto-process it since it's automatic rule
                // Find the newly created refund
                const refunds =
                  await this.refundsService.getRefundsByTransactionId(
                    transaction.id,
                  );
                const pendingRefund = refunds.find(
                  (r) => r.status === RefundStatus.PENDING,
                );

                if (pendingRefund) {
                  console.log(
                    `[CANCEL_SERVICE] ⚙️ Processing refund ${pendingRefund.id} automatically...`,
                  );
                  await this.refundsService.processRefund(
                    pendingRefund.id,
                    'SYSTEM_AUTO',
                    '127.0.0.1',
                    'System',
                  );
                  console.log(`[CANCEL_SERVICE] ✅ Refund processed.`);
                }
              } else {
                console.log(
                  `[CANCEL_SERVICE] ⚠️ No transaction record found. Calling Stripe direct refund...`,
                );
                // Fallback if no transaction record but paymentIntent exists (should not happen usually)
                await this.paymentService.createRefund(
                  booking.paymentIntentId,
                  refundAmount,
                );
                console.log(
                  `[CANCEL_SERVICE] ✅ Stripe direct refund completed.`,
                );
              }
              this.logger.log(
                `Refunded £${refundAmount} for booking ${bookingId}`,
              );
            } else {
              // Late cancellation - No Refund
              console.log(
                `[CANCEL_SERVICE] 🛑 Late cancellation. No refund triggered.`,
              );
              this.logger.log(
                `Late cancellation for booking ${bookingId}. No refund issued.`,
              );

              // Optional: Notify Owner they get paid
            }
          } else {
            console.log(
              `[CANCEL_SERVICE] ⚠️ Unhandled PaymentIntent status: ${paymentIntent.status}`,
            );
          }
        }
      } else {
        console.log(
          `[CANCEL_SERVICE] ⚠️ No PaymentIntentId found on booking. Skipping payment logic.`,
        );
      }

      // Save to DB *after* payment actions are successful
      await queryRunner.manager.save(Booking, booking);
      console.log(
        `[CANCEL_SERVICE] 💾 Booking status updated to CANCELLED in DB.`,
      );

      await queryRunner.commitTransaction();
      console.log(
        `[CANCEL_SERVICE] ✅ Transaction committed. Cancellation complete.`,
      );

      // Notify Admin
      await this.adminNotificationsService.createAdminNotification({
        title: 'Booking Cancelled',
        message: `Booking ${booking.id} cancelled by renter. Refund: ${shouldRefund ? 'Yes' : 'No'}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.LOW,
        category: AdminNotificationCategory.BOOKING,
      });

      // Cleanup internal transactions
      await this.cleanupBookingTransactions(booking.id, queryRunner);

      return booking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to cancel booking ${bookingId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reject/Cancel Booking by Owner
   * Always 100% Refund
   */
  async cancelBookingByOwner(
    bookingId: string,
    userId: string,
    reason?: string,
    message?: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.ownerId !== userId) {
      throw new BadRequestException('You can only manage your own bookings');
    }

    // Owner can reject PENDING or cancel ACCEPTED
    const targetStatus =
      booking.status === BookingStatus.PENDING
        ? BookingStatus.REJECTED
        : BookingStatus.CANCELLED;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      booking.status = targetStatus;
      if (targetStatus === BookingStatus.REJECTED) {
        booking.refusalReason = reason;
        booking.refusalMessage = message;
      } else {
        booking.cancellationReason = reason;
        booking.cancellationMessage = message;
        if ('cancelledAt' in booking) {
          (booking as any).cancelledAt = new Date();
        }
        // booking.cancelledBy = userId; // Removed
      }

      await queryRunner.manager.save(Booking, booking);

      // 100% Refund Logic
      if (booking.paymentIntentId) {
        const paymentIntent = await this.paymentService.getPaymentIntent(
          booking.paymentIntentId,
        );

        if (paymentIntent.status === 'requires_capture') {
          await this.paymentService.cancelPaymentIntent(
            booking.paymentIntentId,
          );
          this.logger.log(
            `Released hold for booking ${bookingId} (Owner rejected)`,
          );
        } else if (paymentIntent.status === 'succeeded') {
          // Full Refund

          // Find transaction matching the payment intent
          const transaction = await this.transactionRepository.findOne({
            where: {
              bookingId: booking.id,
              externalReference: booking.paymentIntentId,
            },
          });

          if (transaction) {
            await this.refundsService.createRefundRequest(
              {
                transactionId: transaction.id,
                amount: booking.totalPrice,
                reason:
                  targetStatus === BookingStatus.REJECTED
                    ? RefundReason.TOOL_UNAVAILABLE
                    : RefundReason.BOOKING_CANCELLATION,
                reasonDetails: `Owner ${targetStatus === BookingStatus.REJECTED ? 'rejection' : 'cancellation'}: ${reason}`,
              },
              userId,
            );

            const refunds = await this.refundsService.getRefundsByTransactionId(
              transaction.id,
            );
            const pendingRefund = refunds.find(
              (r) => r.status === RefundStatus.PENDING,
            );
            if (pendingRefund) {
              await this.refundsService.processRefund(
                pendingRefund.id,
                'SYSTEM_AUTO',
              );
            }
          } else {
            await this.paymentService.createRefund(booking.paymentIntentId);
          }
          this.logger.log(
            `Refunded full amount for booking ${bookingId} (Owner action)`,
          );
        }
      }

      await queryRunner.commitTransaction();

      // Cleanup internal transactions
      const cleanupRunner = this.dataSource.createQueryRunner();
      await cleanupRunner.connect();
      await this.cleanupBookingTransactions(booking.id, cleanupRunner);
      await cleanupRunner.release();

      return booking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to process owner cancellation for ${bookingId}`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel Booking by Admin (Force Cancel)
   * Always 100% Refund
   */
  async cancelBookingByAdmin(
    bookingId: string,
    reason?: string,
    message?: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Admin can cancel any booking status except already cancelled/completed
    if (
      [BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(
        booking.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot cancel booking in status ${booking.status}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      booking.status = BookingStatus.CANCELLED;
      booking.cancellationReason = reason || 'Cancelled by admin';
      booking.cancellationMessage = message;
      if ('cancelledAt' in booking) {
        (booking as any).cancelledAt = new Date();
      }

      await queryRunner.manager.save(Booking, booking);

      // 100% Refund Logic (Same as Owner)
      if (booking.paymentIntentId) {
        let paymentIntent;
        try {
          if (!booking.paymentIntentId.startsWith('pm_')) {
            paymentIntent = await this.paymentService.getPaymentIntent(
              booking.paymentIntentId,
            );
          }
        } catch (e) {
          this.logger.warn(`Failed to fetch payment intent: ${e.message}`);
        }

        if (paymentIntent) {
          if (paymentIntent.status === 'requires_capture') {
            await this.paymentService.cancelPaymentIntent(
              booking.paymentIntentId,
            );
            this.logger.log(
              `Released hold for booking ${bookingId} (Admin cancelled)`,
            );
          } else if (paymentIntent.status === 'succeeded') {
            // Full Refund
            const transaction = await this.transactionRepository.findOne({
              where: {
                bookingId: booking.id,
                externalReference: booking.paymentIntentId,
              },
            });

            if (transaction) {
              await this.refundsService.createRefundRequest(
                {
                  transactionId: transaction.id,
                  amount: booking.totalPrice,
                  reason: RefundReason.ADMIN_DECISION,
                  reasonDetails: `Admin cancellation: ${reason}`,
                },
                'ADMIN', // System/Admin user
              );

              const refunds =
                await this.refundsService.getRefundsByTransactionId(
                  transaction.id,
                );
              const pendingRefund = refunds.find(
                (r) => r.status === RefundStatus.PENDING,
              );
              if (pendingRefund) {
                await this.refundsService.processRefund(
                  pendingRefund.id,
                  'SYSTEM_AUTO',
                );
              }
            } else {
              await this.paymentService.createRefund(booking.paymentIntentId);
            }
            this.logger.log(
              `Refunded full amount for booking ${bookingId} (Admin action)`,
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      // Cleanup internal transactions
      const cleanupRunner = this.dataSource.createQueryRunner();
      await cleanupRunner.connect();
      await this.cleanupBookingTransactions(booking.id, cleanupRunner);
      await cleanupRunner.release();

      return booking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to process admin cancellation for ${bookingId}`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
