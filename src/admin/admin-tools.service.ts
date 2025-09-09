import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Between } from 'typeorm';
import { Tool } from '../tools/entities/tool.entity';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';
import { User } from '../users/entities/user.entity';
import { ToolStatus } from '../tools/enums/tool-status.enum';
import { UpdateToolStatusDto } from './dto/update-tool-status.dto';

export interface AdminToolFilters {
  search?: string;
  status?: string;
  categoryId?: string;
  subcategoryId?: string;
  ownerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class AdminToolsService {
  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Subcategory)
    private subcategoryRepository: Repository<Subcategory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAllForAdmin(filters: AdminToolFilters, pagination: PaginationOptions) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.createFilteredQuery(filters);
    
    queryBuilder
      .leftJoinAndSelect('tool.category', 'category')
      .leftJoinAndSelect('tool.subcategory', 'subcategory')
      .leftJoinAndSelect('tool.owner', 'owner')
      .select([
        'tool.id',
        'tool.title',
        'tool.description',
        'tool.brand',
        'tool.model',
        'tool.condition',
        'tool.basePrice',
        'tool.depositAmount',
        'tool.imageUrl',
        'tool.toolStatus',
        'tool.availabilityStatus',
        'tool.createdAt',
        'tool.updatedAt',
        'tool.publishedAt',
        'tool.moderatedAt',
        'category.id',
        'category.name',
        'subcategory.id',
        'subcategory.name',
        'owner.id',
        'owner.firstName',
        'owner.lastName',
        'owner.email',
      ])
      .orderBy('tool.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [tools, total] = await queryBuilder.getManyAndCount();

    return {
      data: tools,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForAdmin(id: string): Promise<Tool> {
    const tool = await this.toolRepository.findOne({
      where: { id },
      relations: [
        'category',
        'subcategory',
        'owner',
        'bookings',
        'bookings.user',
      ],
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    return tool;
  }

  async getToolStats() {
    const [total, published, underReview, rejected, archived, draft] = await Promise.all([
      this.toolRepository.count(),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.PUBLISHED } }),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.UNDER_REVIEW } }),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.REJECTED } }),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.ARCHIVED } }),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.DRAFT } }),
    ]);

    return {
      total,
      published,
      underReview,
      rejected,
      archived,
      draft,
    };
  }

  async approveTool(id: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);
    
    if (tool.toolStatus === ToolStatus.PUBLISHED) {
      throw new BadRequestException('Tool is already approved');
    }

    tool.toolStatus = ToolStatus.PUBLISHED;
    tool.publishedAt = new Date();
    tool.moderatedAt = new Date();

    return this.toolRepository.save(tool);
  }

  async rejectTool(id: string, reason?: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);
    
    if (tool.toolStatus === ToolStatus.REJECTED) {
      throw new BadRequestException('Tool is already rejected');
    }

    tool.toolStatus = ToolStatus.REJECTED;
    tool.moderatedAt = new Date();
    
    // You might want to store the rejection reason in a separate field or audit log
    // For now, we'll just update the status

    return this.toolRepository.save(tool);
  }

  async updateToolStatus(id: string, updateDto: UpdateToolStatusDto): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);
    
    if (updateDto.status) {
      tool.toolStatus = updateDto.status;
      tool.moderatedAt = new Date();
      
      if (updateDto.status === ToolStatus.PUBLISHED) {
        tool.publishedAt = new Date();
      }
    }

    return this.toolRepository.save(tool);
  }

  async deleteTool(id: string): Promise<{ message: string }> {
    const tool = await this.findOneForAdmin(id);
    
    // Check if tool has active bookings
    const activeBookings = await this.toolRepository
      .createQueryBuilder('tool')
      .leftJoin('tool.bookings', 'booking')
      .where('tool.id = :id', { id })
      .andWhere('booking.status IN (:...statuses)', { 
        statuses: ['confirmed', 'in_progress'] 
      })
      .getCount();

    if (activeBookings > 0) {
      throw new BadRequestException('Cannot delete tool with active bookings');
    }

    await this.toolRepository.remove(tool);
    return { message: 'Tool deleted successfully' };
  }

  async archiveTool(id: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);
    
    if (tool.toolStatus === ToolStatus.ARCHIVED) {
      throw new BadRequestException('Tool is already archived');
    }

    tool.toolStatus = ToolStatus.ARCHIVED;
    tool.moderatedAt = new Date();

    return this.toolRepository.save(tool);
  }

  async restoreTool(id: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);
    
    if (tool.toolStatus !== ToolStatus.ARCHIVED) {
      throw new BadRequestException('Only archived tools can be restored');
    }

    tool.toolStatus = ToolStatus.PUBLISHED;
    tool.moderatedAt = new Date();
    tool.publishedAt = new Date();

    return this.toolRepository.save(tool);
  }

  private createFilteredQuery(filters: AdminToolFilters): SelectQueryBuilder<Tool> {
    const queryBuilder = this.toolRepository.createQueryBuilder('tool');

    if (filters.search) {
      queryBuilder.andWhere(
        '(tool.title ILIKE :search OR tool.description ILIKE :search OR tool.brand ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    if (filters.status) {
      queryBuilder.andWhere('tool.toolStatus = :status', { status: filters.status });
    }

    if (filters.categoryId) {
      queryBuilder.andWhere('tool.categoryId = :categoryId', { categoryId: filters.categoryId });
    }

    if (filters.subcategoryId) {
      queryBuilder.andWhere('tool.subcategoryId = :subcategoryId', { subcategoryId: filters.subcategoryId });
    }

    if (filters.ownerId) {
      queryBuilder.andWhere('tool.ownerId = :ownerId', { ownerId: filters.ownerId });
    }

    if (filters.dateFrom && filters.dateTo) {
      queryBuilder.andWhere('tool.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    } else if (filters.dateFrom) {
      queryBuilder.andWhere('tool.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    } else if (filters.dateTo) {
      queryBuilder.andWhere('tool.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    return queryBuilder;
  }
}