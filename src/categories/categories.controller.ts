import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Category endpoints
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({
    status: 201,
    description: 'The category has been successfully created.',
    type: Category,
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    const category =
      await this.categoriesService.createCategory(createCategoryDto);
    return {
      data: category,
      message: 'Category created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({
    status: 200,
    description: 'Return all categories.',
    type: [Category],
  })
  async findAllCategories() {
    const categories = await this.categoriesService.findAllCategories();
    return {
      data: categories,
      message: 'Categories retrieved successfully',
    };
  }

  @Get('subcategories')
  @ApiOperation({ summary: 'Get all subcategories' })
  @ApiResponse({
    status: 200,
    description: 'Return all subcategories.',
    type: [Subcategory],
  })
  findAllSubcategories() {
    return this.categoriesService.findAllSubcategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the category' })
  @ApiResponse({
    status: 200,
    description: 'Return the category.',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async findCategoryById(@Param('id') id: string) {
    const category = await this.categoriesService.findCategoryById(id);
    return {
      data: category,
      message: 'Category retrieved successfully',
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'The ID of the category' })
  @ApiResponse({
    status: 200,
    description: 'The category has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  removeCategory(@Param('id') id: string) {
    return this.categoriesService.removeCategory(id);
  }

  // Subcategory endpoints
  @Post('subcategories')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subcategory' })
  @ApiResponse({
    status: 201,
    description: 'The subcategory has been successfully created.',
    type: Subcategory,
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  createSubcategory(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    return this.categoriesService.createSubcategory(createSubcategoryDto);
  }

  @Get(':categoryId/subcategories')
  @ApiOperation({ summary: 'Get all subcategories for a category' })
  @ApiParam({ name: 'categoryId', description: 'The ID of the category' })
  @ApiResponse({
    status: 200,
    description: 'Return all subcategories for the category.',
    type: [Subcategory],
  })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  findSubcategoriesByCategory(@Param('categoryId') categoryId: string) {
    return this.categoriesService.findSubcategoriesByCategory(categoryId);
  }

  @Get('subcategories/:id')
  @ApiOperation({ summary: 'Get a subcategory by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the subcategory' })
  @ApiResponse({
    status: 200,
    description: 'Return the subcategory.',
    type: Subcategory,
  })
  @ApiResponse({ status: 404, description: 'Subcategory not found.' })
  findSubcategoryById(@Param('id') id: string) {
    return this.categoriesService.findSubcategoryById(id);
  }

  @Delete('subcategories/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a subcategory' })
  @ApiParam({ name: 'id', description: 'The ID of the subcategory' })
  @ApiResponse({
    status: 200,
    description: 'The subcategory has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Subcategory not found.' })
  removeSubcategory(@Param('id') id: string) {
    return this.categoriesService.removeSubcategory(id);
  }
}
