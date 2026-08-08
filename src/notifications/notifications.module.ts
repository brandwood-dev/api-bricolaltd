import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { AdminNotificationsGateway } from './admin-notifications.gateway';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { AdminModule } from '../admin/admin.module';
import { UserPreference } from '../users/entities/user-preference.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationTemplate,
      PushDeviceToken,
      UserPreference,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'bricola_secret_key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => AdminModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationsGateway,
    AdminNotificationsGateway,
  ],
  exports: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationsGateway,
    AdminNotificationsGateway,
  ],
})
export class NotificationsModule {}
