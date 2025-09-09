/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Subcategory } from './subcategory.entity';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the category' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @ApiProperty({
    description: 'The name of the category',
    example: 'power_tools',
  })
  name: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  @ApiProperty({
    description: 'The display name of the category',
    example: 'Power Tools',
  })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: 'The description of the category',
    required: false,
  })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the category was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the category was last updated' })
  updatedAt: Date;

  @OneToMany(() => Subcategory, (subcategory) => subcategory.category)
  @ApiProperty({
    description: 'The subcategories of this category',
    type: [Subcategory],
  })
  subcategories: Subcategory[];
}
