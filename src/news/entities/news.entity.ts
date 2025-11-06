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

@Entity('news')
export class News {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the news' })
  id: string;

  @Column()
  @ApiProperty({
    description: 'The title of the news',
    example: 'New Feature Announcement',
  })
  title: string;

  @Column({ type: 'text' })
  @ApiProperty({ description: 'The content of the news' })
  content: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'The main image URL of the news',
    required: false,
  })
  imageUrl?: string;



  @Column({ default: true })
  @ApiProperty({ description: 'Whether the news is published', default: true })
  isPublic: boolean = true;

  @Column({ default: false })
  @ApiProperty({
    description: 'Whether the news is featured on the homepage',
    default: false,
  })
  isFeatured: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'adminId' })
  @ApiProperty({ description: 'The admin who created the news' })
  admin: User;

  @Column({ nullable: true })
  adminId: string;

  @Column({ nullable: true })
  @ApiProperty({ 
    description: 'Brief summary of the news article',
    required: false 
  })
  summary?: string;

  @Column({ nullable: true })
  @ApiProperty({ 
    description: 'Category ID for the news article',
    required: false 
  })
  categoryId?: string;

  @Column({ nullable: true })
  category?: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'The date when the news was created' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'The date when the news was last updated' })
  updatedAt: Date;
}
