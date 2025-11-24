import { IsOptional, IsString } from 'class-validator';

export class ConfirmToolReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
