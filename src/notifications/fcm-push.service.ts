import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  initializeApp,
  getApps,
  getApp,
  App,
  cert,
  applicationDefault,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmPushService implements OnModuleInit {
  private readonly logger = new Logger(FcmPushService.name);
  private initialized = false;
  private app: App | null = null;

  onModuleInit(): void {
    const hasCredentialsFile =
      process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      String(process.env.GOOGLE_APPLICATION_CREDENTIALS).trim().length > 0;

    const hasBase64ServiceAccount =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 &&
      String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64).trim().length >
        0;

    if (!hasCredentialsFile && !hasBase64ServiceAccount) {
      this.logger.warn(
        'Firebase Admin SDK credentials not provided (set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON_BASE64); skipping FCM direct push path',
      );
      return;
    }

    try {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.app = getApp();
        this.initialized = true;
        this.logger.log('Firebase Admin SDK reusing existing default app');
        return;
      }

      if (hasBase64ServiceAccount) {
        const raw = Buffer.from(
          String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64).trim(),
          'base64',
        ).toString('utf8');
        const serviceAccount = JSON.parse(raw) as ServiceAccount;
        this.app = initializeApp({
          credential: cert(serviceAccount),
        });
      } else {
        this.app = initializeApp({
          credential: applicationDefault(),
        });
      }

      this.initialized = true;
      this.logger.log(
        'Firebase Admin SDK initialized successfully (FCM direct push enabled)',
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase Admin SDK: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  isAvailable(): boolean {
    return this.initialized && this.app !== null;
  }

  async sendToFcmToken(params: {
    fcmToken: string;
    title: string;
    body: string;
    channelId?: string;
    sound?: string;
    data?: Record<string, string>;
  }): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.isAvailable() || !this.app) {
      return { success: false, error: 'fcm_not_initialized' };
    }

    try {
      const messaging = getMessaging(this.app);
      const message = {
        token: params.fcmToken,
        notification: {
          title: params.title,
          body: params.body,
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: params.channelId ?? 'default',
            sound: params.sound ?? 'default',
            clickAction: 'OPEN_APP',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: params.sound ?? 'default',
            },
          },
        },
        data: params.data ?? {},
      };

      const messageId = await messaging.send(message as any);
      return { success: true, messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
