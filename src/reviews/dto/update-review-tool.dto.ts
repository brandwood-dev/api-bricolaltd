import { PartialType } from '@nestjs/swagger';
import { CreateReviewToolDto } from './create-review-tool.dto';

export class UpdateReviewToolDto extends PartialType(CreateReviewToolDto) {}
