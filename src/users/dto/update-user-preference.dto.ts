import { PartialType } from '@nestjs/mapped-types';
import { CreateUserPreferenceDto } from './create-user-preference.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserPreferenceDto extends PartialType(
  CreateUserPreferenceDto,
) {
  @IsOptional()
  @IsString()
  userId?: string;
}
