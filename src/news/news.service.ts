import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { News } from './entities/news.entity';
import { Section } from './entities/section.entity';
import { SectionParagraph } from './entities/section-paragraph.entity';
import { SectionImage } from './entities/section-image.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { S3Service } from '../common/services/s3.service';
import { CategoriesService } from '../categories/categories.service';
import { SectionsService } from './sections.service';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private newsRepository: Repository<News>,
    @InjectRepository(Section)
    private sectionRepository: Repository<Section>,
    @InjectRepository(SectionParagraph)
    private paragraphRepository: Repository<SectionParagraph>,
    @InjectRepository(SectionImage)
    private imageRepository: Repository<SectionImage>,
    private readonly s3Service: S3Service,
    private readonly categoriesService: CategoriesService,
    private readonly sectionsService: SectionsService,
  ) {}

  // Validation dédiée à la création
  async validateCreatePayload(
    createNewsDto: CreateNewsDto,
    files?: Express.Multer.File[],
  ): Promise<{
    valid: boolean;
    errors: Record<string, string[]>;
    errorCodes: Record<string, string[]>;
  }> {
    const errors: Record<string, string[]> = {};
    const errorCodes: Record<string, string[]> = {};

    const pushError = (field: string, message: string, code: string) => {
      if (!errors[field]) errors[field] = [];
      if (!errorCodes[field]) errorCodes[field] = [];
      errors[field].push(message);
      errorCodes[field].push(code);
      console.warn('[NewsService][Validation][Error]', {
        field,
        code,
        message,
      });
    };

    // Title validation
    const title = (createNewsDto.title || '').trim();
    console.log(
      '[NewsService][Validation] title received:',
      title,
      'length:',
      title.length,
    );
    if (!title) {
      pushError('title', 'Le titre est requis.', 'TITLE_REQUIRED');
    } else {
      if (title.length < 5)
        pushError(
          'title',
          'Le titre doit contenir au moins 5 caractères.',
          'TITLE_TOO_SHORT',
        );
      if (title.length > 200)
        pushError(
          'title',
          'Le titre ne doit pas dépasser 200 caractères.',
          'TITLE_TOO_LONG',
        );
    }

    // Content/Sections validation - either content or sections must be provided
    const hasContent = !!(createNewsDto.content || '').trim();
    const hasSections = !!(
      createNewsDto.sections && createNewsDto.sections.length > 0
    );

    console.log(
      '[NewsService][Validation] hasContent:',
      hasContent,
      'hasSections:',
      hasSections,
    );

    if (!hasContent && !hasSections) {
      pushError(
        'content',
        'Le contenu ou les sections sont requis.',
        'CONTENT_REQUIRED',
      );
      pushError(
        'sections',
        'Le contenu ou les sections sont requis.',
        'SECTIONS_REQUIRED',
      );
    }

    // Validate sections if provided
    if (hasSections && createNewsDto.sections) {
      createNewsDto.sections.forEach((section, sectionIndex) => {
        if (!section.title || section.title.trim().length < 3) {
          pushError(
            `sections[${sectionIndex}].title`,
            `Le titre de la section ${sectionIndex + 1} doit contenir au moins 3 caractères.`,
            'SECTION_TITLE_TOO_SHORT',
          );
        }

        // Validate paragraphs
        if (section.paragraphs) {
          section.paragraphs.forEach((paragraph, paraIndex) => {
            if (!paragraph.content || paragraph.content.trim().length < 10) {
              pushError(
                `sections[${sectionIndex}].paragraphs[${paraIndex}]`,
                `Le paragraphe ${paraIndex + 1} de la section ${sectionIndex + 1} doit contenir au moins 10 caractères.`,
                'PARAGRAPH_TOO_SHORT',
              );
            }
          });
        }

        // Validate images
        if (section.images) {
          section.images.forEach((image, imgIndex) => {
            if (!image.url || !isValidImageUrl(image.url)) {
              pushError(
                `sections[${sectionIndex}].images[${imgIndex}]`,
                `L'URL de l'image ${imgIndex + 1} de la section ${sectionIndex + 1} est invalide.`,
                'SECTION_IMAGE_URL_INVALID',
              );
            }
          });
        }
      });
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
        return (
          ['http:', 'https:'].includes(u.protocol) &&
          allowedExt.some((ext) => lower.endsWith(ext))
        );
      } catch {
        return false;
      }
    };

    // Validate main image URL
    console.log('[NewsService][Validation] imageUrl:', createNewsDto.imageUrl);
    if (createNewsDto.imageUrl && !isValidImageUrl(createNewsDto.imageUrl)) {
      pushError(
        'imageUrl',
        "L'URL de l'image de couverture est invalide (http(s) et formats jpg/png/webp).",
        'IMAGE_URL_INVALID',
      );
    }

    console.log('[NewsService][Validation] imageUrl:', createNewsDto.imageUrl);
    if (createNewsDto.imageUrl && !isValidImageUrl(createNewsDto.imageUrl)) {
      pushError(
        'imageUrl',
        "L'URL de l'image de couverture est invalide (http(s) et formats jpg/png/webp).",
        'IMAGE_URL_INVALID',
      );
    }
    // Files validation: images only, <=5MB each
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    console.log(
      '[NewsService][Validation] files received count:',
      files?.length || 0,
    );
    if (files && files.length > 0) {
      files.forEach((file, idx) => {
        console.log(
          `[NewsService][Validation] file #${idx + 1} mimetype:`,
          file.mimetype,
          'size:',
          file.size,
        );
        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
          pushError(
            'files',
            `Le fichier #${idx + 1} n'est pas une image.`,
            'INVALID_MIME_TYPE',
          );
        }
        if (file.size > MAX_IMAGE_SIZE) {
          pushError(
            'files',
            `Le fichier #${idx + 1} dépasse 5 Mo.`,
            'IMAGE_TOO_LARGE',
          );
        }
      });
    }

    const valid = Object.keys(errors).length === 0;
    return { valid, errors, errorCodes };
  }

  // Helper method to process inline images in content
  private async processInlineImages(
    content: string,
    files?: Express.Multer.File[],
  ): Promise<string> {
    if (!content || !files || files.length === 0) {
      return content;
    }

    let processedContent = content;

    // Find image placeholders and replace with uploaded URLs
    const imagePlaceholderRegex = /\{\{IMAGE_(\d+)\}\}/g;
    const matches = [...content.matchAll(imagePlaceholderRegex)];

    // Upload inline images (skip the first file if it's the main cover image)
    const inlineFiles = files.slice(1); // Skip cover image

    for (let i = 0; i < matches.length && i < inlineFiles.length; i++) {
      const placeholder = matches[i][0];
      const fileIndex = parseInt(matches[i][1]);
      const file = inlineFiles[fileIndex];

      if (file) {
        try {
          const uploadResult = await this.s3Service.uploadFile(
            file,
            'news/inline',
          );
          const imageUrl = uploadResult.url;

          // Replace placeholder with actual image tag
          const imageTag = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; height: auto;" />`;
          processedContent = processedContent.replace(placeholder, imageTag);

          console.log(
            `[NewsService] Replaced inline image placeholder ${placeholder} with URL: ${imageUrl}`,
          );
        } catch (error) {
          console.error(
            `[NewsService] Failed to upload inline image ${placeholder}:`,
            error,
          );
          // Keep placeholder if upload fails
        }
      }
    }

    return processedContent;
  }

  // Helper method to create sections for an article
  private async createSections(
    newsId: string,
    sectionsDto: CreateSectionDto[],
  ): Promise<void> {
    for (let i = 0; i < sectionsDto.length; i++) {
      const sectionDto = sectionsDto[i];

      // Create section
      const section = this.sectionRepository.create({
        title: sectionDto.title,
        orderIndex: sectionDto.orderIndex,
        newsId: newsId,
      });

      const savedSection = await this.sectionRepository.save(section);

      // Create paragraphs
      if (sectionDto.paragraphs && sectionDto.paragraphs.length > 0) {
        for (let j = 0; j < sectionDto.paragraphs.length; j++) {
          const paragraphDto = sectionDto.paragraphs[j];
          const paragraph = this.paragraphRepository.create({
            content: paragraphDto.content,
            orderIndex: paragraphDto.orderIndex,
            sectionId: savedSection.id,
          });
          await this.paragraphRepository.save(paragraph);
        }
      }

      // Create images
      if (sectionDto.images && sectionDto.images.length > 0) {
        for (let k = 0; k < sectionDto.images.length; k++) {
          const imageDto = sectionDto.images[k];
          const image = this.imageRepository.create({
            url: imageDto.url,
            alt: imageDto.alt,
            orderIndex: imageDto.orderIndex,
            sectionId: savedSection.id,
          });
          await this.imageRepository.save(image);
        }
      }
    }
  }

  async create(
    createNewsDto: CreateNewsDto,
    files?: Express.Multer.File[],
    user?: any,
  ) {
    // Validate before processing
    const validation = await this.validateCreatePayload(createNewsDto, files);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.errors,
        errorCodes: validation.errorCodes,
      });
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

    // Process inline images in content
    const processedContent = createNewsDto.content
      ? await this.processInlineImages(createNewsDto.content, files)
      : createNewsDto.content;

    // const normalizeBoolean = (val: any, defaultVal: boolean) => {
    //   if (typeof val === 'boolean') return val;
    //   if (typeof val === 'string') {
    //     const v = val.toLowerCase();
    //     if (v === 'true') return true;
    //     if (v === 'false') return false;
    //   }
    //   return defaultVal;
    // };

    const news = this.newsRepository.create({
      ...createNewsDto,
      content: processedContent,
      imageUrl,
      isPublic: false,
      isFeatured: false,
      adminId: user?.id ?? undefined,
    });

    const saved = await this.newsRepository.save(news);

    // Handle sections if provided
    let savedSections: Section[] = [];
    if (createNewsDto.sections && createNewsDto.sections.length > 0) {
      console.log(
        '[NewsService] Processing sections:',
        createNewsDto.sections.length,
      );
      await this.createSections(saved.id, createNewsDto.sections);
      console.log('[NewsService] Sections saved');

      // Load the saved sections
      savedSections = await this.sectionsService.findByArticle(saved.id);
    }

    // Compute and attach adminName, but do not expose admin object
    const adminName = user
      ? user.displayName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      : undefined;
    const { admin, ...safe } = saved as any;

    // Return the news with sections
    return {
      ...safe,
      adminName,
      sections: savedSections.length > 0 ? savedSections : undefined,
    } as News;
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
  }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
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

    const qb = this.newsRepository
      .createQueryBuilder('news')
      .leftJoin('news.admin', 'admin')
      .addSelect(['admin.firstName', 'admin.lastName', 'admin.displayName'])
      .where(Object.keys(whereCondition).length > 0 ? whereCondition : {})
      .orderBy(`news.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const safeData = data.map((n) => {
      const adminName = n?.admin
        ? n.admin.displayName ||
          [n.admin.firstName, n.admin.lastName].filter(Boolean).join(' ').trim()
        : undefined;
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
    const news = await this.newsRepository.findOne({
      where: { id },
      relations: [
        'admin',
        'sections',
        'sections.paragraphs',
        'sections.images',
      ],
    });
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

    // Process inline images in content if content is being updated (legacy support)
    if (updateNewsDto.content) {
      updateNewsDto.content = await this.processInlineImages(
        updateNewsDto.content || '',
        files,
      );
    }

    // Handle sections update if provided
    let updatedSections: Section[] = [];
    if (updateNewsDto.sections) {
      // Delete existing sections and recreate
      await this.sectionRepository.delete({ newsId: id });
      await this.createSections(id, updateNewsDto.sections);

      // Load the newly created sections
      updatedSections = await this.sectionsService.findByArticle(id);
    }

    const normalizeBoolean = (val: any, defaultVal: boolean) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v === 'true') return true;
        if (v === 'false') return false;
      }
      return defaultVal;
    };

    const patchedUpdate: any = { ...updateNewsDto };
    // if ((updateNewsDto as any).isPublic !== undefined) {
    //   patchedUpdate.isPublic = normalizeBoolean(
    //     (updateNewsDto as any).isPublic,
    //     news.isPublic,
    //   );
    // }
    // if ((updateNewsDto as any).isFeatured !== undefined) {
    //   patchedUpdate.isFeatured = normalizeBoolean(
    //     (updateNewsDto as any).isFeatured,
    //     news.isFeatured,
    //   );
    // }

    Object.assign(news, patchedUpdate);

    const updatedNews = await this.newsRepository.save(news);

    // Return with sections
    const adminName = updatedNews.admin
      ? updatedNews.admin.displayName ||
        [updatedNews.admin.firstName, updatedNews.admin.lastName]
          .filter(Boolean)
          .join(' ')
          .trim()
      : undefined;
    const { admin, ...safe } = updatedNews as any;

    return {
      ...safe,
      adminName,
      sections: updatedSections.length > 0 ? updatedSections : undefined,
    } as News;
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

  // Sequential save methods
  async saveSection(
    articleId: string,
    sectionData: { title: string; orderIndex: number },
  ): Promise<Section> {
    console.log(
      `[NewsService] Saving section for article ${articleId}:`,
      sectionData,
    );

    try {
      const section = await this.sectionsService.create({
        newsId: articleId,
        title: sectionData.title,
        orderIndex: sectionData.orderIndex,
      });

      console.log(`[NewsService] Section saved:`, section.id);
      return section;
    } catch (error) {
      console.error('[NewsService] Error saving section:', error);
      throw error;
    }
  }

  async saveSectionParagraph(
    sectionId: string,
    paragraphData: { content: string; orderIndex: number },
  ): Promise<SectionParagraph> {
    console.log(
      `[NewsService] Saving paragraph for section ${sectionId}:`,
      paragraphData,
    );

    try {
      const paragraph = await this.sectionsService.addParagraph(
        sectionId,
        paragraphData,
      );

      console.log(`[NewsService] Paragraph saved:`, paragraph.id);
      return paragraph;
    } catch (error) {
      console.error('[NewsService] Error saving paragraph:', error);
      throw error;
    }
  }

  async saveSectionImage(
    sectionId: string,
    imageData: { url: string; alt?: string; orderIndex: number },
  ): Promise<SectionImage> {
    console.log(
      `[NewsService] Saving image for section ${sectionId}:`,
      imageData,
    );

    try {
      const image = this.imageRepository.create({
        url: imageData.url,
        alt: imageData.alt || '',
        orderIndex: imageData.orderIndex,
        sectionId,
      });

      const savedImage = await this.imageRepository.save(image);
      console.log(`[NewsService] Image saved:`, savedImage.id);
      return savedImage;
    } catch (error) {
      console.error('[NewsService] Error saving image:', error);
      throw error;
    }
  }

  async createSection(
    newsId: string,
    sectionData: { title: string; orderIndex: number },
  ): Promise<Section> {
    console.log(
      `[NewsService] Creating section for news ${newsId}:`,
      sectionData,
    );

    try {
      // Verify the article exists
      const news = await this.newsRepository.findOne({ where: { id: newsId } });
      if (!news) {
        throw new NotFoundException(`Article with ID ${newsId} not found`);
      }

      // Create the section
      const section = this.sectionRepository.create({
        title: sectionData.title,
        orderIndex: sectionData.orderIndex,
        newsId: newsId,
      });

      const savedSection = await this.sectionRepository.save(section);
      console.log(
        `[NewsService] Section created successfully:`,
        savedSection.id,
      );

      return savedSection;
    } catch (error) {
      console.error('[NewsService] Error creating section:', error);
      throw error;
    }
  }

  async createSectionParagraph(
    sectionId: string,
    paragraphData: { content: string; orderIndex: number },
  ): Promise<SectionParagraph> {
    console.log(
      `[NewsService] Creating paragraph for section ${sectionId}:`,
      paragraphData,
    );

    try {
      // Verify the section exists
      const section = await this.sectionRepository.findOne({
        where: { id: sectionId },
      });
      if (!section) {
        throw new NotFoundException(`Section with ID ${sectionId} not found`);
      }

      // Create the paragraph
      const paragraph = this.paragraphRepository.create({
        content: paragraphData.content,
        orderIndex: paragraphData.orderIndex,
        sectionId: sectionId,
      });

      const savedParagraph = await this.paragraphRepository.save(paragraph);
      console.log(
        `[NewsService] Paragraph created successfully:`,
        savedParagraph.id,
      );

      return savedParagraph;
    } catch (error) {
      console.error('[NewsService] Error creating paragraph:', error);
      throw error;
    }
  }

  async createSectionImageWithUrl(
    sectionId: string,
    imageData: { url: string; alt?: string; orderIndex?: number },
  ): Promise<SectionImage> {
    console.log(
      `[NewsService] Creating image for section ${sectionId}:`,
      imageData,
    );

    try {
      // Verify the section exists
      const section = await this.sectionRepository.findOne({
        where: { id: sectionId },
      });
      if (!section) {
        throw new NotFoundException(`Section with ID ${sectionId} not found`);
      }

      // Create the image
      const image = this.imageRepository.create({
        url: imageData.url,
        alt: imageData.alt || '',
        orderIndex: imageData.orderIndex || 0,
        sectionId: sectionId,
      });

      const savedImage = await this.imageRepository.save(image);
      console.log(`[NewsService] Image created successfully:`, savedImage.id);

      return savedImage;
    } catch (error) {
      console.error('[NewsService] Error creating image:', error);
      throw error;
    }
  }

  async findLatest(limit: number = 5): Promise<any[]> {
    const qb = this.newsRepository
      .createQueryBuilder('news')
      .leftJoin('news.admin', 'admin')
      .addSelect(['admin.firstName', 'admin.lastName', 'admin.displayName'])
      .where('news.isPublic = :isPublic', { isPublic: true })
      .orderBy('news.createdAt', 'DESC')
      .take(limit);

    const items = await qb.getMany();
    return items.map((n) => {
      const adminName = n?.admin
        ? n.admin.displayName ||
          [n.admin.firstName, n.admin.lastName].filter(Boolean).join(' ').trim()
        : undefined;
      const { admin, ...rest } = n as any;
      return { ...rest, adminName };
    });
  }
}
