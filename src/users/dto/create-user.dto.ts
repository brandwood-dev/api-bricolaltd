import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ description: 'The first name of the user', example: 'John' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiProperty({ description: 'The last name of the user', example: 'Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @ApiProperty({ description: 'The phone number of the user', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'The address of the user', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'The city of the user', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'The postal code of the user', required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ description: 'The country ID of the user', required: false })
  @IsString()
  @IsOptional()
  countryId?: string;

  @ApiProperty({
    description: 'The profile picture URL of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty({
    description: 'Whether the user is an admin',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @ApiProperty({
    description: 'Whether the user email is verified',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  verifiedEmail?: boolean;

  @ApiProperty({ description: 'The display name of the user', required: false })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    description: 'The new email for email change requests',
    required: false,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  newEmail?: string;

  @ApiProperty({ description: 'The phone prefix of the user', required: false })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiProperty({
    description: 'The latitude coordinate of the user',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    description: 'The longitude coordinate of the user',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ description: 'The bio of the user', required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ description: 'The user type', required: false })
  @IsString()
  @IsOptional()
  userType?: string;

  @ApiProperty({ description: 'The reset password token', required: false })
  @IsString()
  @IsOptional()
  resetPasswordToken?: string;

  @ApiProperty({ description: 'The reset password token expiration date', required: false })
  @IsOptional()
  resetPasswordExpires?: Date;
}