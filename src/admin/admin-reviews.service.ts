import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { ReviewApp } from '../reviews/entities/review-app.entity';

export interface ReviewFilters {
  page?: number;
  limit?: number;
  search?: string;
  rating?: number;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminReviewsService {
  constructor(
    @InjectRepository(ReviewTool)
    private reviewToolRepository: Repository<ReviewTool>,
    @InjectRepository(ReviewApp)
    private reviewAppRepository: Repository<ReviewApp>,
  ) {}

  // Get all tool reviews with filters and pagination
  async getToolReviews(filters: ReviewFilters = {}): Promise<PaginatedResponse<ReviewTool>> {
    const {
      page = 1,
      limit = 10,
      search,
      rating,
      startDate,
      endDate,
    } = filters;

    const queryBuilder = this.reviewToolRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('review.reviewee', 'reviewee')
      .leftJoinAndSelect('review.tool', 'tool')
      .leftJoinAndSelect('review.booking', 'booking');

    // Apply search filter
    if (search) {
      queryBuilder.andWhere(
        '(reviewer.firstName LIKE :search OR reviewer.lastName LIKE :search OR reviewer.email LIKE :search OR tool.title LIKE :search OR review.comment LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply rating filter
    if (rating) {
      queryBuilder.andWhere('review.rating = :rating', { rating });
    }

    // Apply date range filter
    if (startDate) {
      queryBuilder.andWhere('review.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('review.createdAt <= :endDate', { endDate });
    }

    // Order by creation date (newest first)
    queryBuilder.orderBy('review.createdAt', 'DESC');

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // Get all app reviews with filters and pagination
  async getAppReviews(filters: ReviewFilters = {}): Promise<PaginatedResponse<ReviewApp>> {
    const {
      page = 1,
      limit = 10,
      search,
      rating,
      startDate,
      endDate,
    } = filters;

    const queryBuilder = this.reviewAppRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer');

    // Apply search filter
    if (search) {
      queryBuilder.andWhere(
        '(reviewer.firstName LIKE :search OR reviewer.lastName LIKE :search OR reviewer.email LIKE :search OR review.comment LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply rating filter
    if (rating) {
      queryBuilder.andWhere('review.rating = :rating', { rating });
    }

    // Apply date range filter
    if (startDate) {
      queryBuilder.andWhere('review.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('review.createdAt <= :endDate', { endDate });
    }

    // Order by creation date (newest first)
    queryBuilder.orderBy('review.createdAt', 'DESC');

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // Get single tool review
  async getToolReview(id: string): Promise<ReviewTool> {
    const review = await this.reviewToolRepository.findOne({
      where: { id },
      relations: ['reviewer', 'reviewee', 'tool', 'booking'],
    });

    if (!review) {
      throw new Error('Tool review not found');
    }

    return review;
  }

  // Get single app review
  async getAppReview(id: string): Promise<ReviewApp> {
    const review = await this.reviewAppRepository.findOne({
      where: { id },
      relations: ['reviewer'],
    });

    if (!review) {
      throw new Error('App review not found');
    }

    return review;
  }

  // Delete tool review
  async deleteToolReview(id: string): Promise<void> {
    const result = await this.reviewToolRepository.delete(id);
    if (result.affected === 0) {
      throw new Error('Tool review not found');
    }
  }

  // Delete app review
  async deleteAppReview(id: string): Promise<void> {
    const result = await this.reviewAppRepository.delete(id);
    if (result.affected === 0) {
      throw new Error('App review not found');
    }
  }

  // Get tool reviews statistics
  async getToolReviewsStats(): Promise<{ total: number; averageRating: number }> {
    const result = await this.reviewToolRepository
      .createQueryBuilder('review')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(review.rating)', 'averageRating')
      .getRawOne();

    return {
      total: parseInt(result.total) || 0,
      averageRating: parseFloat(result.averageRating) || 0,
    };
  }

  // Get app reviews statistics
  async getAppReviewsStats(): Promise<{ total: number; averageRating: number }> {
    const result = await this.reviewAppRepository
      .createQueryBuilder('review')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(review.rating)', 'averageRating')
      .getRawOne();

    return {
      total: parseInt(result.total) || 0,
      averageRating: parseFloat(result.averageRating) || 0,
    };
  }
}