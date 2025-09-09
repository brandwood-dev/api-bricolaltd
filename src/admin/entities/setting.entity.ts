import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum SettingType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  EMAIL = 'email',
  URL = 'url',
  PASSWORD = 'password',
}

export enum SettingCategory {
  PLATFORM = 'platform',
  PAYMENT = 'payment',
  EMAIL = 'email',
  SECURITY = 'security',
  NOTIFICATION = 'notification',
  GENERAL = 'general',
}

@Entity({ name: 'settings' })
@Index(['category', 'key'], { unique: true })
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the setting' })
  id: string;

  @Column({ name: 'category', type: 'enum', enum: SettingCategory })
  @ApiProperty({ description: 'The category of the setting', enum: SettingCategory })
  category: SettingCategory;

  @Column({ name: 'key', type: 'varchar', length: 100 })
  @ApiProperty({ description: 'The key of the setting' })
  key: string;

  @Column({ name: 'value', type: 'varchar', length: 500, nullable: true })
  @ApiProperty({ description: 'The value of the setting', required: false })
  value: string | null;

  @Column({ name: 'default_value', type: 'varchar', length: 500, nullable: true })
  @ApiProperty({ description: 'The default value of the setting', required: false })
  defaultValue: string | null;

  @Column({ name: 'type', type: 'enum', enum: SettingType, default: SettingType.STRING })
  @ApiProperty({ description: 'The type of the setting', enum: SettingType })
  type: SettingType;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  @ApiProperty({ description: 'The description of the setting', required: false })
  description: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether the setting is publicly accessible' })
  isPublic: boolean;

  @Column({ name: 'is_encrypted', type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether the setting value is encrypted' })
  isEncrypted: boolean;

  @Column({ name: 'validation_rules', type: 'varchar', length: 500, nullable: true })
  @ApiProperty({ description: 'Validation rules for the setting value', required: false })
  validationRules: string | null;

  @Column({ name: 'options', type: 'varchar', length: 500, nullable: true })
  @ApiProperty({ description: 'Available options for the setting (for select/enum types)', required: false })
  options: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @ApiProperty({ description: 'Whether the setting is active' })
  isActive: boolean;

  @Column({ name: 'updated_by', type: 'varchar', length: 36, nullable: true })
  @ApiProperty({ description: 'ID of the user who last updated the setting', required: false })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the setting was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the setting was last updated' })
  updatedAt: Date;
}