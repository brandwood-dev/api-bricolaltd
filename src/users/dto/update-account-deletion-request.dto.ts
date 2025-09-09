import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeletionStatus } from '../enums/deletion-status.enum';

export class UpdateAccountDeletionRequestDto {
  @ApiProperty({
    description: 'Status of the deletion request',
    enum: DeletionStatus,
    example: DeletionStatus.DELETED,
    required: false,
  })
  @IsOptional()
  @IsEnum(DeletionStatus)
  status?: DeletionStatus;

  @ApiProperty({
    description: 'ID of the admin who reviewed the request',
    example: 'uuid-string',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  reviewedByAdminId?: string;

  @ApiProperty({
    description: 'Admin notes for the review',
    example: 'Request approved after verification',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}