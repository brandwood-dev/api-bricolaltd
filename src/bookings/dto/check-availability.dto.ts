import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsDateString } from 'class-validator';

export class CheckAvailabilityDto {
  @ApiProperty({ description: 'The ID of the tool to check availability for' })
  @IsNotEmpty()
  @IsUUID()
  toolId: string;

  @ApiProperty({
    description: 'The start date to check',
    example: '2023-01-01T10:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'The end date to check',
    example: '2023-01-03T18:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}

export class AvailabilityResponseDto {
  @ApiProperty({
    description: 'Whether the tool is available for the requested dates',
  })
  available: boolean;

  @ApiProperty({
    description: 'List of unavailable dates in the requested range',
    type: [String],
  })
  unavailableDates: string[];

  @ApiProperty({
    description: 'Additional message about availability',
    required: false,
  })
  message?: string;

  @ApiProperty({
    description: 'Conflicting bookings information',
    required: false,
  })
  conflicts?: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
}
