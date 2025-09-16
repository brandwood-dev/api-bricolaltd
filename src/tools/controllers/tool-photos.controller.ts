/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ToolsService } from '../tools.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ToolPhotoDto } from '../dto/tool-photo.dto';
import { CreateToolPhotoDto } from '../dto/create-tool-photo.dto';

@ApiTags('tool-photos')
@Controller('tool-photos')
export class ToolPhotosController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a photo to a tool' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'The photo has been successfully added.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'No file uploaded.' })
  addPhoto(@Body() createToolPhotoDto: CreateToolPhotoDto, @Req() req: any) {
    const file = req.file;
    if (!file) {
      throw new NotFoundException('No file uploaded');
    }
    return this.toolsService.addToolPhoto(createToolPhotoDto, file);
  }

  @Patch(':id/set-primary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a photo as primary' })
  @ApiResponse({
    status: 200,
    description: 'The photo has been set as primary.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  setPrimary(@Param('id') id: string) {
    return this.toolsService.setToolPhotoPrimary(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tool photo' })
  @ApiResponse({
    status: 200,
    description: 'The photo has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  removePhoto(@Param('id') id: string) {
    return this.toolsService.removeToolPhoto(id);
  }
}
