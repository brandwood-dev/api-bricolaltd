import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { News } from './news.entity';
import { SectionParagraph } from './section-paragraph.entity';
import { SectionImage } from './section-image.entity';

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the section' })
  id: string;

  @Column()
  @ApiProperty({ description: 'The title of the section' })
  title: string;

  @Column({ type: 'int' })
  @ApiProperty({ description: 'The order position of the section' })
  orderIndex: number;

  @ManyToOne(() => News, (news) => news.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'newsId' })
  @ApiProperty({ description: 'The news article this section belongs to' })
  news: News;

  @Column()
  newsId: string;

  @OneToMany(() => SectionParagraph, (paragraph) => paragraph.section, {
    cascade: true,
    eager: true,
  })
  @ApiProperty({ description: 'The paragraphs in this section' })
  paragraphs: SectionParagraph[];

  @OneToMany(() => SectionImage, (image) => image.section, {
    cascade: true,
    eager: true,
  })
  @ApiProperty({ description: 'The images in this section' })
  images: SectionImage[];

  @CreateDateColumn()
  @ApiProperty({ description: 'The date when the section was created' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'The date when the section was last updated' })
  updatedAt: Date;
}
