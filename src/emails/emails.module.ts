import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Email } from './entities/email.entity';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { EmailSenderService } from './email-sender.service';
import { SendGridService } from './sendgrid.service';

@Module({
  imports: [TypeOrmModule.forFeature([Email]), ConfigModule],
  controllers: [EmailsController],
  providers: [EmailsService, EmailSenderService, SendGridService],
  exports: [EmailsService, EmailSenderService, SendGridService],
})
export class EmailsModule {}
