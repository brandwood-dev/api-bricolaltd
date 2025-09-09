import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { NotificationType } from '../notifications/enums/notification-type';
import { NotificationType as AdminNotificationType, NotificationPriority as AdminNotificationPriority, NotificationCategory as AdminNotificationCategory } from '../admin/dto/admin-notifications.dto';

@Injectable()
export class BookingNotificationsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    private notificationsService: NotificationsService,
    private adminNotificationsService: AdminNotificationsService,
  ) {}

  // Notifications pour les utilisateurs
  async notifyBookingCreated(booking: Booking): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } })
    ]);

    if (!renter || !tool) return;
    
    // Récupérer le propriétaire de l'outil
    const owner = await this.userRepository.findOne({ where: { id: tool.ownerId } });
    if (!owner) return;

    // Notification au locataire
    await this.notificationsService.create({
      userId: renter.id,
      title: 'Réservation créée',
      message: `Votre réservation pour "${tool.title}" a été créée avec succès.`,
      type: NotificationType.BOOKING_CREATED,
      relatedId: booking.id,
      relatedType: 'booking'
    });

    // Notification au propriétaire
    await this.notificationsService.create({
      userId: owner.id,
      title: 'Nouvelle réservation',
      message: `${renter.firstName} ${renter.lastName} a réservé votre outil "${tool.title}".`,
      type: NotificationType.BOOKING_CREATED,
      relatedId: booking.id,
      relatedType: 'booking'
    });

    // Notification admin
    await this.adminNotificationsService.createAdminNotification({
      title: 'Nouvelle réservation',
      message: `Réservation #${booking.id} créée pour "${tool.title}" (${booking.totalPrice}€)`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.BOOKING,
      metadata: {
        bookingId: booking.id,
        amount: booking.totalPrice,
        toolName: tool.title
      }
    });
  }

  async notifyBookingConfirmed(booking: Booking): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } })
    ]);

    if (!renter || !tool) return;
    
    const owner = await this.userRepository.findOne({ where: { id: tool.ownerId } });
    if (!owner) return;

    // Notification au locataire
    await this.notificationsService.create({
      userId: renter.id,
      title: 'Réservation confirmée',
      message: `Votre réservation pour "${tool.title}" a été confirmée par le propriétaire.`,
      type: NotificationType.BOOKING_CONFIRMED,
      relatedId: booking.id,
      relatedType: 'booking'
    });

    // Notification au propriétaire
    await this.notificationsService.create({
      userId: owner.id,
      title: 'Réservation confirmée',
      message: `Vous avez confirmé la réservation de ${renter.firstName} ${renter.lastName}.`,
      type: NotificationType.BOOKING_CONFIRMED,
      relatedId: booking.id,
      relatedType: 'booking'
    });
  }

  async notifyBookingCancelled(booking: Booking, cancelledBy: 'client' | 'provider'): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } })
    ]);

    if (!renter || !tool) return;
    
    const owner = await this.userRepository.findOne({ where: { id: tool.ownerId } });
    if (!owner) return;

    const cancellerName = cancelledBy === 'client' ? `${renter.firstName} ${renter.lastName}` : `${owner.firstName} ${owner.lastName}`;
    const otherParty = cancelledBy === 'client' ? owner : renter;

    // Notification à l'autre partie
    await this.notificationsService.create({
      userId: otherParty.id,
      title: 'Réservation annulée',
      message: `La réservation pour "${tool.title}" a été annulée par ${cancellerName}.`,
      type: NotificationType.BOOKING_CANCELLED,
      relatedId: booking.id,
      relatedType: 'booking'
    });

    // Notification admin si montant élevé
    if (booking.totalPrice > 500) {
      await this.adminNotificationsService.createAdminNotification({
        title: 'Annulation de réservation',
        message: `Réservation #${booking.id} annulée par ${cancelledBy} (${booking.totalPrice}€)`,
        type: AdminNotificationType.WARNING,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.BOOKING,
        metadata: {
          bookingId: booking.id,
          cancelledBy,
          amount: booking.totalPrice
        }
      });
    }
  }

  async notifyBookingCompleted(booking: Booking): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } })
    ]);

    if (!renter || !tool) return;
    
    const owner = await this.userRepository.findOne({ where: { id: tool.ownerId } });
    if (!owner) return;

    // Notification au locataire pour évaluation
    await this.notificationsService.create({
      userId: renter.id,
      title: 'Location terminée',
      message: `Votre location de "${tool.title}" est terminée. N'oubliez pas de laisser un avis !`,
      type: NotificationType.BOOKING_COMPLETED,
      relatedId: booking.id,
      relatedType: 'booking'
    });

    // Notification au propriétaire
    await this.notificationsService.create({
      userId: owner.id,
      title: 'Location terminée',
      message: `La location de votre outil "${tool.title}" par ${renter.firstName} ${renter.lastName} est terminée.`,
      type: NotificationType.BOOKING_COMPLETED,
      relatedId: booking.id,
      relatedType: 'booking'
    });
  }

  async notifyPaymentReceived(booking: Booking): Promise<void> {
    const tool = await this.toolRepository.findOne({ where: { id: booking.toolId } });
    if (!tool) return;
    
    const owner = await this.userRepository.findOne({ where: { id: tool.ownerId } });
    if (!owner) return;

    await this.notificationsService.create({
      userId: owner.id,
      title: 'Paiement reçu',
      message: `Le paiement pour la location de "${tool.title}" a été traité (${booking.totalPrice}€).`,
      type: NotificationType.PAYMENT_RECEIVED,
      relatedId: booking.id,
      relatedType: 'booking'
    });
  }




}