/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { ToolPhoto } from './entities/tool-photo.entity';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolPhotoDto } from './dto/tool-photo.dto';
import { AvailabilityStatus } from './enums/availability-status.enum';
import { Booking } from '../bookings/entities/booking.entity';
import { S3Service } from '../common/services/s3.service';
import { BookingStatus } from '../bookings/enums/booking-status.enum';

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool)
    private toolsRepository: Repository<Tool>,
    @InjectRepository(ToolPhoto)
    private toolPhotoRepository: Repository<ToolPhoto>,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    createToolDto: CreateToolDto,
    files?: Express.Multer.File[],
  ): Promise<Tool> {
    // Check if tool name already exists
    const existingTool = await this.toolsRepository.findOne({
      where: { title: createToolDto.title },
    });
    
    if (existingTool) {
      throw new Error('Un outil avec ce nom existe déjà');
    }
    
    // Create the tool without images first
    const tool = this.toolsRepository.create(createToolDto);
    const savedTool = await this.toolsRepository.save(tool);

    // If files are uploaded, process them
    if (files && files.length > 0) {
      // Upload all files to S3
      const uploadResults = await this.s3Service.uploadFiles(files, 'tools');

      // Create ToolPhoto entities
      const primaryIndex = createToolDto.primaryPhotoIndex ?? 0; // Default to first image if not specified
      const toolPhotos = uploadResults.map((result, index) => {
        return this.toolPhotoRepository.create({
          url: result.url,
          filename: result.url.split('/').pop(),
          isPrimary: index === primaryIndex, // Use specified primary index
          toolId: savedTool.id,
        });
      });

      // Save all tool photos
      await this.toolPhotoRepository.save(toolPhotos);
    }

    return this.findOne(savedTool.id);
  }

  async findAll(query?: {
    search?: string;
    isAvailable?: boolean;
  }): Promise<Tool[]> {
    const whereCondition: any = {};

    if (query?.search) {
      whereCondition.title = Like(`%${query.search}%`);
    }

    if (query?.isAvailable !== undefined) {
      whereCondition.availabilityStatus = query.isAvailable
        ? AvailabilityStatus.AVAILABLE
        : AvailabilityStatus.UNAVAILABLE;
    }

    const tools = await this.toolsRepository.find({
      where:
        Object.keys(whereCondition).length > 0 ? whereCondition : undefined,
      relations: {
        owner: true,
        category: true,
        subcategory: true,
        photos: true,
      },
      order: {
        createdAt: 'DESC',
        photos: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      },
    });

    // Transform tools to include isAvailable property
    return tools.map(tool => ({
      ...tool,
      isAvailable: tool.availabilityStatus === AvailabilityStatus.AVAILABLE,
    }));
  }

  async findOne(id: string): Promise<Tool> {
    const tool = await this.toolsRepository.findOne({
      where: { id },
      relations: {
        owner: true,
        category: true,
        subcategory: true,
        photos: true,
      },
      order: {
        photos: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      },
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    return {
      ...tool,
      isAvailable: tool.availabilityStatus === AvailabilityStatus.AVAILABLE,
    } as Tool;
  }

  async findByUser(userId: string): Promise<Tool[]> {
    const tools = await this.toolsRepository.find({
      where: { ownerId: userId },
      relations: {
        owner: true,
        category: true,
        subcategory: true,
        photos: true,
      },
      order: {
        createdAt: 'DESC',
        photos: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      },
    });

    // Transform tools to include isAvailable property
    return tools.map(tool => ({
      ...tool,
      isAvailable: tool.availabilityStatus === AvailabilityStatus.AVAILABLE,
    }));
  }

  async update(
    id: string,
    updateToolDto: UpdateToolDto,
    files?: Express.Multer.File[],
  ): Promise<Tool> {
    const tool = await this.findOne(id);

    // Update the tool with the new data
    Object.assign(tool, updateToolDto);
    await this.toolsRepository.save(tool);

    // If files are uploaded, process them
    if (files && files.length > 0) {
      // Get existing photos
      const existingPhotos = await this.toolPhotoRepository.find({
        where: { toolId: id },
      });

      // If there's a primary photo flag in the first file, update existing photos
      if (files[0] && files[0].fieldname === 'primaryImage') {
        // Upload the new primary image
        const uploadResult = await this.s3Service.uploadFile(files[0], 'tools');

        // Find the current primary photo
        const currentPrimary = existingPhotos.find((photo) => photo.isPrimary);

        if (currentPrimary) {
          // Update the current primary to not be primary
          currentPrimary.isPrimary = false;
          await this.toolPhotoRepository.save(currentPrimary);

          // Delete the old primary image from S3
          try {
            await this.s3Service.deleteFile(currentPrimary.url);
            await this.toolPhotoRepository.remove(currentPrimary);
          } catch (error) {
            console.error('Error deleting old primary image from S3:', error);
          }
        }

        // Create a new primary photo
        const newPrimary = this.toolPhotoRepository.create({
          url: uploadResult.url,
          filename: uploadResult.url.split('/').pop(),
          isPrimary: true,
          toolId: id,
        });

        await this.toolPhotoRepository.save(newPrimary);

        // Remove the primary image from the files array
        files.shift();
      }

      // Process remaining files as additional images
      if (files.length > 0) {
        const uploadResults = await this.s3Service.uploadFiles(files, 'tools');

        // Create ToolPhoto entities for additional images
        const newPhotos = uploadResults.map((result) => {
          return this.toolPhotoRepository.create({
            url: result.url,
            filename: result.url.split('/').pop(),
            isPrimary: false,
            toolId: id,
          });
        });

        await this.toolPhotoRepository.save(newPhotos);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    //const tool = await this.findOne(id);

    // Get all photos for this tool
    const photos = await this.toolPhotoRepository.find({
      where: { toolId: id },
    });

    // Delete all photos from S3
    for (const photo of photos) {
      try {
        await this.s3Service.deleteFile(photo.url);
      } catch (error) {
        // Log the error but continue with the deletion
        console.error(`Error deleting image ${photo.id} from S3:`, error);
      }
    }

    // Delete all tool photos from the database
    if (photos.length > 0) {
      await this.toolPhotoRepository.remove(photos);
    }

    // Delete the tool
    const result = await this.toolsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }
  }

  async updateAvailability(id: string, isAvailable: boolean): Promise<Tool> {
    const tool = await this.findOne(id);
    tool.availabilityStatus = isAvailable
      ? AvailabilityStatus.AVAILABLE
      : AvailabilityStatus.UNAVAILABLE;
    return this.toolsRepository.save(tool);
  }

  async checkAvailabilityForDates(
    toolId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<boolean> {
    // First check if the tool exists and is generally available
    const tool = await this.findOne(toolId);
    if (tool.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
      return false;
    }

    // Then check if there are any bookings for this tool in the requested date range
    const bookingRepo = this.toolsRepository.manager.getRepository(Booking);
    const conflictingBookings = await bookingRepo.find({
      where: [
        {
          toolId: toolId,
          status: BookingStatus.CONFIRMED,
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
        {
          toolId: toolId,
          status: BookingStatus.PENDING,
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
      ],
    });

    // If there are any conflicting bookings, the tool is not available
    return conflictingBookings.length === 0;
  }

  // Tool Photo Management Methods

  async addToolPhoto(
    createToolPhotoDto: ToolPhotoDto,
    file: Express.Multer.File,
  ) {
    // Check if the tool exists
    await this.findOne(createToolPhotoDto.toolId);

    // Upload the file to S3
    const uploadResult = await this.s3Service.uploadFile(file, 'tools');

    // If this is set to be the primary photo, update all other photos to not be primary
    if (createToolPhotoDto.isPrimary) {
      await this.toolPhotoRepository.update(
        { toolId: createToolPhotoDto.toolId, isPrimary: true },
        { isPrimary: false },
      );
    }

    // Create and save the new tool photo
    const toolPhoto = this.toolPhotoRepository.create({
      url: uploadResult.url,
      filename: uploadResult.url.split('/').pop(),
      isPrimary: createToolPhotoDto.isPrimary || false,
      toolId: createToolPhotoDto.toolId,
    });

    return this.toolPhotoRepository.save(toolPhoto);
  }

  async setToolPhotoPrimary(photoId: string) {
    // Find the photo
    const photo = await this.toolPhotoRepository.findOne({
      where: { id: photoId },
    });
    if (!photo) {
      throw new NotFoundException(`Tool photo with ID ${photoId} not found`);
    }

    // Update all photos for this tool to not be primary
    await this.toolPhotoRepository.update(
      { toolId: photo.toolId, isPrimary: true },
      { isPrimary: false },
    );

    // Set this photo as primary
    photo.isPrimary = true;
    return this.toolPhotoRepository.save(photo);
  }

  async removeToolPhoto(photoId: string) {
    // Find the photo
    const photo = await this.toolPhotoRepository.findOne({
      where: { id: photoId },
    });
    if (!photo) {
      throw new NotFoundException(`Tool photo with ID ${photoId} not found`);
    }

    // Delete the photo from S3
    try {
      await this.s3Service.deleteFile(photo.url);
    } catch (error) {
      console.error(`Error deleting image ${photoId} from S3:`, error);
    }

    // Delete the photo from the database
    await this.toolPhotoRepository.remove(photo);

    // If this was the primary photo and there are other photos, set the first one as primary
    if (photo.isPrimary) {
      const remainingPhotos = await this.toolPhotoRepository.find({
        where: { toolId: photo.toolId },
        order: { createdAt: 'ASC' },
        take: 1,
      });

      if (remainingPhotos.length > 0) {
        remainingPhotos[0].isPrimary = true;
        await this.toolPhotoRepository.save(remainingPhotos[0]);
      }
    }

    return { id: photoId, deleted: true };
  }

  async checkNameUniqueness(name: string): Promise<{ isUnique: boolean }> {
    const existingTool = await this.toolsRepository.findOne({
      where: { title: name },
    });
    
    return { isUnique: !existingTool };
  }
}
