import { PartialType } from '@nestjs/swagger';
import { CreateDisputeDto } from './create-dispute.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';
import { DisputeStatus } from '../enums/dispute-status.enum';

export class UpdateDisputeDto extends PartialType(CreateDisputeDto) {
  @ApiProperty({
    description: 'The ID of the admin handling the dispute',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  adminId?: string;

  @ApiProperty({
    description: 'The status of the dispute',
    enum: DisputeStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiProperty({
    description: 'Admin notes about the dispute resolution',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiProperty({
    description: 'The resolution of the dispute',
    required: false,
  })
  @IsOptional()
  @IsString()
  resolution?: string;
}
