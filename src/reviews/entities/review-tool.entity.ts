/* eslint-disable prettier/prettier */
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
import { Tool } from '../../tools/entities/tool.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('reviews_tools')
export class ReviewTool {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the tool review' })
  id: string;

  @Column({ type: 'int' })
  @ApiProperty({
    description: 'The rating of the review (1-5)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  rating: number;

  @Column({ type: 'longtext' })
  @ApiProperty({
    description: 'The comment of the review',
    example: 'Great tool, worked perfectly!',
  })
  comment: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  @ApiProperty({ description: 'The user who wrote the review' })
  reviewer: User;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewee_id' })
  @ApiProperty({ description: 'The user who received the review' })
  reviewee: User;

  @Column({ name: 'reviewee_id' })
  revieweeId: string;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({ description: 'The tool being reviewed' })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  @ApiProperty({ description: 'The booking associated with the review' })
  booking: Booking;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether the review has been edited' })
  isEdited: boolean;

  @Column({ name: 'is_reported', type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether the review has been reported' })
  isReported: boolean;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether the review is hidden' })
  isHidden: boolean;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the review was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the review was last updated' })
  updatedAt: Date;

  @Column({ name: 'edited_at', nullable: true })
  @ApiProperty({
    description: 'The date when the review was last edited',
    required: false,
  })
  editedAt: Date;
}
