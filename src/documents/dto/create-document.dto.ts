import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: 'The ID of the user who owns the document' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'The type of document', example: 'ID_CARD', required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: 'A description of the document', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}