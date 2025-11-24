import { IsString, IsBoolean, IsOptional, Length, IsIn } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @Length(2, 2)
  id: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(2, 5)
  code: string;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsString()
  @Length(1, 5)
  phonePrefix: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  @IsIn([
    'Europe',
    'Asia',
    'Africa',
    'North America',
    'South America',
    'Oceania',
    'Antarctica',
  ])
  continent?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
