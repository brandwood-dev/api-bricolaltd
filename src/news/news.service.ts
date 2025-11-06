import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { News } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { S3Service } from '../common/services/s3.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private newsRepository: Repository<News>,
    private readonly s3Service: S3Service,
    private readonly categoriesService: CategoriesService,
  ) {}

  // Validation dédiée à la création
  async validateCreatePayload(
    createNewsDto: CreateNewsDto,
    files?: Express.Multer.File[],
  ): Promise<{ valid: boolean; errors: Record<string, string[]>; errorCodes: Record<string, string[]> }> {
    const errors: Record<string, string[]> = {};
    const errorCodes: Record<string, string[]> = {};

    const pushError = (field: string, message: string, code: string) => {
      if (!errors[field]) errors[field] = [];
      if (!errorCodes[field]) errorCodes[field] = [];
      errors[field].push(message);
      errorCodes[field].push(code);
      console.warn('[NewsService][Validation][Error]', { field, code, message });
    };

    // Title validation
    const title = (createNewsDto.title || '').trim();
    console.log('[NewsService][Validation] title received:', title, 'length:', title.length);
    if (!title) {
      pushError('title', 'Le titre est requis.', 'TITLE_REQUIRED');
    } else {
      if (title.length < 5)
        pushError('title', 'Le titre doit contenir au moins 5 caractères.', 'TITLE_TOO_SHORT');
      if (title.length > 200)
        pushError('title', 'Le titre ne doit pas dépasser 200 caractères.', 'TITLE_TOO_LONG');
    }

    // Content validation
    const content = (createNewsDto.content || '').trim();
    console.log('[NewsService][Validation] content length:', content.length, 'preview:', content.substring(0, 60));
    if (!content) {
      pushError('content', 'Le contenu est requis.', 'CONTENT_REQUIRED');
    } else {
      if (content.length < 10)
        pushError('content', 'Le contenu doit contenir au moins 10 caractères.', 'CONTENT_TOO_SHORT');
    }

    // Category validation (require category name only)
    const categoryName = (createNewsDto.category || '').trim();
    console.log('[NewsService][Validation] category received:', categoryName);
    if (!categoryName) {
      pushError('category', 'La catégorie est requise.', 'CATEGORY_REQUIRED');
    }

    // URL validation for imageUrl and additionalImages (if provided)
    const isValidImageUrl = (url?: string) => {
      if (!url) return true;
      try {
        const u = new URL(url);
        const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
        const lower = u.pathname.toLowerCase();
        return ['http:', 'https:'].includes(u.protocol) && allowedExt.some((ext) => lower.endsWith(ext));
      } catch {
        return false;
      }
    };

    console.log('[NewsService][Validation] imageUrl:', createNewsDto.imageUrl);
    if (createNewsDto.imageUrl && !isValidImageUrl(createNewsDto.imageUrl)) {
      pushError('imageUrl', "L'URL de l'image de couverture est invalide (http(s) et formats jpg/png/webp).", 'IMAGE_URL_INVALID');
    }
    // Files validation: images only, <=5MB each
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    console.log('[NewsService][Validation] files received count:', files?.length || 0);
    if (files && files.length > 0) {
      files.forEach((file, idx) => {
        console.log(`[NewsService][Validation] file #${idx+1} mimetype:`, file.mimetype, 'size:', file.size);
        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
          pushError('files', `Le fichier #${idx + 1} n'est pas une image.`, 'INVALID_MIME_TYPE');
        }
        if (file.size > MAX_IMAGE_SIZE) {
          pushError('files', `Le fichier #${idx + 1} dépasse 5 Mo.`, 'IMAGE_TOO_LARGE');
        }
      });
    }

    const valid = Object.keys(errors).length === 0;
    return { valid, errors, errorCodes };
  }

  async create(
    createNewsDto: CreateNewsDto,
    files?: Express.Multer.File[],
    user?: any,
  ) {
    // Validate before processing
    const validation = await this.validateCreatePayload(createNewsDto, files);
    if (!validation.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: validation.errors, errorCodes: validation.errorCodes });
    }

    let imageUrl = createNewsDto.imageUrl;

    // If files are uploaded, upload only the first as main image
    if (files && files.length > 0) {
      if (!imageUrl) {
        const mainImageResult = await this.s3Service.uploadFile(
          files[0],
          'news',
        );
        imageUrl = mainImageResult.url;
      }
    }

    const news = this.newsRepository.create({
      ...createNewsDto,
      imageUrl,
      isPublic: createNewsDto.isPublic ?? true,
      isFeatured: createNewsDto.isFeatured ?? false,
      adminId: user?.id ?? undefined,
    });

    const saved = await this.newsRepository.save(news);

    // Compute and attach adminName, but do not expose admin object
    const adminName = user ? ((user.displayName) || [user.firstName, user.lastName].filter(Boolean).join(' ').trim()) : undefined;
    const { admin, ...safe } = saved as any;
    return { ...safe, adminName } as News;
  }

  async findAll(query?: { 
    search?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    category?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const whereCondition: any = {};

    if (query?.search) {
      whereCondition.title = Like(`%${query.search}%`);
    }

    if (query?.isPublic !== undefined) {
      whereCondition.isPublic = query.isPublic;
    }

    if (query?.isFeatured !== undefined) {
      whereCondition.isFeatured = query.isFeatured;
    }

    if (query?.category) {
      whereCondition.category = query.category;
    }

    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const qb = this.newsRepository.createQueryBuilder('news')
      .leftJoin('news.admin', 'admin')
      .addSelect(['admin.firstName', 'admin.lastName', 'admin.displayName'])
      .where(Object.keys(whereCondition).length > 0 ? whereCondition : {})
      .orderBy(`news.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const safeData = data.map((n) => {
      const adminName = n?.admin ? (n.admin.displayName || [n.admin.firstName, n.admin.lastName].filter(Boolean).join(' ').trim()) : undefined;
      const { admin, ...rest } = n as any;
      return { ...rest, adminName };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: safeData,
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
    // If files are uploaded, process only the first as main image when replaceMainImage is true
    if (files && files.length > 0) {
      if (updateNewsDto.replaceMainImage) {
        // Delete the old main image from S3 if it exists
        if (news.imageUrl) {
          try {
            await this.s3Service.deleteFile(news.imageUrl);
          } catch (error) {
            console.error('Error deleting old main image from S3:', error);
          }
        }

        // Use the first file as the new main image
        const mainImageResult = await this.s3Service.uploadFile(
          files[0],
          'news',
        );
        updateNewsDto.imageUrl = mainImageResult.url;
      }
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

  async findLatest(limit: number = 5): Promise<any[]> {
    const qb = this.newsRepository.createQueryBuilder('news')
      .leftJoin('news.admin', 'admin')
      .addSelect(['admin.firstName', 'admin.lastName', 'admin.displayName'])
      .where('news.isPublic = :isPublic', { isPublic: true })
      .orderBy('news.createdAt', 'DESC')
      .take(limit);

    const items = await qb.getMany();
    return items.map((n) => {
      const adminName = n?.admin ? (n.admin.displayName || [n.admin.firstName, n.admin.lastName].filter(Boolean).join(' ').trim()) : undefined;
      const { admin, ...rest } = n as any;
      return { ...rest, adminName };
    });
  }
}
