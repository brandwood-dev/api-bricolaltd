import { IsEnum, IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SettingCategory, SettingType } from '../entities/setting.entity';

export class CreateSettingDto {
  @ApiProperty({ enum: SettingCategory })
  @IsEnum(SettingCategory)
  @IsNotEmpty()
  category: SettingCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  value?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultValue?: string;

  @ApiProperty({ enum: SettingType, default: SettingType.STRING })
  @IsEnum(SettingType)
  @IsOptional()
  type?: SettingType = SettingType.STRING;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  isEncrypted?: boolean = false;

  @ApiProperty({ required: false })
  @IsOptional()
  validationRules?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  options?: string;
}

export class UpdateSettingDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  value?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  validationRules?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  options?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  updatedBy?: string;
}