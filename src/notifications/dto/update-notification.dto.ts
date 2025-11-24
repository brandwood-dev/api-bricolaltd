import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { CreateNotificationDto } from './create-notification.dto';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @ApiProperty({
    description: 'Whether the notification has been read',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiProperty({
    description: 'The date when the notification was read',
    example: '2024-03-20T10:30:00Z',
    required: false,
  })
  @IsOptional()
  readAt?: Date | string | undefined;
}
