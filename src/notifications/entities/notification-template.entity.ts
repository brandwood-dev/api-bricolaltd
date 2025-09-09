import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationType } from '../enums/notification-type';

@Entity({ name: 'notification_templates' })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_type', type: 'enum', enum: NotificationType })
  notificationType: NotificationType;

  @Column({ name: 'title_template', type: 'varchar', length: 255 })
  titleTemplate: string;

  @Column({ name: 'message_template', type: 'longtext' })
  messageTemplate: string;

  @Column({ name: 'language_code', type: 'varchar', length: 10, default: 'fr' })
  languageCode: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'email_subject',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  emailSubject: string | null;

  @Column({ name: 'email_template', type: 'longtext', nullable: true })
  emailTemplate: string | null;

  @Column({
    name: 'sms_template',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  smsTemplate: string | null;
}
