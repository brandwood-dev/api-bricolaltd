import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the email' })
  id: string;

  @Column()
  @ApiProperty({
    description: 'The subject of the email',
    example: 'Welcome to Bricola',
  })
  subject: string;

  @Column({ type: 'text' })
  @ApiProperty({ description: 'The content of the email' })
  content: string;

  @Column()
  @ApiProperty({
    description: 'The recipient email address',
    example: 'user@example.com',
  })
  recipient: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'The sender email address',
    example: 'noreply@bricola.com',
    required: false,
  })
  sender?: string;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.PENDING })
  @ApiProperty({ description: 'The status of the email', enum: EmailStatus })
  status: EmailStatus;

  @Column({ default: false })
  @ApiProperty({
    description: 'Whether the email has been read by the recipient',
    default: false,
  })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'The date when the email was sent',
    required: false,
  })
  sentAt?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  @ApiProperty({
    description: 'The user associated with the email',
    required: false,
    type: () => User,
  })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'adminId' })
  @ApiProperty({
    description: 'The admin who sent the email',
    required: false,
    type: () => User,
  })
  admin?: User;

  @Column({ nullable: true })
  adminId?: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'The date when the email was created' })
  createdAt: Date;
}
