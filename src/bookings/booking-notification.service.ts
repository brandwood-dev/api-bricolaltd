import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { UsersService } from '../users/users.service';
import { ToolsService } from '../tools/tools.service';

@Injectable()
export class BookingNotificationService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly toolsService: ToolsService,
  ) {}

  private getI18nMetadata(
    titleKey: string,
    messageKey: string,
    translationParams?: Record<string, string | number | boolean>,
  ) {
    return {
      titleKey,
      messageKey,
      translationParams,
    };
  }

  async notifyBookingCreated(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CREATED,
      'Booking created',
      `Your booking request for "${tool.title}" has been submitted and is awaiting confirmation.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_created_renter.title',
        'notifications.content.booking_created_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CREATED,
      'New booking request',
      `${renter.firstName} ${renter.lastName} wants to book your tool "${tool.title}" from ${this.formatDate(booking.startDate)} to ${this.formatDate(booking.endDate)}.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_created_owner.title',
        'notifications.content.booking_created_owner.message',
        {
          userName: `${renter.firstName} ${renter.lastName}`,
          toolName: tool.title,
          startDate: this.formatDate(booking.startDate),
          endDate: this.formatDate(booking.endDate),
        },
      ),
    );
  }

  async notifyBookingConfirmed(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation confirmée',
      `Votre réservation pour "${tool.title}" a été confirmée ! Vous pouvez récupérer l'outil le ${this.formatDate(booking.startDate)}.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_confirmed_renter.title',
        'notifications.content.booking_confirmed_renter.message',
        {
          toolName: tool.title,
          startDate: this.formatDate(booking.startDate),
        },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation confirmée',
      `Vous avez confirmé la réservation de "${tool.title}" pour ${renter.firstName} ${renter.lastName}.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_confirmed_owner.title',
        'notifications.content.booking_confirmed_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
    );
  }

  async notifyBookingAccepted(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);
    const validationCode = booking.validationCode ?? '';

    // Notify renter with validation code
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking accepted',
      `Your booking for "${tool.title}" has been accepted! Validation code: ${validationCode}. Please present this code at pickup.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_accepted_renter.title',
        'notifications.content.booking_accepted_renter.message',
        {
          toolName: tool.title,
          validationCode,
        },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking accepted',
      `You have accepted the booking of "${tool.title}" for ${renter.firstName} ${renter.lastName}.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_accepted_owner.title',
        'notifications.content.booking_accepted_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
          validationCode,
        },
      ),
    );
  }

  async notifyBookingCancelled(
    booking: Booking,
    cancelledBy: 'renter' | 'owner',
    reason?: string,
  ): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    if (cancelledBy === 'renter') {
      // Notify owner
      await this.notificationsService.createSystemNotification(
        tool.ownerId,
        NotificationType.BOOKING_CANCELLED,
        'Réservation annulée',
        `${renter.firstName} ${renter.lastName} a annulé sa réservation pour "${tool.title}".${reason ? ` Raison: ${reason}` : ''}`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
        this.getI18nMetadata(
          'notifications.content.booking_cancelled_owner.title',
          reason
            ? 'notifications.content.booking_cancelled_owner.message_with_reason'
            : 'notifications.content.booking_cancelled_owner.message',
          {
            userName: `${renter.firstName} ${renter.lastName}`,
            toolName: tool.title,
            ...(reason ? { reason } : {}),
          },
        ),
      );
    } else {
      // Notify renter
      await this.notificationsService.createSystemNotification(
        booking.renterId,
        NotificationType.BOOKING_CANCELLED,
        'Réservation annulée',
        `Votre réservation pour "${tool.title}" a été annulée par le propriétaire.${reason ? ` Raison: ${reason}` : ''}`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
        this.getI18nMetadata(
          'notifications.content.booking_cancelled_renter.title',
          reason
            ? 'notifications.content.booking_cancelled_renter.message_with_reason'
            : 'notifications.content.booking_cancelled_renter.message',
          {
            toolName: tool.title,
            ...(reason ? { reason } : {}),
          },
        ),
      );
    }
  }

  async notifyBookingRejected(
    booking: Booking,
    refusalReason?: string,
  ): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CANCELLED,
      'Demande de réservation refusée',
      `Votre demande de réservation pour "${tool.title}" a été refusée.${refusalReason ? ` Raison: ${refusalReason}` : ''}`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_rejected_renter.title',
        refusalReason
          ? 'notifications.content.booking_rejected_renter.message_with_reason'
          : 'notifications.content.booking_rejected_renter.message',
        {
          toolName: tool.title,
          ...(refusalReason ? { reason: refusalReason } : {}),
        },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CANCELLED,
      'Demande de réservation refusée',
      `Vous avez refusé la demande de réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName}.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_rejected_owner.title',
        'notifications.content.booking_rejected_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
    );
  }

  async notifyBookingStarted(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking started',
      `Your booking for "${tool.title}" has started! Enjoy your rental.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_started_renter.title',
        'notifications.content.booking_started_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking started',
      `The booking of "${tool.title}" by ${renter.firstName} ${renter.lastName} has started.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_started_owner.title',
        'notifications.content.booking_started_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
    );
  }

  async notifyBookingCompleted(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_COMPLETED,
      'Booking completed',
      `Your booking for "${tool.title}" is now complete. Don't forget to leave a review!`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_completed_renter.title',
        'notifications.content.booking_completed_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_COMPLETED,
      'Booking completed',
      `The booking of "${tool.title}" by ${renter.firstName} ${renter.lastName} is now complete.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_completed_owner.title',
        'notifications.content.booking_completed_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
    );
  }

  async notifyBookingReminder(
    booking: Booking,
    type: 'start' | 'end',
  ): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    if (type === 'start') {
      // Remind renter about pickup
      await this.notificationsService.createSystemNotification(
        booking.renterId,
        NotificationType.BOOKING_REMINDER,
        'Pickup reminder',
        `Don't forget to pick up "${tool.title}" tomorrow (${this.formatDate(booking.startDate)}).`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
        this.getI18nMetadata(
          'notifications.content.booking_pickup_reminder.title',
          'notifications.content.booking_pickup_reminder.message',
          {
            toolName: tool.title,
            startDate: this.formatDate(booking.startDate),
          },
        ),
      );

      // Remind owner about handover
      await this.notificationsService.createSystemNotification(
        tool.ownerId,
        NotificationType.BOOKING_REMINDER,
        'Handover reminder',
        `Reminder: ${renter.firstName} ${renter.lastName} is picking up "${tool.title}" tomorrow.`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
        this.getI18nMetadata(
          'notifications.content.booking_handover_reminder.title',
          'notifications.content.booking_handover_reminder.message',
          {
            userName: `${renter.firstName} ${renter.lastName}`,
            toolName: tool.title,
          },
        ),
      );
    } else {
      // Remind renter about return
      await this.notificationsService.createSystemNotification(
        booking.renterId,
        NotificationType.BOOKING_REMINDER,
        'Return reminder',
        `Don't forget to return "${tool.title}" tomorrow (${this.formatDate(booking.endDate)}).`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
        this.getI18nMetadata(
          'notifications.content.booking_return_reminder.title',
          'notifications.content.booking_return_reminder_renter.message',
          {
            toolName: tool.title,
            endDate: this.formatDate(booking.endDate),
          },
        ),
      );

      // Remind owner about return
      await this.notificationsService.createSystemNotification(
        tool.ownerId,
        NotificationType.BOOKING_REMINDER,
        'Return reminder',
        `Reminder: ${renter.firstName} ${renter.lastName} is returning "${tool.title}" tomorrow.`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
        this.getI18nMetadata(
          'notifications.content.booking_return_reminder.title',
          'notifications.content.booking_return_reminder_owner.message',
          {
            userName: `${renter.firstName} ${renter.lastName}`,
            toolName: tool.title,
          },
        ),
      );
    }
  }

  async notifyBookingOverdue(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_OVERDUE,
      'Late return',
      `Your booking for "${tool.title}" is overdue. Please return the tool as soon as possible.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_overdue_renter.title',
        'notifications.content.booking_overdue_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_OVERDUE,
      'Late return',
      `The booking of "${tool.title}" by ${renter.firstName} ${renter.lastName} is overdue.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_overdue_owner.title',
        'notifications.content.booking_overdue_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
    );
  }

  async notifyPaymentReceived(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.PAYMENT_RECEIVED,
      'Payment confirmed',
      `Your payment for the booking of "${tool.title}" has been confirmed.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.payment_confirmed_renter.title',
        'notifications.content.payment_confirmed_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.PAYMENT_RECEIVED,
      'Payment received',
      `Payment for the booking of "${tool.title}" by ${renter.firstName} ${renter.lastName} has been received.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.payment_received_owner.title',
        'notifications.content.payment_received_owner.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
    );
  }

  async notifyPaymentFailed(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.PAYMENT_FAILED,
      'Payment failed',
      `Payment for your booking of "${tool.title}" failed. Please try again.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.payment_failed.title',
        'notifications.content.payment_failed.message',
        { toolName: tool.title },
      ),
    );
  }

  async notifyToolReturned(booking: Booking, notes?: string): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_COMPLETED,
      'Tool returned',
      `${renter.firstName} ${renter.lastName} has confirmed the return of "${tool.title}".${notes ? ` Notes: ${notes}` : ''}`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.tool_returned_owner.title',
        notes
          ? 'notifications.content.tool_returned_owner.message_with_notes'
          : 'notifications.content.tool_returned_owner.message',
        {
          userName: `${renter.firstName} ${renter.lastName}`,
          toolName: tool.title,
          ...(notes ? { notes } : {}),
        },
      ),
    );

    // Notify renter (confirmation)
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_COMPLETED,
      'Return confirmed',
      `You have confirmed the return of "${tool.title}". Thanks for your rental!`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.return_confirmed_renter.title',
        'notifications.content.return_confirmed_renter.message',
        { toolName: tool.title },
      ),
    );
  }

  async notifyDepositReminder(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);

    // Notify renter about deposit payment requirement
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.PAYMENT_REMINDER,
      'Deposit payment required',
      `Your booking for "${tool.title}" requires a deposit payment. Please complete the payment to confirm your booking.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}/deposit`,
      this.getI18nMetadata(
        'notifications.content.deposit_required.title',
        'notifications.content.deposit_required.message',
        { toolName: tool.title },
      ),
    );
  }

  async notifyDepositOverdue(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter about cancelled booking due to unpaid deposit
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CANCELLED,
      'Booking cancelled - Unpaid deposit',
      `Your booking for "${tool.title}" has been automatically cancelled because the deposit was not paid on time.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.deposit_overdue_cancelled.title',
        'notifications.content.deposit_overdue_cancelled_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner about cancelled booking
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CANCELLED,
      'Booking cancelled - Unpaid deposit',
      `The booking by ${renter.firstName} ${renter.lastName} for "${tool.title}" has been automatically cancelled because the deposit was not paid.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.deposit_overdue_cancelled.title',
        'notifications.content.deposit_overdue_cancelled_owner.message',
        {
          userName: `${renter.firstName} ${renter.lastName}`,
          toolName: tool.title,
        },
      ),
    );
  }

  async notifyDepositPaid(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter about successful deposit payment
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.PAYMENT_RECEIVED,
      'Deposit paid successfully',
      `Your deposit for the booking of "${tool.title}" has been paid successfully. Your booking is now confirmed.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.deposit_paid_renter.title',
        'notifications.content.deposit_paid_renter.message',
        { toolName: tool.title },
      ),
    );

    // Notify owner about deposit payment
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.PAYMENT_RECEIVED,
      'Deposit received',
      `The deposit for the booking of "${tool.title}" by ${renter.firstName} ${renter.lastName} has been received. The booking is now confirmed.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.deposit_received_owner.title',
        'notifications.content.deposit_received_owner.message',
        {
          userName: `${renter.firstName} ${renter.lastName}`,
          toolName: tool.title,
        },
      ),
    );
  }

  async sendBookingCancelledNotification(
    booking: Booking,
    reason?: string,
  ): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter about cancelled booking
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CANCELLED,
      'Réservation annulée',
      `Votre réservation pour "${tool.title}" a été annulée.${reason ? ` Raison: ${reason}` : ''}`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_cancelled_renter.title',
        reason
          ? 'notifications.content.booking_cancelled_renter.message_with_reason'
          : 'notifications.content.booking_cancelled_renter.message',
        {
          toolName: tool.title,
          ...(reason ? { reason } : {}),
        },
      ),
    );

    // Notify owner about cancelled booking
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CANCELLED,
      'Réservation annulée',
      `La réservation de ${renter.firstName} ${renter.lastName} pour "${tool.title}" a été annulée.${reason ? ` Raison: ${reason}` : ''}`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
      this.getI18nMetadata(
        'notifications.content.booking_cancelled_owner.title',
        reason
          ? 'notifications.content.booking_cancelled_owner.message_with_reason'
          : 'notifications.content.booking_cancelled_owner.message',
        {
          userName: `${renter.firstName} ${renter.lastName}`,
          toolName: tool.title,
          ...(reason ? { reason } : {}),
        },
      ),
    );
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }
}
