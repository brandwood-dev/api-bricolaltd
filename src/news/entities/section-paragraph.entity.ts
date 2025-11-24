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

@Entity('section_paragraphs')
export class SectionParagraph {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the paragraph' })
  id: string;

  @Column({ type: 'text' })
  @ApiProperty({ description: 'The content of the paragraph' })
  content: string;

  @Column({ type: 'int' })
  @ApiProperty({
    description: 'The order position of the paragraph within the section',
  })
  orderIndex: number;

  @ManyToOne(() => Section, (section) => section.paragraphs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sectionId' })
  @ApiProperty({ description: 'The section this paragraph belongs to' })
  section: Section;

  @Column()
  sectionId: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'The date when the paragraph was created' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'The date when the paragraph was last updated' })
  updatedAt: Date;
}
