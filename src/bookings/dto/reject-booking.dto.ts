import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectBookingDto {
  @ApiProperty({
    description: 'The reason for rejecting the booking',
    example: 'Tool not available',
  })
  @IsNotEmpty()
  @IsString()
  refusalReason: string;

  @ApiProperty({
    description: 'Additional message for the rejection',
    example: 'Unfortunately, the tool is currently under maintenance.',
  })
  @IsNotEmpty()
  @IsString()
  refusalMessage: string;
}