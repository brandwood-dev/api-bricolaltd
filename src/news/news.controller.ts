import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { Request, Response } from 'express';
import { MulterFile } from '../types/multer.types';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new news article' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'The news article has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async create(@Req() req: Request & { files?: any }, @Res() res: Response) {
    const files = req.files;
    
    // Logs détaillés pour diagnostiquer l'erreur 400
    console.log('=== DÉBUT DIAGNOSTIC NEWS CREATE ===');
    console.log('Request body fields:', JSON.stringify(req.body, null, 2));
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'No body');
    console.log('Files details:', files ? Object.keys(files).map(key => ({
      fieldName: key,
      count: Array.isArray(files[key]) ? files[key].length : 1,
      files: Array.isArray(files[key]) ? files[key].map((f: any) => ({ originalname: f.originalname, size: f.size, mimetype: f.mimetype })) : [{ originalname: (files[key] as any).originalname, size: (files[key] as any).size, mimetype: (files[key] as any).mimetype }]
    })) : 'No files');
    
    // Vérification détaillée des champs
    if (req.body) {
      console.log('Title check:', { exists: !!(req.body as any).title, value: (req.body as any).title, type: typeof (req.body as any).title });
      console.log('Content check:', { exists: !!(req.body as any).content, value: (req.body as any).content?.substring(0, 50) + '...', type: typeof (req.body as any).content });
      console.log('IsPublic check:', { exists: (req.body as any).isPublic !== undefined, value: (req.body as any).isPublic, type: typeof (req.body as any).isPublic });
      console.log('IsFeatured check:', { exists: (req.body as any).isFeatured !== undefined, value: (req.body as any).isFeatured, type: typeof (req.body as any).isFeatured });
    }

    // Vérifier les champs obligatoires
    if (!req.body || !(req.body as any).title || !(req.body as any).content) {
      console.log('❌ Validation échouée: champs obligatoires manquants');
      return res.status(400).json({
        message: 'Title and content are required',
        data: null
      });
    }

    try {
      // Transformation manuelle des données FormData vers DTO
      // Gestion des additionalImages qui arrivent avec des indices (additionalImages[0], additionalImages[1], etc.)
      const additionalImages: string[] = [];
      if (req.body) {
        Object.keys(req.body).forEach(key => {
          if (key.startsWith('additionalImages[')) {
            additionalImages.push((req.body as any)[key]);
          }
        });
      }
      
      const body = req.body as any;
      const createNewsDto: CreateNewsDto = {
        title: body.title,
        content: body.content,
      };
      
      // Ajouter les champs optionnels seulement s'ils sont fournis
      if (body.summary) {
        createNewsDto.summary = body.summary;
      }
      if (body.imageUrl) {
        createNewsDto.imageUrl = body.imageUrl;
      }
      if (additionalImages.length > 0) {
        createNewsDto.additionalImages = additionalImages;
      }
      if (body.categoryId) {
        createNewsDto.categoryId = body.categoryId;
      }
      if (body.category) {
        createNewsDto.category = body.category;
      }
      
      // Conversion des boolean seulement s'ils sont fournis
      if (body.isPublic !== undefined && body.isPublic !== '') {
        createNewsDto.isPublic = body.isPublic === 'true' || body.isPublic === true;
      }
      if (body.isFeatured !== undefined && body.isFeatured !== '') {
        createNewsDto.isFeatured = body.isFeatured === 'true' || body.isFeatured === true;
      }
      
      console.log('AdditionalImages extraites:', additionalImages);
      
      console.log('DTO créé:', JSON.stringify(createNewsDto, null, 2));
      console.log('=== APPEL SERVICE ===');

      const result = await this.newsService.create(createNewsDto, files);
      
      console.log('✅ Service réussi, résultat:', result?.id ? `Article créé avec ID: ${result.id}` : 'Résultat sans ID');
      console.log('=== FIN DIAGNOSTIC ===');
      
      return res.status(201).json({
        message: 'News created successfully',
        data: result
      });
    } catch (error) {
      console.error('❌ Erreur dans le service:', error.message);
      console.error('Stack trace:', error.stack);
      console.log('=== FIN DIAGNOSTIC (ERREUR) ===');
      return res.status(500).json({
        message: 'Internal server error: ' + error.message,
        data: null
      });
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all news articles' })
  @ApiResponse({ status: 200, description: 'Return all news articles.' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for news title',
  })
  @ApiQuery({
    name: 'isPublic',
    required: false,
    description: 'Filter by public status',
    type: Boolean,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    type: Number,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (asc or desc)',
  })
  findAll(
    @Query('search') search?: string,
    @Query('isPublic') isPublic?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const query: any = {};
    if (search) query.search = search;
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';
    if (page) query.page = parseInt(page);
    if (limit) query.limit = parseInt(limit);
    if (sortBy) query.sortBy = sortBy;
    if (sortOrder) query.sortOrder = sortOrder;

    return this.newsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured news articles' })
  @ApiResponse({ status: 200, description: 'Return featured news articles.' })
  findFeatured() {
    return this.newsService.findFeatured();
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest news articles' })
  @ApiResponse({ status: 200, description: 'Return latest news articles.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of latest articles to return',
    type: Number,
  })
  @ApiQuery({
    name: 'isPublic',
    required: false,
    description: 'Filter by public status',
    type: Boolean,
  })
  findLatest(@Query('limit') limit?: number, @Query('isPublic') isPublic?: boolean) {
    const limitValue = limit ? parseInt(limit.toString()) : 5;
    return this.newsService.findLatest(limitValue);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a news article by id' })
  @ApiResponse({ status: 200, description: 'Return the news article.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a news article' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'The news article has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @Req() req: any,
  ) {
    // The files are attached to the request by the FileUploadMiddleware
    const files = req.files;
    return this.newsService.update(id, updateNewsDto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a news article' })
  @ApiResponse({
    status: 200,
    description: 'The news article has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }

  @Patch(':id/toggle-featured')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle featured status of a news article' })
  @ApiResponse({
    status: 200,
    description: 'The featured status has been successfully toggled.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  toggleFeatured(@Param('id') id: string) {
    return this.newsService.toggleFeatured(id);
  }

  @Patch(':id/toggle-public')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle public status of a news article' })
  @ApiResponse({
    status: 200,
    description: 'The public status has been successfully toggled.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  togglePublic(@Param('id') id: string) {
    return this.newsService.togglePublic(id);
  }
}
