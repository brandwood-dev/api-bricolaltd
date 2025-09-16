/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { DisputeStatus } from '../enums/dispute-status.enum';

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the dispute' })
  id: string;

  @Column()
  @ApiProperty({
    description: 'The reason for the dispute',
    example: 'Service not provided',
  })
  reason: string;

  @Column({ type: 'text' })
  @ApiProperty({ description: 'The description of the dispute' })
  description: string;

  //enum status
  @Column({
    name: 'status',
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.PENDING,
  })
  @ApiProperty({ description: 'The status of the dispute', example: 'PENDING' })
  status: DisputeStatus;

  @Column({ name: 'resolution_id', nullable: true })
  @ApiProperty({
    description: 'The ID of the dispute resolution',
    required: false,
  })
  resolutionId?: number;

  @Column({ type: 'text', nullable: true, name: 'resolution_notes' })
  @ApiProperty({ description: 'The resolution notes', required: false })
  resolutionNotes?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'refund_amount',
  })
  @ApiProperty({
    description: 'The refund amount if applicable',
    required: false,
  })
  refundAmount?: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiator_id' })
  @ApiProperty({
    description: 'The user who initiated the dispute',
    type: () => User,
  })
  initiator: User;

  @Column({ name: 'initiator_id' })
  initiatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respondent_id' })
  @ApiProperty({
    description: 'The user who is responding to the dispute',
    type: () => User,
  })
  respondent: User;

  @Column({ name: 'respondent_id' })
  respondentId: string;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({ description: 'The tool associated with the dispute' })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  @ApiProperty({ description: 'The booking associated with the dispute' })
  booking: Booking;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'moderator_id' })
  @ApiProperty({
    description: 'The moderator who handled the dispute',
    required: false,
    type: () => User,
  })
  moderator?: User;

  @Column({ nullable: true, name: 'moderator_id' })
  moderatorId?: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the dispute was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the dispute was last updated' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'resolved_at' })
  @ApiProperty({
    description: 'The date when the dispute was resolved',
    required: false,
  })
  resolvedAt?: Date;

  @Column({ type: 'simple-array', nullable: true })
  @ApiProperty({
    description: 'Array of evidence URLs for the dispute',
    required: false,
    type: [String],
  })
  evidence?: string[];

  @Column({ type: 'simple-array', nullable: true })
  @ApiProperty({
    description: 'Array of image URLs uploaded for the dispute',
    required: false,
    type: [String],
  })
  images?: string[];
}

// Export the enum for use in other modules
export { DisputeStatus };
