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
import { Category } from './category.entity';

@Entity('subcategory')
export class Subcategory {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the subcategory' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @ApiProperty({
    description: 'The name of the subcategory',
    example: 'drills',
  })
  name: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  @ApiProperty({
    description: 'The display name of the subcategory',
    example: 'Drills',
  })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: 'The description of the subcategory',
    required: false,
  })
  description?: string;

  @ManyToOne(() => Category, (category) => category.subcategories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  @ApiProperty({
    description: 'The category of this subcategory',
    type: () => Category,
  })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the subcategory was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({
    description: 'The date when the subcategory was last updated',
  })
  updatedAt: Date;
}
