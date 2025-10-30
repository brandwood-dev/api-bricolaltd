import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('admin_notifications')
@Index(['isRead', 'createdAt'])
@Index(['type', 'category'])
@Index(['userId'])
export class AdminNotification {
  @ApiProperty({ description: 'Unique identifier for the admin notification' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Notification title' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Notification message content' })
  @Column({ type: 'longtext' })
  message: string;

  @ApiProperty({ 
    description: 'Type of notification',
    enum: ['info', 'success', 'warning', 'error', 'system']
  })
  @Column({ 
    type: 'enum', 
    enum: ['info', 'success', 'warning', 'error', 'system'],
    default: 'info'
  })
  type: 'info' | 'success' | 'warning' | 'error' | 'system';

  @ApiProperty({ 
    description: 'Priority level of the notification',
    enum: ['low', 'medium', 'high', 'urgent']
  })
  @Column({ 
    type: 'enum', 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  })
  priority: 'low' | 'medium' | 'high' | 'urgent';

  @ApiProperty({ 
    description: 'Category of the notification',
    enum: ['booking', 'user', 'system', 'payment', 'dispute', 'security']
  })
  @Column({ 
    type: 'enum', 
    enum: ['booking', 'user', 'system', 'payment', 'dispute', 'security'],
    default: 'system'
  })
  category: 'booking' | 'user' | 'system' | 'payment' | 'dispute' | 'security';

  @ApiProperty({ description: 'Whether the notification has been read' })
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @ApiProperty({ description: 'Related user ID (if applicable)' })
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ApiProperty({ description: 'Related user name (for display purposes)' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  userName?: string;

  // Metadata column removed to fix row size too large issue
  // @ApiProperty({ description: 'Additional metadata as JSON' })
  // @Column({ type: 'json', nullable: true })
  // metadata?: Record<string, any>;

  @ApiProperty({ description: 'When the notification was read' })
  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @ApiProperty({ description: 'When the notification was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'When the notification was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual properties for frontend
  @ApiProperty({ description: 'Time since creation (computed)' })
  get timeAgo(): string {
    const now = new Date();
    const diffInMs = now.getTime() - this.createdAt.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'À l\'instant';
    } else if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
    } else if (diffInHours < 24) {
      return `Il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
    } else if (diffInDays < 7) {
      return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
    } else {
      return this.createdAt.toLocaleDateString('fr-FR');
    }
  }

  @ApiProperty({ description: 'Formatted creation date' })
  get formattedDate(): string {
    return this.createdAt.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  @ApiProperty({ description: 'Priority weight for sorting' })
  get priorityWeight(): number {
    const weights = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return weights[this.priority] || 1;
  }

  @ApiProperty({ description: 'Whether notification is recent (less than 24h)' })
  get isRecent(): boolean {
    const now = new Date();
    const diffInHours = (now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
  }

  @ApiProperty({ description: 'CSS class for priority styling' })
  get priorityClass(): string {
    const classes = {
      urgent: 'border-l-red-500 bg-red-50',
      high: 'border-l-orange-500 bg-orange-50',
      medium: 'border-l-yellow-500 bg-yellow-50',
      low: 'border-l-green-500 bg-green-50',
    };
    return classes[this.priority] || classes.low;
  }

  @ApiProperty({ description: 'Icon name for the notification type' })
  get iconName(): string {
    const icons = {
      booking: 'calendar',
      user: 'user',
      system: 'settings',
      payment: 'credit-card',
      dispute: 'alert-triangle',
      security: 'shield',
    };
    return icons[this.category] || 'bell';
  }
}