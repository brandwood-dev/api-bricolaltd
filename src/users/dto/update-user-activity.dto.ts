import { PartialType } from '@nestjs/swagger';
import { CreateUserActivityDto } from './create-user-activity.dto';

export class UpdateUserActivityDto extends PartialType(CreateUserActivityDto) {}
