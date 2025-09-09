import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Email } from './entities/email.entity';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { EmailSenderService } from './email-sender.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Email]),
    ConfigModule,
    UsersModule,
  ],
  controllers: [EmailsController],
  providers: [EmailsService, EmailSenderService],
  exports: [EmailsService, EmailSenderService],
})
export class EmailsModule {}