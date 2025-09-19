import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { News } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { S3Service } from '../common/services/s3.service';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private newsRepository: Repository<News>,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    createNewsDto: CreateNewsDto,
    files?: Express.Multer.File[],
    user?: any,
  ) {
    let imageUrl = createNewsDto.imageUrl;
    let additionalImages: string[] = createNewsDto.additionalImages || [];

    // If files are uploaded, upload them to S3 and get the URLs
    if (files && files.length > 0) {
      // Use the first file as the main image if no imageUrl is provided
      if (!imageUrl && files.length > 0) {
        const mainImageResult = await this.s3Service.uploadFile(
          files[0],
          'news',
        );
        imageUrl = mainImageResult.url;
      }

      // Upload additional images starting from index 1 or 0 depending on whether we used one for the main image
      const startIndex = !imageUrl ? 1 : 0;

      if (startIndex < files.length) {
        const additionalFiles = files.slice(startIndex);
        const uploadResults = await this.s3Service.uploadFiles(
          additionalFiles,
          'news',
        );
        additionalImages = [
          ...additionalImages,
          ...uploadResults.map((result) => result.url),
        ];
      }
    }

    const news = this.newsRepository.create({
      ...createNewsDto,
      imageUrl,
      additionalImages:
        additionalImages.length > 0 ? additionalImages : undefined,
      isPublic: createNewsDto.isPublic ?? true,
      isFeatured: createNewsDto.isFeatured ?? false,
    });

    return this.newsRepository.save(news);
  }

  async findAll(query?: { 
    search?: string;
    isPublic?: boolean;
    category?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ data: News[]; total: number; page: number; limit: number; totalPages: number }> {
    const whereCondition: any = {};

    if (query?.search) {
      whereCondition.title = Like(`%${query.search}%`);
    }

    if (query?.isPublic !== undefined) {
      whereCondition.isPublic = query.isPublic;
    }

    if (query?.category) {
      whereCondition.category = query.category;
    }

    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [data, total] = await this.newsRepository.findAndCount({
      where: Object.keys(whereCondition).length > 0 ? whereCondition : {},
      order: { [sortBy]: sortOrder },
      skip,
      take: limit,
      relations: ['admin'],
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<News> {
    const news = await this.newsRepository.findOne({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News with ID ${id} not found`);
    }
    return news;
  }

  async update(
    id: string,
    updateNewsDto: UpdateNewsDto,
    files?: Express.Multer.File[],
  ) {
    const news = await this.findOne(id);
    let additionalImages = news.additionalImages || [];

    // If files are uploaded, process them
    if (files && files.length > 0) {
      // Check if we should replace the main image
      if (updateNewsDto.replaceMainImage) {
        // Delete the old main image from S3 if it exists
        if (news.imageUrl) {
          try {
            await this.s3Service.deleteFile(news.imageUrl);
          } catch (error) {
            // Log the error but continue with the update
            console.error('Error deleting old main image from S3:', error);
          }
        }

        // Use the first file as the new main image
        const mainImageResult = await this.s3Service.uploadFile(
          files[0],
          'news',
        );
        updateNewsDto.imageUrl = mainImageResult.url;

        // Process remaining files as additional images
        if (files.length > 1) {
          const additionalFiles = files.slice(1);
          const uploadResults = await this.s3Service.uploadFiles(
            additionalFiles,
            'news',
          );
          additionalImages = [
            ...additionalImages,
            ...uploadResults.map((result) => result.url),
          ];
        }
      } else {
        // Add all files as additional images
        const uploadResults = await this.s3Service.uploadFiles(files, 'news');
        additionalImages = [
          ...additionalImages,
          ...uploadResults.map((result) => result.url),
        ];
      }

      // Update the additionalImages field
      updateNewsDto.additionalImages = additionalImages;
    }

    // Update the news entity with the new data
    Object.assign(news, updateNewsDto);

    return this.newsRepository.save(news);
  }

  async remove(id: string) {
    const news = await this.findOne(id);

    // Delete the main image from S3 if it exists
    if (news.imageUrl) {
      try {
        await this.s3Service.deleteFile(news.imageUrl);
      } catch (error) {
        // Log the error but continue with the deletion
        console.error('Error deleting main image from S3:', error);
      }
    }

    // Delete all additional images from S3 if they exist
    if (news.additionalImages && news.additionalImages.length > 0) {
      for (const imageUrl of news.additionalImages) {
        try {
          await this.s3Service.deleteFile(imageUrl);
        } catch (error) {
          // Log the error but continue with the deletion
          console.error('Error deleting additional image from S3:', error);
        }
      }
    }

    return this.newsRepository.remove(news);
  }

  async findFeatured(): Promise<News[]> {
    return this.newsRepository.find({
      where: { isFeatured: true },
      order: { createdAt: 'DESC' },
    });
  }

  async toggleFeatured(id: string): Promise<News> {
    const news = await this.findOne(id);
    news.isFeatured = !news.isFeatured;
    return this.newsRepository.save(news);
  }

  async togglePublic(id: string): Promise<News> {
    const news = await this.findOne(id);
    news.isPublic = !news.isPublic;
    return this.newsRepository.save(news);
  }

  async findPublic(): Promise<News[]> {
    return this.newsRepository.find({
      where: { isPublic: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findLatest(limit: number = 5): Promise<News[]> {
    return this.newsRepository.find({
      where: { isPublic: true },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['admin'],
    });
  }
}
