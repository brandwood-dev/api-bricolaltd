import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCodeDto {
  @ApiProperty({
    description: 'The validation code to verify',
    example: '1234',
    minLength: 4,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  validationCode: string;
}

export class ValidateCodeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Validation code verified successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated booking data',
  })
  data: any;
}
