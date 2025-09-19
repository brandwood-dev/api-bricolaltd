import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum ContactStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum ContactCategory {
  TECHNICAL = 'technical',
  PAYMENT = 'payment',
  ACCOUNT = 'account',
  DISPUTE = 'dispute',
  SUGGESTION = 'suggestion',
  OTHER = 'other',
}

export enum ContactPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the contact message' })
  id: string;

  @Column()
  @ApiProperty({
    description: 'First name of the person contacting',
    example: 'John',
  })
  firstName: string;

  @Column()
  @ApiProperty({
    description: 'Last name of the person contacting',
    example: 'Doe',
  })
  lastName: string;

  @Column()
  @ApiProperty({
    description: 'Email address of the person contacting',
    example: 'john.doe@example.com',
  })
  email: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Phone number (optional)',
    example: '+44 123 456 7890',
    required: false,
  })
  phone?: string;

  @Column()
  @ApiProperty({
    description: 'Subject of the contact message',
    example: 'Question about booking',
  })
  subject: string;

  @Column('text')
  @ApiProperty({
    description: 'Message content',
    example: 'I have a question about my recent booking...',
  })
  message: string;

  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.NEW,
  })
  @ApiProperty({
    description: 'Status of the contact message',
    enum: ContactStatus,
    default: ContactStatus.NEW,
  })
  status: ContactStatus;

  @Column({
    type: 'enum',
    enum: ContactCategory,
    default: ContactCategory.OTHER,
  })
  @ApiProperty({
    description: 'Category of the contact message',
    enum: ContactCategory,
    default: ContactCategory.OTHER,
  })
  category: ContactCategory;

  @Column({
    type: 'enum',
    enum: ContactPriority,
    default: ContactPriority.MEDIUM,
  })
  @ApiProperty({
    description: 'Priority of the contact message',
    enum: ContactPriority,
    default: ContactPriority.MEDIUM,
  })
  priority: ContactPriority;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Admin assigned to handle this contact',
    required: false,
  })
  assignedTo?: string;

  @Column('text', { nullable: true })
  @ApiProperty({
    description: 'Admin response to the contact message',
    required: false,
  })
  response?: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Date when the contact message was created' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Date when the contact message was last updated' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'Date when the contact message was responded to',
    required: false,
  })
  respondedAt?: Date;
}