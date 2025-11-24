import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsIn,
} from 'class-validator';

export class CreateUserPreferenceDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  @IsIn(['fr', 'en', 'ar', 'es', 'de'])
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark'])
  theme?: string;

  @IsOptional()
  @IsString()
  @IsIn(['EUR', 'USD', 'GBP', 'MAD'])
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(['km', 'miles'])
  distanceUnit?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @IsOptional()
  @IsNumber()
  searchRadiusKm?: number;
}
