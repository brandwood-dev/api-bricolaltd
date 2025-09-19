import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AdminReviewsService, ReviewFilters } from './admin-reviews.service';
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';

@ApiTags('admin-reviews')
@Controller('admin/reviews')
@UseGuards(EnhancedAdminGuard)
@ApiBearerAuth()
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get('tools')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Get all tool reviews with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated tool reviews with filters.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for user name, email, tool title, or comment' })
  @ApiQuery({ name: 'rating', required: false, type: Number, description: 'Filter by rating (1-5)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date filter (YYYY-MM-DD)' })
  async getToolReviews(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('rating') rating?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const filters: ReviewFilters = {
        page: page ? parseInt(page.toString()) : 1,
        limit: limit ? parseInt(limit.toString()) : 10,
        search,
        rating: rating ? parseInt(rating.toString()) : undefined,
        startDate,
        endDate,
      };

      const result = await this.adminReviewsService.getToolReviews(filters);
      return {
        data: result,
        message: 'Request successful',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to fetch tool reviews',
        error: error.message,
      });
    }
  }

  @Get('app')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Get all app reviews with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated app reviews with filters.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for user name, email, or comment' })
  @ApiQuery({ name: 'rating', required: false, type: Number, description: 'Filter by rating (1-5)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date filter (YYYY-MM-DD)' })
  async getAppReviews(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('rating') rating?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const filters: ReviewFilters = {
        page: page ? parseInt(page.toString()) : 1,
        limit: limit ? parseInt(limit.toString()) : 10,
        search,
        rating: rating ? parseInt(rating.toString()) : undefined,
        startDate,
        endDate,
      };

      const result = await this.adminReviewsService.getAppReviews(filters);
      return {
        data: result,
        message: 'Request successful',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to fetch app reviews',
        error: error.message,
      });
    }
  }

  @Get('tools/:id')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Get a specific tool review by ID' })
  @ApiResponse({ status: 200, description: 'Return the tool review.' })
  @ApiResponse({ status: 404, description: 'Tool review not found.' })
  @ApiParam({ name: 'id', description: 'Tool review ID' })
  async getToolReview(@Param('id') id: string) {
    try {
      const review = await this.adminReviewsService.getToolReview(id);
      return {
        data: review,
        message: 'Request successful',
      };
    } catch (error) {
      if (error.message === 'Tool review not found') {
        throw new NotFoundException({
          data: null,
          message: 'Tool review not found',
        });
      }
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to fetch tool review',
        error: error.message,
      });
    }
  }

  @Get('app/:id')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Get a specific app review by ID' })
  @ApiResponse({ status: 200, description: 'Return the app review.' })
  @ApiResponse({ status: 404, description: 'App review not found.' })
  @ApiParam({ name: 'id', description: 'App review ID' })
  async getAppReview(@Param('id') id: string) {
    try {
      const review = await this.adminReviewsService.getAppReview(id);
      return {
        data: review,
        message: 'Request successful',
      };
    } catch (error) {
      if (error.message === 'App review not found') {
        throw new NotFoundException({
          data: null,
          message: 'App review not found',
        });
      }
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to fetch app review',
        error: error.message,
      });
    }
  }

  @Delete('tools/:id')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Delete a tool review' })
  @ApiResponse({ status: 200, description: 'Tool review deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Tool review not found.' })
  @ApiParam({ name: 'id', description: 'Tool review ID' })
  async deleteToolReview(@Param('id') id: string) {
    try {
      await this.adminReviewsService.deleteToolReview(id);
      return {
        data: null,
        message: 'Tool review deleted successfully',
      };
    } catch (error) {
      if (error.message === 'Tool review not found') {
        throw new NotFoundException({
          data: null,
          message: 'Tool review not found',
        });
      }
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to delete tool review',
        error: error.message,
      });
    }
  }

  @Delete('app/:id')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Delete an app review' })
  @ApiResponse({ status: 200, description: 'App review deleted successfully.' })
  @ApiResponse({ status: 404, description: 'App review not found.' })
  @ApiParam({ name: 'id', description: 'App review ID' })
  async deleteAppReview(@Param('id') id: string) {
    try {
      await this.adminReviewsService.deleteAppReview(id);
      return {
        data: null,
        message: 'App review deleted successfully',
      };
    } catch (error) {
      if (error.message === 'App review not found') {
        throw new NotFoundException({
          data: null,
          message: 'App review not found',
        });
      }
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to delete app review',
        error: error.message,
      });
    }
  }

  @Get('tools/stats')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Get tool reviews statistics' })
  @ApiResponse({ status: 200, description: 'Return tool reviews statistics.' })
  async getToolReviewsStats() {
    try {
      const stats = await this.adminReviewsService.getToolReviewsStats();
      return {
        data: stats,
        message: 'Request successful',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to fetch tool reviews statistics',
        error: error.message,
      });
    }
  }

  @Get('app/stats')
  @AdminPermissions('manage_reviews')
  @ApiOperation({ summary: 'Get app reviews statistics' })
  @ApiResponse({ status: 200, description: 'Return app reviews statistics.' })
  async getAppReviewsStats() {
    try {
      const stats = await this.adminReviewsService.getAppReviewsStats();
      return {
        data: stats,
        message: 'Request successful',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        data: null,
        message: 'Failed to fetch app reviews statistics',
        error: error.message,
      });
    }
  }
}