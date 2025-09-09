import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ToolStatus } from '../../tools/enums/tool-status.enum';

export class UpdateToolStatusDto {
  @ApiProperty({
    description: 'New status for the tool',
    enum: ToolStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ToolStatus)
  status?: ToolStatus;

  @ApiProperty({
    description: 'Reason for status change (required for rejection)',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Admin notes for the status change',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}