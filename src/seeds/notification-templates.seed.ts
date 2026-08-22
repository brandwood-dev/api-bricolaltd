import { DataSource } from 'typeorm';
import { NotificationTemplate } from '../notifications/entities/notification-template.entity';
import { NotificationType } from '../notifications/enums/notification-type';

export async function seedNotificationTemplates(dataSource: DataSource) {
  console.log('📧 Seeding notification templates...');

  const templateRepository = dataSource.getRepository(NotificationTemplate);

  const templates = [
    {
      notificationType: NotificationType.ACCOUNT_DELETION_REQUEST,
      titleTemplate: 'Demande de suppression de compte',
      messageTemplate:
        'Votre demande de suppression de compte a été reçue et est en cours de traitement.',
      emailSubject: 'Demande de suppression de compte - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre demande de suppression de compte a été reçue. Elle sera traitée dans les plus brefs délais.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.ACCOUNT_DELETION_REQUEST_REJECTED,
      titleTemplate: 'Demande de suppression rejetée',
      messageTemplate:
        'Votre demande de suppression de compte a été rejetée. Raison: {{reason}}',
      emailSubject: 'Demande de suppression rejetée - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre demande de suppression de compte a été rejetée. Raison: {{reason}}',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.ACCOUNT_DELETION_REQUEST_APPROVED,
      titleTemplate: 'Demande de suppression approuvée',
      messageTemplate:
        'Votre demande de suppression de compte a été approuvée. Votre compte sera supprimé dans {{deletionDate}}.',
      emailSubject: 'Demande de suppression approuvée - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre demande de suppression de compte a été approuvée. Votre compte sera définitivement supprimé le {{deletionDate}}.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.ACCOUNT_DELETION_REQUEST_CANCELLED,
      titleTemplate: 'Demande de suppression annulée',
      messageTemplate: 'Votre demande de suppression de compte a été annulée.',
      emailSubject: 'Demande de suppression annulée - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre demande de suppression de compte a été annulée à votre demande.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.ACCOUNT_DELETION_REQUEST_PENDING,
      titleTemplate: 'Demande de suppression en attente',
      messageTemplate:
        'Votre demande de suppression de compte est en attente de validation.',
      emailSubject: 'Demande de suppression en attente - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre demande de suppression de compte est en attente de validation par notre équipe.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.BOOKING_CONFIRMED,
      titleTemplate: 'Réservation confirmée',
      messageTemplate: 'Votre réservation pour {{toolName}} a été confirmée.',
      emailSubject: 'Confirmation de réservation - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre réservation pour {{toolName}} du {{startDate}} au {{endDate}} a été confirmée.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.BOOKING_CANCELLED,
      titleTemplate: 'Réservation annulée',
      messageTemplate: 'Votre réservation pour {{toolName}} a été annulée.',
      emailSubject: 'Annulation de réservation - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre réservation pour {{toolName}} a été annulée.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.PAYMENT_RECEIVED,
      titleTemplate: 'Paiement reçu',
      messageTemplate: 'Vous avez reçu un paiement de {{amount}}€.',
      emailSubject: 'Paiement reçu - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, vous avez reçu un paiement de {{amount}}€ pour {{toolName}}.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.TOOL_APPROVED,
      titleTemplate: 'Tool approved',
      messageTemplate:
        'Votre outil {{toolName}} a été approuvé et est maintenant visible.',
      emailSubject: 'Outil approuvé - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre outil {{toolName}} a été approuvé par notre équipe.',
      languageCode: 'fr',
    },
    {
      notificationType: NotificationType.TOOL_REJECTED,
      titleTemplate: 'Tool rejected',
      messageTemplate:
        'Votre outil {{toolName}} a été rejeté. Raison: {{reason}}',
      emailSubject: 'Outil rejeté - Bricola',
      emailTemplate:
        'Bonjour {{userName}}, votre outil {{toolName}} a été rejeté. Raison: {{reason}}',
      languageCode: 'fr',
    },
  ];

  for (const templateData of templates) {
    const existingTemplate = await templateRepository.findOne({
      where: {
        notificationType: templateData.notificationType,
        languageCode: templateData.languageCode,
      },
    });

    if (!existingTemplate) {
      const template = templateRepository.create(templateData);
      await templateRepository.save(template);
    }
  }

  console.log('✅ Notification templates seeded successfully');
}
