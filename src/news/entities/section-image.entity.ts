import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Section } from './section.entity';

@Entity('section_images')
export class SectionImage {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the image' })
  id: string;

  @Column()
  @ApiProperty({ description: 'The URL of the image' })
  url: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'The alt text for the image', required: false })
  alt?: string;

  @Column({ type: 'int' })
  @ApiProperty({
    description: 'The order position of the image within the section',
  })
  orderIndex: number;

  @ManyToOne(() => Section, (section) => section.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sectionId' })
  @ApiProperty({ description: 'The section this image belongs to' })
  section: Section;

  @Column()
  sectionId: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'The date when the image was created' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'The date when the image was last updated' })
  updatedAt: Date;
}
