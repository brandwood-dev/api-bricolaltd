import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePasswordDto {
  @ApiProperty({
    description: 'Le mot de passe à valider',
    example: 'monMotDePasse123'
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}