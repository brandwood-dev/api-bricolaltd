import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Tool } from '../../tools/entities/tool.entity';

@Entity('bookmarks')
export class Bookmark {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the bookmark' })
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({
    description: 'The user who created the bookmark',
    type: () => User,
  })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({
    description: 'The tool that was bookmarked',
    type: () => Tool,
  })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the bookmark was created' })
  createdAt: Date;
}
