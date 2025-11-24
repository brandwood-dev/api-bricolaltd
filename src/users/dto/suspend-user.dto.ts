import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiProperty({
    description: 'Reason for user suspension',
    enum: [
      'Fraud or Attempted Fraud',
      'Violation of Terms of Use',
      'Inappropriate Behavior',
      'Non-Compliant or Dangerous Tool',
      'Multiple Accounts Prohibited',
      'Suspicion of Fraudulent Activity',
      "User's Voluntary Request",
      'Abusive Reviews or Comments',
    ],
    example: 'Violation of Terms of Use',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'Fraud or Attempted Fraud',
    'Violation of Terms of Use',
    'Inappropriate Behavior',
    'Non-Compliant or Dangerous Tool',
    'Multiple Accounts Prohibited',
    'Suspicion of Fraudulent Activity',
    "User's Voluntary Request",
    'Abusive Reviews or Comments',
  ])
  reason: string;
}
