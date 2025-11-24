import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserSessionDto {
  @ApiProperty({ description: 'User ID for the session' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'JWT token for the session' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Refresh token', required: false })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({ description: 'IP address of the client', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'User agent string', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({
    description: 'Device type (mobile, desktop, tablet)',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiProperty({ description: 'Device name', required: false })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiProperty({ description: 'Session expiration date' })
  @IsDateString()
  expiresAt: Date;

  @ApiProperty({ description: 'Whether the session is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
