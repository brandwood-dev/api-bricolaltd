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
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationTemplate]),
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
    NotificationsGateway,
    AdminNotificationsGateway,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    AdminNotificationsGateway,
  ],
})
export class NotificationsModule {}
