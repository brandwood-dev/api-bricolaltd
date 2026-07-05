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
      'Réservation créée',
      `Votre demande de réservation pour "${tool.title}" a été soumise et est en attente de confirmation.`,
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
      'Nouvelle demande de réservation',
      `${renter.firstName} ${renter.lastName} souhaite réserver votre outil "${tool.title}" du ${this.formatDate(booking.startDate)} au ${this.formatDate(booking.endDate)}.`,
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
      'Réservation acceptée',
      `Votre réservation pour "${tool.title}" a été acceptée ! Code de validation: ${validationCode}. Présentez ce code lors de la récupération.`,
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
      'Réservation acceptée',
      `Vous avez accepté la réservation de "${tool.title}" pour ${renter.firstName} ${renter.lastName}. Code de validation généré: ${validationCode}`,
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
      'Réservation commencée',
      `Votre réservation pour "${tool.title}" a commencé ! Profitez bien de votre location.`,
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
      'Réservation commencée',
      `La réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} a commencé.`,
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
      'Réservation terminée',
      `Votre réservation pour "${tool.title}" est maintenant terminée. N'oubliez pas de laisser un avis !`,
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
      'Réservation terminée',
      `La réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} est maintenant terminée.`,
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
        'Rappel de récupération',
        `N'oubliez pas de récupérer "${tool.title}" demain (${this.formatDate(booking.startDate)}).`,
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
        'Rappel de remise',
        `Rappel: ${renter.firstName} ${renter.lastName} doit récupérer "${tool.title}" demain.`,
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
        'Rappel de retour',
        `N'oubliez pas de retourner "${tool.title}" demain (${this.formatDate(booking.endDate)}).`,
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
        'Rappel de retour',
        `Rappel: ${renter.firstName} ${renter.lastName} doit retourner "${tool.title}" demain.`,
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
      'Retour en retard',
      `Votre réservation pour "${tool.title}" est en retard. Veuillez retourner l'outil dès que possible.`,
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
      'Retour en retard',
      `La réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} est en retard.`,
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
      'Paiement confirmé',
      `Votre paiement pour la réservation de "${tool.title}" a été confirmé.`,
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
      'Paiement reçu',
      `Le paiement pour la réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} a été reçu.`,
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
      'Échec du paiement',
      `Le paiement pour votre réservation de "${tool.title}" a échoué. Veuillez réessayer.`,
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
      'Outil retourné',
      `${renter.firstName} ${renter.lastName} a confirmé le retour de "${tool.title}".${notes ? ` Notes: ${notes}` : ''}`,
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
      'Retour confirmé',
      `Vous avez confirmé le retour de "${tool.title}". Merci pour votre location !`,
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
      "Paiement d'acompte requis",
      `Votre réservation pour "${tool.title}" nécessite un paiement d'acompte. Veuillez effectuer le paiement pour confirmer votre réservation.`,
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
      'Réservation annulée - Acompte impayé',
      `Votre réservation pour "${tool.title}" a été automatiquement annulée car l'acompte n'a pas été payé dans les délais.`,
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
      'Réservation annulée - Acompte impayé',
      `La réservation de ${renter.firstName} ${renter.lastName} pour "${tool.title}" a été automatiquement annulée car l'acompte n'a pas été payé.`,
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
      'Acompte payé avec succès',
      `Votre acompte pour la réservation de "${tool.title}" a été payé avec succès. Votre réservation est maintenant confirmée.`,
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
      'Acompte reçu',
      `L'acompte pour la réservation de ${renter.firstName} ${renter.lastName} pour "${tool.title}" a été reçu. La réservation est confirmée.`,
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
