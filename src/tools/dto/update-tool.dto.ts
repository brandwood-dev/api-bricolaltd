import { PartialType } from '@nestjs/swagger';
import { CreateToolDto } from './create-tool.dto';

export class UpdateToolDto extends PartialType(CreateToolDto) {
  // All fields are inherited from CreateToolDto and are optional
}
