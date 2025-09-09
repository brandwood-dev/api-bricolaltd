import { PartialType } from '@nestjs/swagger';
import { CreateReviewAppDto } from './create-review-app.dto';

export class UpdateReviewAppDto extends PartialType(CreateReviewAppDto) {}