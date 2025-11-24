import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from './entities/section.entity';
import { SectionParagraph } from './entities/section-paragraph.entity';
import { SectionImage } from './entities/section-image.entity';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { S3Service } from '../common/services/s3.service';

@Injectable()
export class SectionsService {
  private readonly logger = new Logger(SectionsService.name);

  constructor(
    @InjectRepository(Section)
    private sectionRepository: Repository<Section>,
    @InjectRepository(SectionParagraph)
    private paragraphRepository: Repository<SectionParagraph>,
    @InjectRepository(SectionImage)
    private imageRepository: Repository<SectionImage>,
    private readonly s3Service: S3Service,
  ) {}

  async create(createSectionDto: CreateSectionDto): Promise<Section> {
    this.logger.debug(
      `[SectionsService] Creating section for news ${createSectionDto.newsId}:`,
      createSectionDto,
    );

    // Validate that the article exists
    const newsExists = await this.sectionRepository
      .createQueryBuilder('section')
      .where('section.newsId = :newsId', { newsId: createSectionDto.newsId })
      .getCount();

    if (newsExists === 0) {
      // Check if news actually exists by trying to find any section
      // For now, we'll allow creation assuming the news exists
      // In a real implementation, you might want to check the News entity
    }

    // Create the section
    const section = this.sectionRepository.create({
      title: createSectionDto.title,
      orderIndex: createSectionDto.orderIndex,
      newsId: createSectionDto.newsId,
    });

    const savedSection = await this.sectionRepository.save(section);
    this.logger.debug(
      `[SectionsService] Section saved with ID: ${savedSection.id}`,
      {
        id: savedSection.id,
        title: savedSection.title,
        orderIndex: savedSection.orderIndex,
        newsId: savedSection.newsId,
      },
    );

    // Create paragraphs if provided
    if (createSectionDto.paragraphs && createSectionDto.paragraphs.length > 0) {
      for (let i = 0; i < createSectionDto.paragraphs.length; i++) {
        const paragraphDto = createSectionDto.paragraphs[i];
        const paragraph = this.paragraphRepository.create({
          content: paragraphDto.content,
          orderIndex: paragraphDto.orderIndex,
          sectionId: savedSection.id,
        });
        await this.paragraphRepository.save(paragraph);
      }
    }

    // Create images if provided
    if (createSectionDto.images && createSectionDto.images.length > 0) {
      for (let i = 0; i < createSectionDto.images.length; i++) {
        const imageDto = createSectionDto.images[i];
        const image = this.imageRepository.create({
          url: imageDto.url,
          alt: imageDto.alt,
          orderIndex: imageDto.orderIndex,
          sectionId: savedSection.id,
        });
        await this.imageRepository.save(image);
      }
    }

    // Return the section with its relations
    const result = await this.findOne(savedSection.id);
    this.logger.debug(`[SectionsService] findOne returned:`, {
      id: result.id,
      title: result.title,
      orderIndex: result.orderIndex,
      hasParagraphs: !!result.paragraphs,
      hasImages: !!result.images,
    });
    return result;
  }

  async findByArticle(newsId: string): Promise<Section[]> {
    const sections = await this.sectionRepository.find({
      where: { newsId },
      relations: ['paragraphs', 'images'],
      order: {
        orderIndex: 'ASC',
        paragraphs: { orderIndex: 'ASC' },
        images: { orderIndex: 'ASC' },
      },
    });

    return sections;
  }

  async findOne(id: string): Promise<Section> {
    const section = await this.sectionRepository.findOne({
      where: { id },
      relations: ['paragraphs', 'images'],
      order: {
        paragraphs: { orderIndex: 'ASC' },
        images: { orderIndex: 'ASC' },
      },
    });

    if (!section) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    return section;
  }

