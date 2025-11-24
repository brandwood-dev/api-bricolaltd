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

@Entity('reviews_app')
export class ReviewApp {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the app review' })
  id: string;

  @Column({ type: 'int' })
  @ApiProperty({
    description: 'The rating of the review (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  rating: number;

  @Column({ type: 'longtext' })
  @ApiProperty({
    description: 'The comment of the review',
    example: 'Great app, easy to use!',
  })
  comment: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  @ApiProperty({ description: 'The user who wrote the review' })
  reviewer: User;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

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
