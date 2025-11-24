import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancellationMessage?: string;
}