  async update(
    id: string,
    updateSectionDto: UpdateSectionDto,
  ): Promise<Section> {
    const section = await this.findOne(id);

    // Update basic section properties
    if (updateSectionDto.title !== undefined) {
      section.title = updateSectionDto.title;
    }
    if (updateSectionDto.orderIndex !== undefined) {
      section.orderIndex = updateSectionDto.orderIndex;
    }

    await this.sectionRepository.save(section);

    // Update paragraphs if provided
    if (updateSectionDto.paragraphs) {
      // Delete existing paragraphs
      await this.paragraphRepository.delete({ sectionId: id });

      // Create new paragraphs
      if (updateSectionDto.paragraphs.length > 0) {
        for (let i = 0; i < updateSectionDto.paragraphs.length; i++) {
          const paragraphDto = updateSectionDto.paragraphs[i];
          const paragraph = this.paragraphRepository.create({
            content: paragraphDto.content,
            orderIndex: paragraphDto.orderIndex,
            sectionId: id,
          });
          await this.paragraphRepository.save(paragraph);
        }
      }
    }

    // Update images if provided
    if (updateSectionDto.images) {
      // Delete existing images
      await this.imageRepository.delete({ sectionId: id });

      // Create new images
      if (updateSectionDto.images.length > 0) {
        for (let i = 0; i < updateSectionDto.images.length; i++) {
          const imageDto = updateSectionDto.images[i];
          const image = this.imageRepository.create({
            url: imageDto.url,
            alt: imageDto.alt,
            orderIndex: imageDto.orderIndex,
            sectionId: id,
          });
          await this.imageRepository.save(image);
        }
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const section = await this.findOne(id);
    await this.sectionRepository.remove(section);
  }

  async reorder(id: string, newOrderIndex: number): Promise<Section> {
    const section = await this.findOne(id);

    if (newOrderIndex < 0) {
      throw new BadRequestException('Order index must be non-negative');
    }

    section.orderIndex = newOrderIndex;
    await this.sectionRepository.save(section);

    return this.findOne(id);
  }

  async addParagraph(
    sectionId: string,
    paragraphData: { content: string; orderIndex: number },
  ): Promise<SectionParagraph> {
    this.logger.debug(
      `[SectionsService] Adding paragraph to section: ${sectionId}`,
    );

    try {
      // Verify section exists
      const section = await this.findOne(sectionId);
      this.logger.debug(`[SectionsService] Section found: ${section.id}`);

      // Create paragraph
      const paragraph = this.paragraphRepository.create({
        content: paragraphData.content,
        orderIndex: paragraphData.orderIndex,
        sectionId,
      });

      const savedParagraph = await this.paragraphRepository.save(paragraph);
      this.logger.debug(
        `[SectionsService] Paragraph saved: ${savedParagraph.id}`,
      );

      return savedParagraph;
    } catch (error) {
      this.logger.error(`[SectionsService] Error adding paragraph:`, error);
      if (error instanceof NotFoundException) {
        throw new BadRequestException(`Section with ID ${sectionId} not found`);
      }
      throw error;
    }
  }

  async uploadSectionImage(
    sectionId: string,
    file: Express.Multer.File,
    alt?: string,
    orderIndex?: number,
  ): Promise<SectionImage> {
    this.logger.debug(
      `[SectionsService] Starting image upload for section: ${sectionId}`,
    );

    try {
      // Verify section exists
      const section = await this.findOne(sectionId);
      this.logger.debug(`[SectionsService] Section found: ${section.id}`);

      // Upload image to S3
      this.logger.debug(
        `[SectionsService] Uploading file to S3: ${file.originalname}`,
      );
      const uploadResult = await this.s3Service.uploadFile(
        file,
        `news/sections/${sectionId}`,
      );
      this.logger.debug(
        `[SectionsService] S3 upload successful: ${uploadResult.url}`,
      );

      // Get the order index - use provided orderIndex or calculate next one
      let finalOrderIndex = orderIndex;
      if (finalOrderIndex === undefined) {
        const existingImages = await this.imageRepository.find({
          where: { sectionId },
          order: { orderIndex: 'DESC' },
        });
        finalOrderIndex =
          existingImages.length > 0 ? existingImages[0].orderIndex + 1 : 0;
      }
      this.logger.debug(
        `[SectionsService] Using order index: ${finalOrderIndex}`,
      );

      // Create section image record
      const sectionImage = this.imageRepository.create({
        url: uploadResult.url,
        alt: alt || '',
        orderIndex: finalOrderIndex,
        sectionId,
      });

      const savedImage = await this.imageRepository.save(sectionImage);
      this.logger.debug(
        `[SectionsService] Image saved to database: ${savedImage.id}`,
      );

      return savedImage;
    } catch (error) {
      this.logger.error(
        `[SectionsService] Error uploading section image:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `Section with ID ${sectionId} not found. Please save the section first before uploading images.`,
        );
      }
      throw error;
    }
  }

  async createSectionImage(
    sectionId: string,
    imageUrl: string,
    alt?: string,
    orderIndex?: number,
  ): Promise<SectionImage> {
    this.logger.debug(
      `[SectionsService] Creating section image with URL for section: ${sectionId}`,
    );

    try {
      // Verify section exists
      const section = await this.findOne(sectionId);
      this.logger.debug(`[SectionsService] Section found: ${section.id}`);

      // Get the order index - use provided orderIndex or calculate next one
      let finalOrderIndex = orderIndex;
      if (finalOrderIndex === undefined) {
        const existingImages = await this.imageRepository.find({
          where: { sectionId },
          order: { orderIndex: 'DESC' },
          take: 1,
        });
        finalOrderIndex =
          existingImages.length > 0 ? existingImages[0].orderIndex + 1 : 0;
      }

      // Create section image record
      const sectionImage = this.imageRepository.create({
        url: imageUrl,
        alt,
        orderIndex: finalOrderIndex,
        sectionId,
      });

      const savedImage = await this.imageRepository.save(sectionImage);
      this.logger.debug(
        `[SectionsService] Image saved to database: ${savedImage.id}`,
      );

      return savedImage;
    } catch (error) {
      this.logger.error(
        `[SectionsService] Error creating section image:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `Section with ID ${sectionId} not found.`,
        );
      }
      throw error;
    }
  }

  async updateParagraph(
    id: string,
    content: string,
    orderIndex: number,
  ): Promise<SectionParagraph> {
    this.logger.debug(`[SectionsService] Updating paragraph ${id}`);

    const paragraph = await this.paragraphRepository.findOne({ where: { id } });
    if (!paragraph) {
      throw new NotFoundException(`Paragraph with ID ${id} not found`);
    }

    paragraph.content = content;
    paragraph.orderIndex = orderIndex;

    return await this.paragraphRepository.save(paragraph);
  }

  async deleteParagraph(id: string): Promise<void> {
    this.logger.debug(`[SectionsService] Deleting paragraph ${id}`);

    const paragraph = await this.paragraphRepository.findOne({ where: { id } });
    if (!paragraph) {
      throw new NotFoundException(`Paragraph with ID ${id} not found`);
    }

    await this.paragraphRepository.remove(paragraph);
  }

  async updateSectionImage(
    id: string,
    url: string,
    alt?: string,
    orderIndex?: number,
  ): Promise<SectionImage> {
    this.logger.debug(`[SectionsService] Updating section image ${id}`);

    const image = await this.imageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Section image with ID ${id} not found`);
    }

    image.url = url;
    if (alt !== undefined) image.alt = alt;
    if (orderIndex !== undefined) image.orderIndex = orderIndex;

    return await this.imageRepository.save(image);
  }

  async deleteSectionImage(id: string): Promise<void> {
    this.logger.debug(`[SectionsService] Deleting section image ${id}`);

    const image = await this.imageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Section image with ID ${id} not found`);
    }

