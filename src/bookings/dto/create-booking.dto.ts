import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  IsString,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  ValidationArguments,
} from 'class-validator';

// @ValidatorConstraint({ name: 'maxRentalDays', async: false })
// export class MaxRentalDaysConstraint implements ValidatorConstraintInterface {
//   validate(value: any, args: ValidationArguments) {
//     const object = args.object as CreateBookingDto;
//     if (!object.startDate || !object.endDate) {
//       return true; // Let other validators handle missing dates
//     }

//     const startDate = new Date(object.startDate);
//     const endDate = new Date(object.endDate);
//     const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//     return diffDays <= 5;
//   }

//   defaultMessage(args: ValidationArguments) {
//     return 'Rental period cannot exceed 5 days';
//   }
// }

export class CreateBookingDto {
  @ApiProperty({ description: 'The ID of the user making the booking' })
  @IsNotEmpty()
  @IsUUID()
  renterId: string;

  @ApiProperty({ description: 'The ID of the tool being booked' })
  @IsNotEmpty()
  @IsUUID()
  toolId: string;

  @ApiProperty({ description: 'The ID of the tool being booked' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({
    description: 'The start date of the booking',
    example: '2023-01-01T10:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'The end date of the booking',
    example: '2023-01-03T18:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  // @Validate(MaxRentalDaysConstraint) // SUPPRIMÉ - Plus de limite de 5 jours
  endDate: string;

  @ApiProperty({
    description: 'Additional notes for the booking',
    required: false,
  })
  @IsOptional()
  message?: string;

  @ApiProperty({ description: 'The payment method for the booking' })
  @IsNotEmpty()
  paymentMethod: 'CARD' | 'PAYPAL';

  @ApiProperty({ description: 'The total price for the booking' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiProperty({ description: 'The pickup time for the tool' })
  @IsOptional()
  @IsString()
  pickupHour?: string;

  @ApiProperty({
    description: 'The payment status for the booking',
    required: false,
    enum: ['pending', 'authorized', 'captured', 'failed'],
    default: 'pending',
  })
  @IsOptional()
  @IsString()
  paymentStatus?: string;
}
