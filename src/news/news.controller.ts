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
  Query,
  SetMetadata,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response, Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('news')
export class NewsController {
  private readonly logger = new Logger(NewsController.name);

  constructor(private readonly newsService: NewsService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Body() createNewsDto: CreateNewsDto,
    @Req() req: Request & { files?: { [fieldname: string]: Express.Multer.File[] } },
  ) {
    this.logger.debug('Début création article');
    console.log('[NewsController][Create] incoming', {
      url: (req as any).originalUrl || '/news',
      method: (req as any).method || 'POST',
      contentType: req.headers['content-type'],
      hasAuth: Boolean(req.headers['authorization']),
    });
    console.log('[NewsController][Create] body keys', Object.keys(req.body || {}));
    console.log('[NewsController][Create] dto snapshot', createNewsDto);

    // Consolidate files from middleware without depending on shape
    const allFiles: Express.Multer.File[] = [];
    const incomingFiles: any = (req as any).files;
    let filesObj: { [fieldname: string]: Express.Multer.File[] } = {};

    if (Array.isArray(incomingFiles)) {
      console.warn('[NewsController][Create] req.files is array (legacy)');
      allFiles.push(...incomingFiles);
    } else if (incomingFiles && typeof incomingFiles === 'object') {
      filesObj = incomingFiles as { [fieldname: string]: Express.Multer.File[] };
      const mainImageFiles = filesObj?.mainImage || [];
      const genericFiles = filesObj?.files || [];
      allFiles.push(...mainImageFiles, ...genericFiles);
      console.log('[NewsController][Create] files fields', Object.keys(filesObj));
      console.log('[NewsController][Create] mainImage count', mainImageFiles.length, 'files count', genericFiles.length);
    } else {
      console.log('[NewsController][Create] no files provided');
    }

    this.logger.debug({ body: createNewsDto, filesConsolidated: allFiles.length });

    // Validation dédiée via le service
    try {
      const validation = await this.newsService.validateCreatePayload(
        createNewsDto,
        allFiles,
      );
      console.log('[NewsController][Create] validation result', validation);
      if (!validation.valid) {
        this.logger.warn('Échec validation création article', validation);
        console.warn('[NewsController][Create][ValidationError]', validation);
        throw new BadRequestException({
          message: 'Validation failed',
          errors: validation.errors,
          errorCodes: validation.errorCodes,
        });
      }
    } catch (err) {
      this.logger.error('Erreur lors de la validation', err);
      console.error('[NewsController][Create][ValidationException]', err);
      throw err;
    }

    try {
      const user = (req as any).user;
      const created = await this.newsService.create(createNewsDto, allFiles, user);
      this.logger.log(`Article créé avec succès: ${created.id}`);
      console.log('[NewsController][Create] created article id', created?.id);
      return created;
    } catch (error) {
      this.logger.error("Erreur lors de la création de l'article", error);
      console.error('[NewsController][Create][CreateException]', error);
      throw error;
    }
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('isPublic') isPublicStr?: string,
    @Query('isFeatured') isFeaturedStr?: string,
    @Query('category') category?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const isPublic = typeof isPublicStr === 'string' ? isPublicStr === 'true' : undefined
    const isFeatured = typeof isFeaturedStr === 'string' ? isFeaturedStr === 'true' : undefined
    const page = pageStr ? parseInt(pageStr, 10) || 1 : 1
    const limit = limitStr ? parseInt(limitStr, 10) || 10 : 10
    const order = (sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    const filters = {
      search,
      isPublic,
      isFeatured,
      category,
      page,
      limit,
      sortBy: sortBy || 'createdAt',
      sortOrder: order,
    }

    console.log('[NewsController][FindAll] filters:', filters)
    return this.newsService.findAll(filters)
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

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @Req() req: Request & { files?: { [fieldname: string]: Express.Multer.File[] } },
  ) {
    // Consolidate files from middleware without depending on shape
    const allFiles: Express.Multer.File[] = [];
    const incomingFiles: any = (req as any).files;
    let filesObj: { [fieldname: string]: Express.Multer.File[] } = {};

    if (Array.isArray(incomingFiles)) {
      console.warn('[NewsController][Update] req.files is array (legacy)');
      allFiles.push(...incomingFiles);
    } else if (incomingFiles && typeof incomingFiles === 'object') {
      filesObj = incomingFiles as { [fieldname: string]: Express.Multer.File[] };
      const mainImageFiles = filesObj?.mainImage || [];
      const genericFiles = filesObj?.files || [];
      allFiles.push(...mainImageFiles, ...genericFiles);
      console.log('[NewsController][Update] files fields', Object.keys(filesObj));
      console.log('[NewsController][Update] mainImage count', mainImageFiles.length, 'files count', genericFiles.length);
    } else {
      console.log('[NewsController][Update] no files provided');
    }

    return this.newsService.update(id, updateNewsDto, allFiles);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/toggle-featured')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle featured status of a news article' })
  @ApiResponse({ status: 200, description: 'News article featured status toggled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async toggleFeatured(@Param('id') id: string) {
    console.log('[NewsController][ToggleFeatured] called for id', id)
    return this.newsService.toggleFeatured(id)
  }
  
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/toggle-public')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle public status of a news article' })
  @ApiResponse({ status: 200, description: 'News article public status toggled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async togglePublic(@Param('id') id: string) {
    console.log('[NewsController][TogglePublic] called for id', id)
    return this.newsService.togglePublic(id)
  }

  // Public HTML endpoint for social media crawlers to read OG/Twitter meta tags
  @Get(':id/share')
  @SetMetadata('isPublic', true)
  async shareHtml(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const news = await this.newsService.findOne(id);

      const siteBase = process.env.FRONTEND_URL || 'https://www.bricolaltd.com';
      const canonicalUrl = new URL(`/blog/${news.id}`, siteBase).href;

      const ensureAbsolute = (url?: string): string | undefined => {
        if (!url) return undefined;
        try {
          return new URL(url, siteBase).href;
        } catch {
          return url as string;
        }
      };

      const imageUrl = ensureAbsolute(news.imageUrl) || `${siteBase}/placeholder-blog.svg`;
      const title = news.title || 'Article Bricola';
      const description = news.summary || title;

      const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />

  <!-- Meta refresh to redirect human users to the canonical page -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <noscript>
    <a href="${canonicalUrl}">Continuer vers l’article</a>
  </noscript>
  <script>
    try { window.location.replace('${canonicalUrl}'); } catch (e) { window.location.href = '${canonicalUrl}'; }
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      this.logger.error('Error generating share HTML', err as any);
      res.status(404).send('<html><body>Article non trouvé</body></html>');
    }
  }
}

// Simple HTML escaping to prevent breaking tags
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
