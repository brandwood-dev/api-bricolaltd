import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('moderation_action_type')
export class ModerationActionType {
  @PrimaryColumn('tinyint', { unsigned: true })
  @ApiProperty({
    description: 'The unique identifier of the moderation action type',
  })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  @ApiProperty({
    description: 'The name of the moderation action type',
    example: 'approve',
  })
  name: string;
}
