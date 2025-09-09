import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserSessionController } from './user-session.controller';
import { UserSessionService } from './user-session.service';
import { UserSession } from './entities/user-session.entity';
import { UserActivityController } from './user-activity.controller';
import { UserActivityService } from './user-activity.service';
import { UserActivity } from './entities/user-activity.entity';
import { UserPreferenceController } from './user-preference.controller';
import { UserPreferenceService } from './user-preference.service';
import { CountryController } from './country.controller';
import { CountryService } from './country.service';
import { Country } from './entities/country.entity';
import { UserPreference } from './entities/user-preference.entity';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { AccountDeletionRequestController } from './account-deletion-request.controller';
import { AccountDeletionRequestService } from './account-deletion-request.service';
import { S3Module } from '../common/services/s3.module';
import { FileUploadMiddleware } from '../common/middlewares/file-upload.middleware';
import { SecurityLog } from '../admin/entities/security-log.entity';
import { BlockedIp } from '../admin/entities/blocked-ip.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, 
      Country, 
      UserPreference, 
      UserSession, 
      UserActivity, 
      AccountDeletionRequest,
      SecurityLog,
      BlockedIp,
      Transaction
    ]), 
    S3Module,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [
    UsersController, 
    UserSessionController, 
    UserActivityController, 
    UserPreferenceController,
    CountryController,
    AccountDeletionRequestController
  ],
  providers: [
    UsersService, 
    UserSessionService, 
    UserActivityService, 
    UserPreferenceService,
    CountryService,
    AccountDeletionRequestService
  ],
  exports: [
    UsersService, 
    UserSessionService, 
    UserActivityService, 
    UserPreferenceService,
    CountryService,
    AccountDeletionRequestService
  ],
})
export class UsersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        FileUploadMiddleware.register({
          fieldName: 'profilePicture',
          maxCount: 1,
          isMultiple: false,
        }),
      )
      .forRoutes(
        { path: 'users/:id/upload-profile', method: RequestMethod.POST }
      );
  }
}