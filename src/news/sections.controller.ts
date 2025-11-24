import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';

@Controller('sections')
export class SectionsController {
  private readonly logger = new Logger(SectionsController.name);

  constructor(private readonly sectionsService: SectionsService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new section for an article' })
  @ApiResponse({ status: 201, description: 'Section created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async create(@Body() createSectionDto: CreateSectionDto) {
    this.logger.debug('Creating new section');

    try {
      return await this.sectionsService.create(createSectionDto);
    } catch (error) {
      this.logger.error('Failed to create section:', error);
      throw new BadRequestException('Failed to create section');
    }
  }

  @Get('article/:newsId')
  @ApiOperation({ summary: 'Get all sections for an article' })
  @ApiResponse({ status: 200, description: 'Sections retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  async findByArticle(@Param('newsId') newsId: string) {
    this.logger.debug(`Fetching sections for article ${newsId}`);

    try {
      return await this.sectionsService.findByArticle(newsId);
    } catch (error) {
      this.logger.error('Failed to fetch sections:', error);
      throw new NotFoundException('Article not found');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a section by ID' })
  @ApiResponse({ status: 200, description: 'Section retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Section not found.' })
  async findOne(@Param('id') id: string) {
    this.logger.debug(`Fetching section ${id}`);

    try {
      return await this.sectionsService.findOne(id);
    } catch (error) {
      this.logger.error('Failed to fetch section:', error);
      throw new NotFoundException('Section not found');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a section' })
  @ApiResponse({ status: 200, description: 'Section updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Section not found.' })
  async update(
    @Param('id') id: string,
    @Body() updateSectionDto: UpdateSectionDto,
  ) {
    this.logger.debug(`Updating section ${id}`);

    try {
      return await this.sectionsService.update(id, updateSectionDto);
    } catch (error) {
      this.logger.error('Failed to update section:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update section');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a section' })
  @ApiResponse({ status: 200, description: 'Section deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Section not found.' })
  async remove(@Param('id') id: string) {
    this.logger.debug(`Deleting section ${id}`);

    try {
      await this.sectionsService.remove(id);
      return { message: 'Section deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete section:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete section');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder a section within an article' })
  @ApiResponse({ status: 200, description: 'Section reordered successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Section not found.' })
  async reorder(
    @Param('id') id: string,
    @Body('newOrderIndex') newOrderIndex: number,
  ) {
    this.logger.debug(`Reordering section ${id} to position ${newOrderIndex}`);

    if (typeof newOrderIndex !== 'number' || newOrderIndex < 0) {
      throw new BadRequestException(
        'newOrderIndex must be a non-negative number',
      );
    }

    try {
      return await this.sectionsService.reorder(id, newOrderIndex);
    } catch (error) {
      this.logger.error('Failed to reorder section:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to reorder section');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/images/upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload an image for a section' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Image uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Section not found.' })
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt?: string,
  ) {
    this.logger.debug(`Uploading image for section ${id}`);

    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    try {
      const sectionImage = await this.sectionsService.uploadSectionImage(
        id,
        file,
        alt,
      );
      return {
        message: 'Image uploaded successfully',
        data: sectionImage,
      };
    } catch (error) {
      this.logger.error('Failed to upload section image:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload section image');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/paragraphs/:paragraphId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a paragraph in a section' })
  @ApiResponse({ status: 200, description: 'Paragraph updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Paragraph not found.' })
  async updateParagraph(
    @Param('id') sectionId: string,
    @Param('paragraphId') paragraphId: string,
    @Body() paragraphData: { content: string; orderIndex: number },
  ) {
    this.logger.debug(
      `Updating paragraph ${paragraphId} in section ${sectionId}`,
    );

    try {
      return await this.sectionsService.updateParagraph(
        paragraphId,
        paragraphData.content,
        paragraphData.orderIndex,
      );
    } catch (error) {
      this.logger.error('Failed to update paragraph:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update paragraph');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id/paragraphs/:paragraphId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a paragraph from a section' })
  @ApiResponse({ status: 200, description: 'Paragraph deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Paragraph not found.' })
  async deleteParagraph(
    @Param('id') sectionId: string,
    @Param('paragraphId') paragraphId: string,
  ) {
    this.logger.debug(
      `Deleting paragraph ${paragraphId} from section ${sectionId}`,
    );

    try {
      await this.sectionsService.deleteParagraph(paragraphId);
      return { message: 'Paragraph deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete paragraph:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete paragraph');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/images/:imageId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a section image' })
  @ApiResponse({ status: 200, description: 'Image updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  async updateSectionImage(
    @Param('id') sectionId: string,
    @Param('imageId') imageId: string,
    @Body() imageData: { url: string; alt?: string; orderIndex?: number },
  ) {
    this.logger.debug(`Updating image ${imageId} in section ${sectionId}`);

    try {
      return await this.sectionsService.updateSectionImage(
        imageId,
        imageData.url,
        imageData.alt,
        imageData.orderIndex,
      );
    } catch (error) {
      this.logger.error('Failed to update section image:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update section image');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('images/:imageId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a section image by image ID' })
  @ApiResponse({ status: 200, description: 'Image updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  async updateSectionImageById(
    @Param('imageId') imageId: string,
    @Body() imageData: { url: string; alt?: string; orderIndex?: number },
  ) {
    this.logger.debug(`Updating section image ${imageId}`);

    try {
      const updatedImage = await this.sectionsService.updateSectionImage(
        imageId,
        imageData.url,
        imageData.alt,
        imageData.orderIndex,
      );
      return {
        message: 'Section image updated successfully',
        data: updatedImage,
      };
    } catch (error) {
      this.logger.error('Failed to update section image:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update section image');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('images/:imageId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a section image by image ID' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  async deleteSectionImageById(@Param('imageId') imageId: string) {
    this.logger.debug(`Deleting section image ${imageId}`);

    try {
      await this.sectionsService.deleteSectionImage(imageId);
      return { message: 'Section image deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete section image:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete section image');
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id/images/:imageId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a section image' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  async deleteSectionImage(
    @Param('id') sectionId: string,
    @Param('imageId') imageId: string,
  ) {
    this.logger.debug(`Deleting image ${imageId} from section ${sectionId}`);

    try {
      await this.sectionsService.deleteSectionImage(imageId);
      return { message: 'Image deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete section image:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete section image');
    }
  }
}
