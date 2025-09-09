import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tool } from './tool.entity';

@Entity('tool_photo')
export class ToolPhoto {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the tool photo' })
  id: string;

  @Column()
  @ApiProperty({ description: 'The URL of the photo' })
  url: string;

  @Column()
  @ApiProperty({ description: 'The filename of the photo' })
  filename: string;

  @Column({ name: 'is_primary', default: false })
  @ApiProperty({
    description: 'Whether this is the primary photo',
    default: false,
  })
  isPrimary: boolean;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({
    description: 'The tool this photo belongs to',
    type: () => Tool,
  })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the photo was created' })
  createdAt: Date;
}
