import { IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsString()
  phone_prefix?: string

  @IsOptional()
  @IsString()
  profilePicture?: string

  @IsOptional()
  @IsString()
  countryId?: string

  @IsOptional()
  @IsString()
  address?: string
}