    // Delete from S3 if it's an S3 URL
    if (image.url && image.url.includes('amazonaws.com')) {
      try {
        this.logger.debug(
          `[SectionsService] Deleting image from S3: ${image.url}`,
        );
        await this.s3Service.deleteFile(image.url);
        this.logger.debug(
          `[SectionsService] Image deleted from S3 successfully`,
        );
      } catch (error) {
        this.logger.error(
          `[SectionsService] Failed to delete image from S3:`,
          error,
        );
        // Continue with database deletion even if S3 deletion fails
      }
    }

    await this.imageRepository.remove(image);
    this.logger.debug(
      `[SectionsService] Section image deleted from database: ${id}`,
    );
  }

  async deleteSectionImagesBySectionId(sectionId: string): Promise<void> {
    this.logger.debug(
      `[SectionsService] Deleting all images for section ${sectionId}`,
    );

    // First, get all images to delete their S3 files
    const images = await this.imageRepository.find({ where: { sectionId } });

    // Delete images from S3
    for (const image of images) {
      if (image.url && image.url.includes('amazonaws.com')) {
        try {
          this.logger.debug(
            `[SectionsService] Deleting image from S3: ${image.url}`,
          );
          await this.s3Service.deleteFile(image.url);
        } catch (error) {
          this.logger.error(
            `[SectionsService] Failed to delete image from S3:`,
            error,
          );
          // Continue with other deletions even if one fails
        }
      }
    }

    // Delete all images from database
    await this.imageRepository.delete({ sectionId });
    this.logger.debug(
      `[SectionsService] All section images deleted from database for section: ${sectionId}`,
    );
  }

  async deleteSectionParagraphsBySectionId(sectionId: string): Promise<void> {
    this.logger.debug(
      `[SectionsService] Deleting all paragraphs for section ${sectionId}`,
    );

    await this.paragraphRepository.delete({ sectionId });
  }
}
