import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ModerationActionType } from './moderation-action-type.entity';
import { Reason } from './reason.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { User } from '../../users/entities/user.entity';

@Entity('moderation_action_record')
export class ModerationActionRecord {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    description: 'The unique identifier of the moderation action record',
  })
  id: string;

  @ManyToOne(() => ModerationActionType)
  @JoinColumn({ name: 'action_id' })
  @ApiProperty({
    description: 'The type of moderation action',
    type: () => ModerationActionType,
  })
  action: ModerationActionType;

  @Column({ name: 'action_id' })
  actionId: number;

  @ManyToOne(() => Reason)
  @JoinColumn({ name: 'reason_id' })
  @ApiProperty({
    description: 'The reason for the moderation action',
    type: () => Reason,
  })
  reason: Reason;

  @Column({ name: 'reason_id' })
  reasonId: string;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({ description: 'The tool being moderated', type: () => Tool })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'moderator_id' })
  @ApiProperty({
    description: 'The moderator who performed the action',
    type: () => User,
  })
  moderator: User;

  @Column({ name: 'moderator_id' })
  moderatorId: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({
    description: 'The date when the moderation action was created',
  })
  createdAt: Date;
}
