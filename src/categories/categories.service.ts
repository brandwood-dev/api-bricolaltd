import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Subcategory)
    private subcategoriesRepository: Repository<Subcategory>,
  ) {}

  // Category methods
  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const existingCategory = await this.categoriesRepository.findOne({
      where: { name: createCategoryDto.name },
    });

    if (existingCategory) {
      throw new BadRequestException(
        `Category with name ${createCategoryDto.name} already exists`,
      );
    }

    const category = this.categoriesRepository.create(createCategoryDto);
    return this.categoriesRepository.save(category);
  }

  // Find all categories
  async findAllCategories(): Promise<Category[]> {
    return this.categoriesRepository.find({
      relations: ['subcategories'],
    });
  }

  // Find category by ID
  async findCategoryById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['subcategories'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  // New: Find category by name (for validation by name)
  async findCategoryByName(name: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { name },
      relations: ['subcategories'],
    });

    if (!category) {
      throw new NotFoundException(`Category with name ${name} not found`);
    }

    return category;
  }

  // Remove category
  async removeCategory(id: string): Promise<void> {
    const category = await this.findCategoryById(id);
    await this.categoriesRepository.remove(category);
  }

  // Subcategory methods
  async createSubcategory(
    createSubcategoryDto: CreateSubcategoryDto,
  ): Promise<Subcategory> {
    // Check if category exists
    const category = await this.categoriesRepository.findOne({
      where: { id: createSubcategoryDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${createSubcategoryDto.categoryId} not found`,
      );
    }

    // Check if subcategory with same name already exists in this category
    const existingSubcategory = await this.subcategoriesRepository.findOne({
      where: {
        name: createSubcategoryDto.name,
        categoryId: createSubcategoryDto.categoryId,
      },
    });

    if (existingSubcategory) {
      throw new BadRequestException(
        `Subcategory with name ${createSubcategoryDto.name} already exists in this category`,
      );
    }

    const subcategory =
      this.subcategoriesRepository.create(createSubcategoryDto);
    return this.subcategoriesRepository.save(subcategory);
  }

  async findAllSubcategories(): Promise<Subcategory[]> {
    return this.subcategoriesRepository.find({
      relations: ['category'],
    });
  }

  async findSubcategoriesByCategory(
    categoryId: string,
  ): Promise<Subcategory[]> {
    // Check if category exists
    await this.findCategoryById(categoryId);

    return this.subcategoriesRepository.find({
      where: { categoryId },
      relations: ['category'],
    });
  }

  async findSubcategoryById(id: string): Promise<Subcategory> {
    const subcategory = await this.subcategoriesRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!subcategory) {
      throw new NotFoundException(`Subcategory with ID ${id} not found`);
    }

    return subcategory;
  }

  async removeSubcategory(id: string): Promise<void> {
    const subcategory = await this.findSubcategoryById(id);
    await this.subcategoriesRepository.remove(subcategory);
  }
}
