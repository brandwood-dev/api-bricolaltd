import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './entities/notification.entity';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { UserPreference } from '../users/entities/user-preference.entity';

type ExpoPushResult = {
  status?: 'ok' | 'error';
  details?: {
    error?: string;
  };
  message?: string;
};

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
    @InjectRepository(PushDeviceToken)
    private readonly pushDeviceTokenRepository: Repository<PushDeviceToken>,
    @InjectRepository(UserPreference)
    private readonly userPreferenceRepository: Repository<UserPreference>,
  ) {}

  async dispatchNotification(
    notification: Notification,
    unreadCount: number,
  ): Promise<void> {
    await this.notificationsGateway.emitNotificationToUser(
      notification.userId,
      notification,
      unreadCount,
    );

    await this.sendRemotePush(notification);
  }

  private async sendRemotePush(notification: Notification): Promise<void> {
    if (!notification.userId) return;

    const preference = await this.userPreferenceRepository.findOne({
      where: { userId: notification.userId },
      select: ['userId', 'pushNotifications'],
    });

    if (preference && preference.pushNotifications === false) {
      return;
    }

    const tokens = await this.pushDeviceTokenRepository.find({
      where: {
        userId: notification.userId,
        isActive: true,
      },
    });

    const validTokens = tokens.filter((token) =>
      /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token.expoPushToken),
    );

    if (validTokens.length === 0) return;

    const messages = validTokens.map((token) => ({
      to: token.expoPushToken,
      title: notification.title,
      body: notification.message,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: {
        notification,
      },
    }));

    try {
      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: ExpoPushResult[] }
        | null;

      if (!response.ok) {
        this.logger.warn(
          `Expo push request failed with status ${response.status} for user ${notification.userId}`,
        );
        return;
      }

      const results = Array.isArray(payload?.data) ? payload.data : [];
      if (results.length === 0) return;

      await Promise.all(
        results.map(async (result, index) => {
          const token = validTokens[index];
          if (!token) return;

          if (result?.status === 'ok') {
            if (token.lastError) {
              await this.pushDeviceTokenRepository.update(token.id, {
                lastError: null,
              });
            }
            return;
          }

          const errorCode = result?.details?.error;
          const errorMessage = result?.message || errorCode || 'unknown_error';

          if (
            errorCode === 'DeviceNotRegistered' ||
            errorCode === 'InvalidCredentials' ||
            errorCode === 'InvalidPushToken'
          ) {
            await this.pushDeviceTokenRepository.update(token.id, {
              isActive: false,
              lastError: errorMessage,
            });
            return;
          }

          await this.pushDeviceTokenRepository.update(token.id, {
            lastError: errorMessage,
          });
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Expo push dispatch failed for user ${notification.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
