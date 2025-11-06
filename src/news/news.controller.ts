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
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { Response, Request } from 'express';

@Controller('news')
export class NewsController {
  private readonly logger = new Logger(NewsController.name);

  constructor(private readonly newsService: NewsService) {}

  @UseGuards(AdminGuard)
  @Post()
  async create(
    @Body() createNewsDto: CreateNewsDto,
    @Req() req: Request & { files?: { [fieldname: string]: Express.Multer.File[] } },
    @Res() res: Response,
  ) {
    this.logger.debug('Début création article');

    // Consolider les fichiers depuis les différents champs gérés par le middleware
    const allFiles: Express.Multer.File[] = [];
    const files = req.files || {};
    const mainImageFiles = files?.mainImage || [];
    const additionalImageFiles = files?.additionalImages || [];
    const genericFiles = files?.files || [];
    allFiles.push(...mainImageFiles, ...additionalImageFiles, ...genericFiles);

    // Extraire les additionalImages[] envoyées via champs bracketés (additionalImages[0], etc.)
    const body: any = req.body || {};
    const additionalImageUrls: string[] = [];
    Object.keys(body).forEach((key) => {
      if (key.startsWith('additionalImages[')) {
        const val = body[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          additionalImageUrls.push(val.trim());
        }
      }
    });
    if (additionalImageUrls.length > 0) {
      createNewsDto.additionalImages = [
        ...(createNewsDto.additionalImages || []),
        ...additionalImageUrls,
      ];
    }

    this.logger.debug({ body: createNewsDto, files: Object.keys(files || {}) });

    // Validation dédiée via le service
    try {
      const validation = await this.newsService.validateCreatePayload(
        createNewsDto,
        allFiles,
      );
      if (!validation.valid) {
        this.logger.warn('Échec validation création article', validation);
        throw new BadRequestException({
          message: 'Validation failed',
          errors: validation.errors,
          errorCodes: validation.errorCodes,
        });
      }
    } catch (err) {
      this.logger.error('Erreur lors de la validation', err);
      throw err;
    }

    try {
      const user = (req as any).user;
      const created = await this.newsService.create(createNewsDto, allFiles, user);
      this.logger.log(`Article créé avec succès: ${created.id}`);
      return res.json(created);
    } catch (error) {
      this.logger.error("Erreur lors de la création de l'article", error);
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.newsService.findAll();
  }

  @Get('public')
  findPublic() {
    return this.newsService.findPublic();
  }

  @Get('featured')
  findFeatured() {
    return this.newsService.findFeatured();
  }

  @Get('latest')
  findLatest() {
    return this.newsService.findLatest();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @Req() req: Request & { files?: { [fieldname: string]: Express.Multer.File[] } },
  ) {
    // Consolider les fichiers depuis les différents champs
    const allFiles: Express.Multer.File[] = [];
    const files = req.files || {};
    const mainImageFiles = files?.mainImage || [];
    const additionalImageFiles = files?.additionalImages || [];
    const genericFiles = files?.files || [];
    allFiles.push(...mainImageFiles, ...additionalImageFiles, ...genericFiles);

    return this.newsService.update(id, updateNewsDto, allFiles);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
