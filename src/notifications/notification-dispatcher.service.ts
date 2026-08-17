import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './entities/notification.entity';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { FcmPushService } from './fcm-push.service';

type ExpoPushResult = {
  id?: string;
  status?: 'ok' | 'error';
  details?: {
    error?: string;
    errorSubtype?: string;
  };
  message?: string;
};

type ExpoPushReceipt = {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
    errorSubtype?: string;
    sentAt?: number;
    deliveredAt?: number;
    openedAt?: number;
    /** ISO error categories from Expo Push Receipts docs */
    apnsErrorCode?: string;
    fcmErrorCode?: string;
  };
  __internalToken?: PushDeviceToken | null;
};

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly expoPushV1Url = 'https://exp.host/--/api/v2/push/send';
  private readonly expoPushV2Url = 'https://api.expo.dev/v2/push/send';

  constructor(
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
    @InjectRepository(PushDeviceToken)
    private readonly pushDeviceTokenRepository: Repository<PushDeviceToken>,
    @InjectRepository(UserPreference)
    private readonly userPreferenceRepository: Repository<UserPreference>,
    private readonly fcmPushService: FcmPushService,
  ) {}

  private getExpoAccessToken(): string | null {
    const fromEnv = String(
      process.env.EXPO_ACCESS_TOKEN ?? process.env.EXPO_PUSH_ACCESS_TOKEN ?? '',
    ).trim();
    return fromEnv.length > 0 ? fromEnv : null;
  }

  async dispatchNotification(
    notification: Notification,
    unreadCount: number,
  ): Promise<void> {
    this.logger.log(
      `Dispatch notification id=${notification.id} user=${notification.userId} type=${notification.type} titlePreview=${String(notification.title ?? '').slice(0, 60)}`,
    );

    try {
      await this.notificationsGateway.emitNotificationToUser(
        notification.userId,
        notification,
        unreadCount,
      );
    } catch (gatewayError) {
      this.logger.warn(
        `Failed to emit websocket notification for user ${notification.userId}: ${gatewayError instanceof Error ? gatewayError.message : String(gatewayError)}`,
      );
    }

    try {
      await this.sendRemotePush(notification);
    } catch (error) {
      this.logger.warn(
        `sendRemotePush uncaught error for user ${notification.userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async sendRemotePush(notification: Notification): Promise<void> {
    if (!notification.userId) return;

    const preference = await this.userPreferenceRepository.findOne({
      where: { userId: notification.userId },
      select: ['userId', 'pushNotifications'],
    });

    if (preference && preference.pushNotifications === false) {
      this.logger.debug(
        `Skipping remote push for user ${notification.userId} due to preference pushNotifications=false`,
      );
      return;
    }

    const tokens = await this.pushDeviceTokenRepository.find({
      where: {
        userId: notification.userId,
        isActive: true,
      },
    });

    this.logger.log(
      `Found ${tokens.length} active push tokens for user ${notification.userId}`,
    );

    if (tokens.length === 0) return;

    const validExpoTokens = tokens.filter((token) =>
      /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token.expoPushToken),
    );

    this.logger.log(
      `${validExpoTokens.length}/${tokens.length} tokens match ExpoPushToken format`,
    );

    if (validExpoTokens.length === 0) return;

    const messages = validExpoTokens.map((token) => ({
      to: token.expoPushToken,
      title: String(notification.title ?? '').slice(0, 120),
      body: String(notification.message ?? '').slice(0, 240),
      sound: 'default',
      priority: 'high',
      channelId: 'bricola_main',
      badge: 0,
      ttl: 2_419_200,
      expiration: Math.floor(Date.now() / 1000) + 2_419_200,
      mutableContent: true,
      contentAvailable: true,
      _contentAvailable: true,
      data: {
        notificationId: notification.id,
        notificationType: notification.type ?? '',
        relatedType: notification.relatedType ?? '',
        relatedId: notification.relatedId ?? '',
        relatedLink: notification.link ?? '',
      },
    }));

    const accessToken = this.getExpoAccessToken();
    const useExpoV2 = accessToken !== null;

    const endpoint = useExpoV2 ? this.expoPushV2Url : this.expoPushV1Url;

    this.logger.log(
      `Sending ${messages.length} Expo push messages via ${useExpoV2 ? 'V2 (api.expo.dev + Bearer)' : 'V1 (exp.host, no bearer)'} endpoint ${endpoint}`,
    );

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (useExpoV2 && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        this.logger.warn(
          'EXPO_ACCESS_TOKEN not set (env). Falling back to legacy Expo Push V1 endpoint. For SDK 54+, set EXPO_ACCESS_TOKEN to guarantee deliverability.',
        );
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      const responseText = await response.text().catch(() => '');
      let payload: { data?: ExpoPushResult[] } | null = null;
      try {
        if (responseText && responseText.trim().length > 0) {
          payload = JSON.parse(responseText) as any;
        }
      } catch {
        payload = null;
      }

      if (!response.ok) {
        this.logger.warn(
          `Expo push HTTP ${response.status} for user ${notification.userId}: ${responseText.slice(0, 500)}`,
        );

        if (response.status === 401 && useExpoV2) {
          this.logger.error(
            'Expo Push V2 returned 401 Unauthorized: your EXPO_ACCESS_TOKEN is invalid or expired. Create one at https://expo.dev/accounts/[your-account]/settings/access-tokens and set EXPO_ACCESS_TOKEN in backend env.',
          );
        } else if (response.status === 403 && useExpoV2) {
          this.logger.error(
            'Expo Push V2 returned 403 Forbidden: your EXPO_ACCESS_TOKEN may lack push scopes, or the EAS projectId in app.json does not match this account.',
          );
        }
      } else {
        this.logger.log(`Expo push request succeeded HTTP ${response.status}`);
      }

      const results = Array.isArray(payload?.data) ? payload.data : [];

      if (results.length === 0) {
        this.logger.warn(
          'Expo push response did not contain a per-token results array; cannot update token statuses. Raw body first 600 chars:',
          responseText.slice(0, 600),
        );
        return;
      }

      const summary = {
        ok: 0,
        error: 0,
        deviceNotRegistered: 0,
        invalidToken: 0,
        miscError: 0,
      };

      const receiptIdToToken: Record<string, PushDeviceToken> = {};

      await Promise.all(
        results.map(async (result, index) => {
          const token = validExpoTokens[index];
          if (!token) return;

          const receiptId = result?.id;
          if (receiptId) {
            receiptIdToToken[receiptId] = token;
          }

          this.logger.verbose?.(
            `Expo push token result tokenId=${token.id} tokenPreview=${token.expoPushToken.slice(0, 24)}... receiptId=${receiptId ?? 'none'} status=${result?.status ?? 'unknown'}`,
          );

          if (result?.status === 'ok') {
            summary.ok += 1;
            if (token.lastError) {
              await this.pushDeviceTokenRepository.update(token.id, {
                lastError: null,
              });
            }
            return;
          }

          summary.error += 1;

          const errorCode = result?.details?.error;
          const errorMessage = result?.message || errorCode || 'unknown_error';

          this.logger.warn(
            `Expo push token ${token.expoPushToken.slice(0, 24)}... for user ${token.userId} failed: error=${errorCode} message=${errorMessage}`,
          );

          if (
            errorCode === 'DeviceNotRegistered' ||
            errorCode === 'InvalidCredentials' ||
            errorCode === 'InvalidPushToken' ||
            errorCode === 'PUSH_TOO_MANY_EXPERIENCE_IDS' ||
            errorCode === 'MESSAGE_TOO_BIG'
          ) {
            if (errorCode === 'DeviceNotRegistered')
              summary.deviceNotRegistered += 1;
            if (
              errorCode === 'InvalidCredentials' ||
              errorCode === 'InvalidPushToken'
            )
              summary.invalidToken += 1;

            await this.pushDeviceTokenRepository.update(token.id, {
              isActive: false,
              lastError: errorMessage,
            });
            return;
          }

          summary.miscError += 1;
          await this.pushDeviceTokenRepository.update(token.id, {
            lastError: errorMessage,
          });
        }),
      );

      const receiptIds = Object.keys(receiptIdToToken);

      this.logger.log(
        `Expo push summary user=${notification.userId}: ok=${summary.ok}, error=${summary.error} (DeviceNotRegistered=${summary.deviceNotRegistered}, invalidTokens=${summary.invalidToken}, misc=${summary.miscError}). receiptIds=${receiptIds.length > 0 ? receiptIds.join(',') : 'none'}`,
      );

      if (receiptIds.length > 0 && useExpoV2) {
        const delayMs = 12_000;
        this.logger.log(
          `[Receipts] Scheduling deferred Expo Push Receipts lookup in ${delayMs}ms for ${receiptIds.length} receipt(s): ${receiptIds.join(',')}`,
        );
        const notificationIdForLog = notification.id;
        const userIdForLog = notification.userId;
        const clonedMap: Record<string, PushDeviceToken> = {};
        for (const rid of receiptIds) clonedMap[rid] = receiptIdToToken[rid];
        setTimeout(() => {
          this.lookupExpoPushReceipts(receiptIds, clonedMap, {
            notificationId: notificationIdForLog,
            userId: userIdForLog,
          }).catch((err) => {
            this.logger.warn(
              `[Receipts] Deferred lookup failed for user ${userIdForLog}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }, delayMs).unref?.();
      } else if (receiptIds.length === 0 && useExpoV2) {
        this.logger.warn(
          '[Receipts] Expo V2 response did not include receipt ids; cannot inspect deferred FCM/APNs errors via Receipts API. This usually indicates the V2 response format has changed.',
        );
      }

      if (summary.ok === 0 && validExpoTokens.length > 0) {
        this.logger.warn(
          `NO Expo push succeeded for user ${notification.userId} (${validExpoTokens.length} eligible tokens). Attempting Firebase FCM direct push fallback if available. Platform tokens=${JSON.stringify(validExpoTokens.map((t) => ({ id: t.id, platform: t.platform })))}`,
        );
        await this.attemptFcmFallback(notification, validExpoTokens);
      }
    } catch (error) {
      this.logger.warn(
        `Expo push dispatch fetch failed for user ${notification.userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async lookupExpoPushReceipts(
    receiptIds: string[],
    receiptIdToToken: Record<string, PushDeviceToken>,
    context: { notificationId?: string; userId?: string },
  ): Promise<void> {
    if (receiptIds.length === 0) return;
    const accessToken = this.getExpoAccessToken();
    if (!accessToken) {
      this.logger.warn(
        `[Receipts] Skipping lookup for user ${context.userId ?? '?'} notification ${context.notificationId ?? '?'}: no EXPO_ACCESS_TOKEN (V2 required).`,
      );
      return;
    }

    const endpoint = 'https://api.expo.dev/v2/push/getReceipts';
    const body = JSON.stringify({ ids: receiptIds });

    let resp: globalThis.Response | null = null;
    let text = '';
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });
      text = await resp.text().catch(() => '');
    } catch (err) {
      this.logger.warn(
        `[Receipts] HTTP fetch failure for user ${context.userId ?? '?'}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    let parsed: { data?: Record<string, ExpoPushReceipt>; errors?: any[] } = {};
    try {
      parsed = text && text.trim().length > 0 ? JSON.parse(text) : {};
    } catch {
      this.logger.warn(
        `[Receipts] Non-JSON response for user ${context.userId ?? '?'}: ${text.slice(0, 400)}`,
      );
      return;
    }

    if (!resp || !resp.ok) {
      this.logger.warn(
        `[Receipts] HTTP ${resp?.status ?? 'no-resp'} for user ${context.userId ?? '?'}: ${text.slice(0, 600)}`,
      );
      return;
    }

    const receipts = parsed?.data ?? {};
    const receiptEntries = Object.entries(receipts);

    if (receiptEntries.length === 0) {
      this.logger.warn(
        `[Receipts] Empty data map for user ${context.userId ?? '?'} receiptIds=${receiptIds.join(',')}. Raw first 600 chars: ${text.slice(0, 600)}`,
      );
      return;
    }

    let okCount = 0;
    let errCount = 0;

    await Promise.all(
      receiptEntries.map(async ([receiptId, receipt]) => {
        const token = receiptIdToToken[receiptId];
        if (!token) return;

        const status = receipt?.status;
        const errCode =
          receipt?.details?.error ??
          receipt?.details?.fcmErrorCode ??
          receipt?.details?.apnsErrorCode;
        const errMessage = receipt?.message;

        if (status === 'ok') {
          okCount += 1;
          this.logger.log(
            `[Receipts] OK receiptId=${receiptId} tokenId=${token.id} tokenPreview=${token.expoPushToken.slice(0, 24)}... user=${token.userId} notification=${context.notificationId ?? '?'} details=${JSON.stringify(receipt.details ?? {})}`,
          );
          return;
        }

        errCount += 1;
        const receiptSummary = `[Receipts] ERROR receiptId=${receiptId} tokenId=${token.id} tokenPreview=${token.expoPushToken.slice(0, 24)}... user=${token.userId} notification=${context.notificationId ?? '?'} status=${status} error=${errCode ?? 'unknown'} message=${errMessage ?? 'none'} details=${JSON.stringify(receipt.details ?? {})}`;

        this.logger.warn(receiptSummary);

        const finalErrorCode = String(errCode ?? '').toLowerCase();
        const isFatal =
          finalErrorCode.includes('devicenotregistered') ||
          finalErrorCode.includes('invalidcredentials') ||
          finalErrorCode.includes('invalidpushtoken') ||
          finalErrorCode.includes('mismatchsenderid') ||
          finalErrorCode.includes('invalidapnscredential') ||
          finalErrorCode.includes('push_too_many_experience_ids') ||
          finalErrorCode.includes('messagetoobig') ||
          finalErrorCode.includes('messagetoo');

        const storedErr =
          `${receiptSummary.slice(0, 900)}` +
          (receiptSummary.length > 900 ? '…' : '');

        if (isFatal) {
          this.logger.warn(
            `[Receipts] Marking token inactive tokenId=${token.id} due to fatal error=${errCode}`,
          );
          await this.pushDeviceTokenRepository.update(token.id, {
            isActive: false,
            lastError: storedErr,
          });
          return;
        }

        await this.pushDeviceTokenRepository.update(token.id, {
          lastError: storedErr,
        });
      }),
    );

    this.logger.log(
      `[Receipts] Summary user=${context.userId ?? '?'} notification=${context.notificationId ?? '?'}: ok=${okCount}, errors=${errCount}, receiptsEvaluated=${receiptEntries.length}`,
    );
  }

  private async attemptFcmFallback(
    notification: Notification,
    tokens: PushDeviceToken[],
  ): Promise<void> {
    if (!this.fcmPushService.isAvailable()) return;
    const fcmEligible = tokens.filter(
      (t) =>
        t.platform &&
        (t.platform.toLowerCase() === 'android' ||
          t.platform.toLowerCase() === 'ios'),
    );
    if (fcmEligible.length === 0) return;

    this.logger.log(
      `FCM fallback: ${fcmEligible.length} device tokens for user ${notification.userId}. Note: raw FCM device tokens are not stored yet — this path requires a future migration of Expo → native FCM/APNS tokens to fire directly.`,
    );
  }
}
