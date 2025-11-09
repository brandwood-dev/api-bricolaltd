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
import { CreateToolPhotoDto } from './dto/create-tool-photo.dto';
import { AvailabilityStatus } from './enums/availability-status.enum';
import { ModerationStatus } from './enums/moderation-status.enum';
import { ToolStatus } from './enums/tool-status.enum';
import { Booking } from '../bookings/entities/booking.entity';
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { S3Service } from '../common/services/s3.service';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import { NotificationPriority } from '../admin/dto/admin-notifications.dto';

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool)
    private toolsRepository: Repository<Tool>,
    @InjectRepository(ToolPhoto)
    private toolPhotoRepository: Repository<ToolPhoto>,
    @InjectRepository(ReviewTool)
    private reviewToolRepository: Repository<ReviewTool>,
    private readonly s3Service: S3Service,
    private readonly adminNotificationsService: AdminNotificationsService,
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

    const finalTool = await this.findOne(savedTool.id);
    // Notify admins of tool creation
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil créé',
        `Un nouvel outil "${finalTool.title}" a été créé.`,
        finalTool.owner?.id,
        finalTool.owner ? `${finalTool.owner.firstName} ${finalTool.owner.lastName}` : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return finalTool;
  }

  async findAll(query?: {
    search?: string;
    includeUnconfirmed?: boolean;
    toolStatus?: string;
    moderationStatus?: string;
  }): Promise<{ data: Tool[]; message: string }> {
    const whereCondition: any = {};

    if (query?.search) {
      whereCondition.title = Like(`%${query.search}%`);
    }

    // Handle toolStatus filter
    if (query?.toolStatus) {
      whereCondition.toolStatus = query.toolStatus as ToolStatus;
    }

    // Handle moderationStatus filter
    if (query?.moderationStatus) {
      whereCondition.moderationStatus = query.moderationStatus;
    }

    // By default, only show confirmed tools unless explicitly requested
    if (!query?.includeUnconfirmed && !query?.moderationStatus) {
      whereCondition.moderationStatus = ModerationStatus.CONFIRMED;
    }

    const tools = await this.toolsRepository.find({
      where: Object.keys(whereCondition).length > 0 ? whereCondition : {},
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

    // Calculate rating and review count for each tool
    const transformedTools = await Promise.all(
      tools.map(async (tool) => {
        const { rating, reviewCount } = await this.calculateToolRating(tool.id);
        (tool as any).rating = rating;
        (tool as any).reviewCount = reviewCount;
        return tool;
      }),
    );

    return {
      data: transformedTools,
      message: 'Request successful',
    };
  }

  async getFeaturedTools(
    limit: number = 8,
  ): Promise<{ data: Tool[]; message: string }> {
    const tools = await this.toolsRepository.find({
      where: {
        moderationStatus: ModerationStatus.CONFIRMED,
        toolStatus: ToolStatus.PUBLISHED,
      },
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
      take: limit,
    });

    // Calculate rating and review count for each tool
    const transformedTools = await Promise.all(
      tools.map(async (tool) => {
        const { rating, reviewCount } = await this.calculateToolRating(tool.id);
        (tool as any).rating = rating;
        (tool as any).reviewCount = reviewCount;
        return tool;
      }),
    );

    return {
      data: transformedTools,
      message: 'Request successful',
    };
  }

  async findOne(id: string): Promise<Tool> {
    console.log('🔍 findOne called with id:', id);
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

    // Calculate rating and review count
    const { rating, reviewCount } = await this.calculateToolRating(id);

    // Add the calculated values to the tool object
    (tool as any).rating = rating;
    (tool as any).reviewCount = reviewCount;

    return tool;
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

    // Calculate rating and review count for each tool
    const transformedTools = await Promise.all(
      tools.map(async (tool) => {
        const { rating, reviewCount } = await this.calculateToolRating(tool.id);
        (tool as any).rating = rating;
        (tool as any).reviewCount = reviewCount;
        return tool;
      }),
    );
    console.log('************************************************');
    console.log('************************************************');
    console.log('************************************************');
    console.log('************************************************');
    console.table(transformedTools);
    console.log('************************************************');
    console.log('************************************************');
    console.log('************************************************');
    console.log('************************************************');
    return transformedTools;
  }

  async update(
    id: string,
    updateToolDto: UpdateToolDto,
    files?: Express.Multer.File[],
  ): Promise<Tool> {
    const tool = await this.findOne(id);

    console.log('🔧 Backend - Received updateToolDto:', updateToolDto);
    console.log('🔧 Backend - Current tool categoryId:', tool.categoryId);
    console.log('🔧 Backend - Current tool subcategoryId:', tool.subcategoryId);

    // Update the tool with the new data using Object.assign
    Object.assign(tool, updateToolDto);

    // Explicitly handle categoryId and subcategoryId updates to ensure TypeORM detects changes
    if (updateToolDto.categoryId !== undefined) {
      tool.categoryId = updateToolDto.categoryId;
      console.log('🔧 Backend - Updated categoryId to:', tool.categoryId);
    }

    if (updateToolDto.subcategoryId !== undefined) {
      tool.subcategoryId = updateToolDto.subcategoryId;
      console.log('🔧 Backend - Updated subcategoryId to:', tool.subcategoryId);
    }

    // Automatically set moderation status to Pending when tool is updated
    tool.moderationStatus = ModerationStatus.PENDING;

    console.log('🔧 Backend - Tool before save:', {
      id: tool.id,
      categoryId: tool.categoryId,
      subcategoryId: tool.subcategoryId,
    });

    // Force TypeORM to detect changes by using update() method instead of save()
    const updateResult = await this.toolsRepository.update(id, {
      ...updateToolDto,
      moderationStatus: ModerationStatus.PENDING,
    });

    console.log('🔧 Backend - Update result:', updateResult);

    // Reload the tool to get the updated values
    const updatedTool = await this.toolsRepository.findOne({
      where: { id },
      relations: {
        owner: true,
        category: true,
        subcategory: true,
        photos: true,
      },
    });

    if (!updatedTool) {
      throw new NotFoundException(`Tool with ID ${id} not found after update`);
    }

    console.log('🔧 Backend - Tool after update:', {
      id: updatedTool.id,
      categoryId: updatedTool.categoryId,
      subcategoryId: updatedTool.subcategoryId,
    });

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

    // Force reload the tool with updated relations from database
    const finalTool = await this.toolsRepository.findOne({
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

    if (!finalTool) {
      throw new NotFoundException(`Tool with ID ${id} not found after update`);
    }

    console.log('🔧 Backend - Tool with reloaded relations:', {
      id: finalTool.id,
      categoryId: finalTool.categoryId,
      category: finalTool.category
        ? { id: finalTool.category.id, name: finalTool.category.name }
        : null,
      subcategoryId: finalTool.subcategoryId,
      subcategory: finalTool.subcategory
        ? { id: finalTool.subcategory.id, name: finalTool.subcategory.name }
        : null,
    });

    // Calculate rating and review count for the updated tool
    const { rating, reviewCount } = await this.calculateToolRating(id);
    (finalTool as any).rating = rating;
    (finalTool as any).reviewCount = reviewCount;
    // Notify admins of tool update
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil modifié',
        `L'outil "${finalTool.title}" a été modifié.`,
        finalTool.owner?.id,
        finalTool.owner ? `${finalTool.owner.firstName} ${finalTool.owner.lastName}` : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return finalTool;
  }

  async remove(id: string): Promise<void> {
    const tool = await this.findOne(id);

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
    // Notify admins of tool deletion
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil supprimé',
        `L'outil "${tool.title}" a été supprimé par son propriétaire.`,
        tool.owner?.id,
        tool.owner ? `${tool.owner.firstName} ${tool.owner.lastName}` : undefined,
        NotificationPriority.HIGH,
      );
    } catch {}
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
          status: BookingStatus.ACCEPTED,
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
    createToolPhotoDto: CreateToolPhotoDto,
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

  async updateModerationStatus(
    id: string,
    status: ModerationStatus,
  ): Promise<Tool> {
    const tool = await this.findOne(id);

    tool.moderationStatus = status;
    await this.toolsRepository.save(tool);

    return this.findOne(id);
  }

  async updateToolStatus(id: string, status: ToolStatus): Promise<Tool> {
    const tool = await this.findOne(id);

    tool.toolStatus = status;
    await this.toolsRepository.save(tool);

    return this.findOne(id);
  }

  async findAllForAdmin(query?: {
    search?: string;
    moderationStatus?: ModerationStatus;
  }): Promise<Tool[]> {
    const whereCondition: any = {};

    if (query?.search) {
      whereCondition.title = Like(`%${query.search}%`);
    }

    if (query?.moderationStatus) {
      whereCondition.moderationStatus = query.moderationStatus;
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

    // Calculate rating and review count for each tool
    const transformedTools = await Promise.all(
      tools.map(async (tool) => {
        const { rating, reviewCount } = await this.calculateToolRating(tool.id);
        (tool as any).rating = rating;
        (tool as any).reviewCount = reviewCount;
        return tool;
      }),
    );

    return transformedTools;
  }

  /**
   * Calculate the average rating and review count for a tool
   */
  async calculateToolRating(
    toolId: string,
  ): Promise<{ rating: number; reviewCount: number }> {
    console.log('🔍 calculateToolRating called for toolId:', toolId);

    const reviews = await this.reviewToolRepository.find({
      where: { toolId },
    });

    console.log(
      '🔍 Found reviews:',
      reviews.length,
      reviews.map((r) => ({ id: r.id, rating: r.rating })),
    );

    if (reviews.length === 0) {
      console.log('🔍 No reviews found, returning 0/0');
      return { rating: 0, reviewCount: 0 };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 10) / 10; // Round to 1 decimal place

    console.log(
      '🔍 Calculated rating:',
      averageRating,
      'reviewCount:',
      reviews.length,
    );

    return {
      rating: averageRating,
      reviewCount: reviews.length,
    };
  }
}
