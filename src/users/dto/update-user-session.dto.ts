import { PartialType } from '@nestjs/swagger';
import { CreateUserSessionDto } from './create-user-session.dto';
import { IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserSessionDto extends PartialType(CreateUserSessionDto) {
  @ApiProperty({ description: 'Update last activity timestamp', required: false })
  @IsOptional()
  @IsDateString()
  lastActivityAt?: Date;

  @ApiProperty({ description: 'Update session active status', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}