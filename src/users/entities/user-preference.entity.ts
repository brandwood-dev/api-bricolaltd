import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'user_preferences' })
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'language', type: 'varchar', length: 10, default: 'fr' })
  language: string;

  @Column({ name: 'theme', type: 'varchar', length: 20, default: 'light' })
  theme: string;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'EUR' })
  currency: string;

  @Column({ name: 'distance_unit', type: 'varchar', length: 10, default: 'km' })
  distanceUnit: string;

  @Column({ name: 'email_notifications', type: 'boolean', default: true })
  emailNotifications: boolean;

  @Column({ name: 'push_notifications', type: 'boolean', default: true })
  pushNotifications: boolean;

  @Column({ name: 'sms_notifications', type: 'boolean', default: false })
  smsNotifications: boolean;

  @Column({ name: 'marketing_emails', type: 'boolean', default: true })
  marketingEmails: boolean;

  @Column({ name: 'show_online_status', type: 'boolean', default: true })
  showOnlineStatus: boolean;

  @Column({ name: 'search_radius_km', type: 'integer', default: 50 })
  searchRadiusKm: number;
}
