import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from './entities/review.entity';
import { ReviewTool } from './entities/review-tool.entity';
import { ReviewApp } from './entities/review-app.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateReviewToolDto } from './dto/create-review-tool.dto';
import { UpdateReviewToolDto } from './dto/update-review-tool.dto';
import { CreateReviewAppDto } from './dto/create-review-app.dto';
import { UpdateReviewAppDto } from './dto/update-review-app.dto';
import { BookingsService } from '../bookings/bookings.service';
import { UsersService } from '../users/users.service';
import { BookingStatus } from '../bookings/enums/booking-status.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepository: Repository<Review>,
    @InjectRepository(ReviewTool)
    private reviewToolRepository: Repository<ReviewTool>,
    @InjectRepository(ReviewApp)
    private reviewAppRepository: Repository<ReviewApp>,
    private dataSource: DataSource,
    private bookingsService: BookingsService,
    private usersService: UsersService,
  ) {}

  // Legacy Review methods (to be deprecated)
  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    // Validate booking exists
    const booking = await this.bookingsService.findOne(
      createReviewDto.bookingId,
    );

    // Validate user exists
    await this.usersService.findOne(createReviewDto.userId);

    // Check if booking is completed
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot review a booking that is not completed',
      );
    }

    // Check if review already exists for this booking
    const existingReview = await this.reviewsRepository.findOne({
      where: { bookingId: createReviewDto.bookingId },
    });

    if (existingReview) {
      throw new BadRequestException('A review already exists for this booking');
    }

    // Create and save the review
    const review = this.reviewsRepository.create(createReviewDto);
    return this.reviewsRepository.save(review);
  }

  async findAll(): Promise<Review[]> {
    return this.reviewsRepository.find({
      relations: ['reviewer', 'reviewee', 'tool', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewsRepository.findOne({
      where: { id },
      relations: ['reviewer', 'reviewee', 'tool', 'booking'],
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  async findByUserId(reviewerId: string): Promise<Review[]> {
    return this.reviewsRepository.find({
      where: { reviewerId },
      relations: ['reviewee', 'tool', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByBookingId(bookingId: string): Promise<Review> {
    const review = await this.reviewsRepository.findOne({
      where: { bookingId },
      relations: ['reviewer', 'reviewee', 'tool'],
    });

    if (!review) {
      throw new NotFoundException(
        `Review for booking ID ${bookingId} not found`,
      );
    }

    return review;
  }

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const review = await this.findOne(id);

    // Only allow updating rating and comment
    if (updateReviewDto.userId || updateReviewDto.bookingId) {
      throw new BadRequestException(
        'Cannot update user or booking for an existing review',
      );
    }

    Object.assign(review, updateReviewDto);
    review.isEdited = true;
    review.editedAt = new Date();
    return this.reviewsRepository.save(review);
  }

  async remove(id: string): Promise<void> {
    const review = await this.findOne(id);
    await this.reviewsRepository.remove(review);
  }

  // Tool Review methods
  async createToolReview(
    createReviewToolDto: CreateReviewToolDto,
  ): Promise<ReviewTool> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate booking exists
      const booking = await this.bookingsService.findOne(
        createReviewToolDto.bookingId,
      );

      // Validate users exist
      await this.usersService.findOne(createReviewToolDto.reviewerId);
      await this.usersService.findOne(createReviewToolDto.revieweeId);

      // Check if booking is completed
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException(
          'Cannot review a booking that is not completed',
        );
      }

      // Check if review already exists for this booking within transaction
      const existingReview = await queryRunner.manager.findOne(ReviewTool, {
        where: { bookingId: createReviewToolDto.bookingId },
      });

      if (existingReview) {
        throw new BadRequestException(
          'A tool review already exists for this booking',
        );
      }

      // Create and save the tool review within transaction
      const review = queryRunner.manager.create(
        ReviewTool,
        createReviewToolDto,
      );
      const savedReview = await queryRunner.manager.save(ReviewTool, review);

      // Commit transaction
      await queryRunner.commitTransaction();
      return savedReview;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async findAllToolReviews(): Promise<ReviewTool[]> {
    return this.reviewToolRepository.find({
      relations: ['reviewer', 'reviewee', 'tool', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneToolReview(id: string): Promise<ReviewTool> {
    const review = await this.reviewToolRepository.findOne({
      where: { id },
      relations: ['reviewer', 'reviewee', 'tool', 'booking'],
    });

    if (!review) {
      throw new NotFoundException(`Tool review with ID ${id} not found`);
    }

    return review;
  }

  async findToolReviewsByToolId(toolId: string): Promise<ReviewTool[]> {
    return this.reviewToolRepository.find({
      where: { toolId },
      relations: ['reviewer', 'reviewee', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async findToolReviewsByUserId(reviewerId: string): Promise<ReviewTool[]> {
    return this.reviewToolRepository.find({
      where: { reviewerId },
      relations: ['reviewee', 'tool', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateToolReview(
    id: string,
    updateReviewToolDto: UpdateReviewToolDto,
  ): Promise<ReviewTool> {
    const review = await this.findOneToolReview(id);

    // Only allow updating rating and comment
    if (
      updateReviewToolDto.reviewerId ||
      updateReviewToolDto.revieweeId ||
      updateReviewToolDto.toolId ||
      updateReviewToolDto.bookingId
    ) {
      throw new BadRequestException(
        'Cannot update user, tool, or booking for an existing review',
      );
    }

    Object.assign(review, updateReviewToolDto);
    review.isEdited = true;
    review.editedAt = new Date();
    return this.reviewToolRepository.save(review);
  }

  async removeToolReview(id: string): Promise<void> {
    const review = await this.findOneToolReview(id);
    await this.reviewToolRepository.remove(review);
  }

  // App Review methods
  async createAppReview(
    createReviewAppDto: CreateReviewAppDto,
  ): Promise<ReviewApp> {
    // Validate user exists
    await this.usersService.findOne(createReviewAppDto.reviewerId);

    // Check if user already has an app review
    const existingReview = await this.reviewAppRepository.findOne({
      where: { reviewerId: createReviewAppDto.reviewerId },
    });

    if (existingReview) {
      throw new BadRequestException('User has already reviewed the app');
    }

    // Create and save the app review
    const review = this.reviewAppRepository.create(createReviewAppDto);
    return this.reviewAppRepository.save(review);
  }

  async findAllAppReviews(): Promise<ReviewApp[]> {
    return this.reviewAppRepository.find({
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneAppReview(id: string): Promise<ReviewApp> {
    const review = await this.reviewAppRepository.findOne({
      where: { id },
      relations: ['reviewer'],
    });

    if (!review) {
      throw new NotFoundException(`App review with ID ${id} not found`);
    }

    return review;
  }

  async findAppReviewsByUserId(reviewerId: string): Promise<ReviewApp[]> {
    return this.reviewAppRepository.find({
      where: { reviewerId },
      order: { createdAt: 'DESC' },
    });
  }

  async checkUserAppReview(
    reviewerId: string,
  ): Promise<{ hasReviewed: boolean; review?: ReviewApp }> {
    const review = await this.reviewAppRepository.findOne({
      where: { reviewerId },
      relations: ['reviewer'],
    });

    return {
      hasReviewed: !!review,
      review: review || undefined,
    };
  }

  async updateAppReview(
    id: string,
    updateReviewAppDto: UpdateReviewAppDto,
  ): Promise<ReviewApp> {
    const review = await this.findOneAppReview(id);

    // Only allow updating rating and comment
    if (updateReviewAppDto.reviewerId) {
      throw new BadRequestException(
        'Cannot update reviewer for an existing review',
      );
    }

    Object.assign(review, updateReviewAppDto);
    review.isEdited = true;
    review.editedAt = new Date();
    return this.reviewAppRepository.save(review);
  }

  async removeAppReview(id: string): Promise<void> {
    const review = await this.findOneAppReview(id);
    await this.reviewAppRepository.remove(review);
  }

  // Public stats for tool reviews: total count and global average rating
  async getToolReviewsStatsPublic(): Promise<{
    total: number;
    averageRating: number;
  }> {
    const result = await this.reviewToolRepository
      .createQueryBuilder('review')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(review.rating)', 'averageRating')
      .getRawOne();

    return {
      total: parseInt(result?.total ?? '0') || 0,
      averageRating: parseFloat(result?.averageRating ?? '0') || 0,
    };
  }
}
