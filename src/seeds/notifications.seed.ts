import { DataSource } from 'typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationType } from '../notifications/enums/notification-type';
import { faker } from '@faker-js/faker';

export async function seedNotifications(dataSource: DataSource) {
  console.log('🔔 Seeding notifications...');

  const notificationRepository = dataSource.getRepository(Notification);
  const userRepository = dataSource.getRepository(User);

  const users = await userRepository.find({ where: { isAdmin: false } });

  if (users.length === 0) {
    console.log('⚠️ No users found, skipping notifications seeding');
    return;
  }

  const notificationTypes = Object.values(NotificationType);
  const notificationTemplates = {
    [NotificationType.ACCOUNT_DELETION_REQUEST]: {
      titles: ['Account Deletion Request', 'Demande de suppression reçue'],
      messages: [
        'Your account deletion request has been received.',
        'Votre demande de suppression a été reçue.',
      ],
    },
    [NotificationType.ACCOUNT_DELETION_REQUEST_PENDING]: {
      titles: ['Request Pending', 'Demande en attente'],
      messages: [
        'Your request is pending approval.',
        "Votre demande est en attente d'approbation.",
      ],
    },
    [NotificationType.ACCOUNT_DELETION_REQUEST_APPROVED]: {
      titles: ['Request Approved', 'Demande approuvée'],
      messages: [
        'Your request has been approved.',
        'Votre demande a été approuvée.',
      ],
    },
    [NotificationType.ACCOUNT_DELETION_REQUEST_CANCELLED]: {
      titles: ['Request Cancelled', 'Demande annulée'],
      messages: [
        'Your request has been cancelled.',
        'Votre demande a été annulée.',
      ],
    },
  };

  // Generate 120 realistic notifications
  for (let i = 0; i < 120; i++) {
    const type = faker.helpers.arrayElement(notificationTypes);
    const template = notificationTemplates[type] || {
      titles: ['System Notification', 'Notification système'],
      messages: [
        'You have a new notification.',
        'Vous avez une nouvelle notification.',
      ],
    };

    const notificationData: any = {
      title: faker.helpers.arrayElement(template.titles),
      message: faker.helpers.arrayElement(template.messages),
      type,
      isSystem: faker.datatype.boolean({ probability: 0.6 }),
      isRead: faker.datatype.boolean({ probability: 0.4 }),
    };
    const user = users[i % users.length];

    const existingNotification = await notificationRepository.findOne({
      where: {
        userId: user.id,
        type: notificationData.type,
        title: notificationData.title,
      },
    });

    if (!existingNotification) {
      const notification = notificationRepository.create({
        ...notificationData,
        userId: user.id,
      });
      await notificationRepository.save(notification);
    }
  }

  console.log('✅ Notifications seeded successfully');
}
