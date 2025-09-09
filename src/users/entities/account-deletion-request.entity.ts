import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';
import { DeletionStatus } from '../enums/deletion-status.enum';

@Entity('account_deletion_request')
export class AccountDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the deletion request' })
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({
    description: 'The user who requested the deletion',
    type: () => User,
  })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'status', default: DeletionStatus.PENDING })
  status: DeletionStatus;

  @CreateDateColumn({ name: 'requested_at' })
  @ApiProperty({ description: 'The date when the deletion was requested' })
  requestedAt: Date;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'reviewed_by_admin_id' })
  @ApiProperty({
    description: 'The admin who reviewed the deletion request',
    type: () => User,
    required: false,
  })
  reviewedByAdmin?: User;

  @Column({ name: 'reviewed_by_admin_id', nullable: true })
  reviewedByAdminId?: string;

  @Column({ name: 'reviewed_at', nullable: true })
  @ApiProperty({
    description: 'The date when the deletion request was reviewed',
    required: false,
  })
  reviewedAt?: Date;
}
