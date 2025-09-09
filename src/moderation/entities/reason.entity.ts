import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('reasons')
export class Reason {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the reason' })
  id: string;

  @Column({ name: 'reason_text', type: 'varchar', length: 500 })
  @ApiProperty({ description: 'The text of the reason' })
  reasonText: string;

  @Column({ type: 'varchar', length: 500 })
  @ApiProperty({ description: 'Comments about the reason' })
  comments: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the reason was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the reason was last updated' })
  updatedAt: Date;
}
