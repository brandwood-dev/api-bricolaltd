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
import { User } from '../../users/entities/user.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { DocumentType } from '../enums/document-type.enum';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the document' })
  id: string;

  @Column()
  @ApiProperty({
    description: 'The title of the document',
    example: 'Contract',
  })
  title: string;

  @Column({ name: 'file_url' })
  @ApiProperty({ description: 'The file URL of the document' })
  fileUrl: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: 'The description of the document',
    required: false,
  })
  description?: string;

  @Column({ type: 'enum', enum: DocumentType, nullable: true })
  @ApiProperty({
    description: 'The type of the document',
    required: false,
  })
  type?: DocumentType;

  @Column({ nullable: true, name: 'original_name' })
  @ApiProperty({
    description: 'The original name of the uploaded file',
    example: 'passport.pdf',
  })
  originalName: string;

  @Column({ nullable: true, name: 'file_name' })
  @ApiProperty({
    description: 'The generated file name in the system',
    example: '550e8400-e29b-41d4-a716-446655440000.pdf',
  })
  fileName: string;

  @Column({ nullable: true, name: 'mime_type' })
  @ApiProperty({
    description: 'The MIME type of the file',
    example: 'application/pdf',
  })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true })
  @ApiProperty({ description: 'The size of the file in bytes' })
  size: number;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'The path to the file',
    example: 'uploads/550e8400-e29b-41d4-a716-446655440000.pdf',
  })
  path: string;

  @Column({ default: false, name: 'is_verified' })
  @ApiProperty({ description: 'Whether the document has been verified' })
  isVerified: boolean;

  @Column({ nullable: true, name: 'verified_at' })
  @ApiProperty({
    description: 'The date when the document was verified',
    required: false,
  })
  verifiedAt?: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({
    description: 'The user who owns the document',
    type: () => User,
  })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by_id' })
  @ApiProperty({
    description: 'The user who verified the document',
    required: false,
    type: () => User,
  })
  verifiedBy?: User;

  @Column({ nullable: true, name: 'verified_by_id' })
  verifiedById?: string;

  @ManyToOne(() => Tool, { nullable: true })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({
    description: 'The tool associated with the document (if applicable)',
    required: false,
  })
  tool?: Tool;

  @Column({ nullable: true, name: 'tool_id' })
  toolId?: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the document was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the document was last updated' })
  updatedAt: Date;
}
