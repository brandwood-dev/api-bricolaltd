import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateReviewToolDto } from './dto/create-review-tool.dto';
import { UpdateReviewToolDto } from './dto/update-review-tool.dto';
import { CreateReviewAppDto } from './dto/create-review-app.dto';
import { UpdateReviewAppDto } from './dto/update-review-app.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Legacy Review endpoints (to be deprecated)
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new review (legacy)' })
  @ApiResponse({
    status: 201,
    description: 'The review has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(createReviewDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reviews (legacy)' })
  @ApiResponse({ status: 200, description: 'Return all reviews.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll() {
    return this.reviewsService.findAll();
  }

  @Get('app')
  @ApiOperation({ summary: 'Get all app reviews' })
  @ApiResponse({ status: 200, description: 'Return all app reviews.' })
  @SetMetadata('isPublic', true)
  findAllAppReviews() {
    return this.reviewsService.findAllAppReviews();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get reviews by user id (legacy)' })
  @ApiResponse({ status: 200, description: 'Return the reviews.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findByUserId(@Param('userId') userId: string) {
    return this.reviewsService.findByUserId(userId);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get review by booking id (legacy)' })
  @ApiResponse({ status: 200, description: 'Return the review.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findByBookingId(@Param('bookingId') bookingId: string) {
    return this.reviewsService.findByBookingId(bookingId);
  }

  // Tool Review endpoints (specific routes first)
  @Get('tools')
  @ApiOperation({ summary: 'Get all tool reviews' })
  @ApiResponse({ status: 200, description: 'Return all tool reviews.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAllToolReviews() {
    return this.reviewsService.findAllToolReviews();
  }

  @Get('tools/stats')
  @ApiOperation({ summary: 'Get global tool reviews statistics (public)' })
  @ApiResponse({ status: 200, description: 'Return global stats: total and average rating.' })
  @SetMetadata('isPublic', true)
  getToolReviewsStatsPublic() {
    return this.reviewsService.getToolReviewsStatsPublic();
  }

  @Get('tools/tool/:toolId')
  @ApiOperation({ summary: 'Get tool reviews by tool id' })
  @ApiResponse({ status: 200, description: 'Return the tool reviews.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findToolReviewsByToolId(@Param('toolId') toolId: string) {
    return this.reviewsService.findToolReviewsByToolId(toolId);
  }

  @Get('tools/user/:userId')
  @ApiOperation({ summary: 'Get tool reviews by user id' })
  @ApiResponse({ status: 200, description: 'Return the tool reviews.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findToolReviewsByUserId(@Param('userId') userId: string) {
    return this.reviewsService.findToolReviewsByUserId(userId);
  }

  @Get('tools/:id')
  @ApiOperation({ summary: 'Get a tool review by id' })
  @ApiResponse({ status: 200, description: 'Return the tool review.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOneToolReview(@Param('id') id: string) {
    return this.reviewsService.findOneToolReview(id);
  }

  // Legacy routes (generic :id route must be last)
  @Get(':id')
  @ApiOperation({ summary: 'Get a review by id (legacy)' })
  @ApiResponse({ status: 200, description: 'Return the review.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a review (legacy)' })
  @ApiResponse({
    status: 200,
    description: 'The review has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewsService.update(id, updateReviewDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review (legacy)' })
  @ApiResponse({
    status: 200,
    description: 'The review has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }

  @Post('tools')
  @ApiOperation({ summary: 'Create a new tool review' })
  @ApiResponse({
    status: 201,
    description: 'The tool review has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  createToolReview(@Body() createReviewToolDto: CreateReviewToolDto) {
    return this.reviewsService.createToolReview(createReviewToolDto);
  }

  @Patch('tools/:id')
  @ApiOperation({ summary: 'Update a tool review' })
  @ApiResponse({
    status: 200,
    description: 'The tool review has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateToolReview(@Param('id') id: string, @Body() updateReviewToolDto: UpdateReviewToolDto) {
    return this.reviewsService.updateToolReview(id, updateReviewToolDto);
  }

  @Delete('tools/:id')
  @ApiOperation({ summary: 'Delete a tool review' })
  @ApiResponse({
    status: 200,
    description: 'The tool review has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  removeToolReview(@Param('id') id: string) {
    return this.reviewsService.removeToolReview(id);
  }

  // App Review endpoints
  @Post('app')
  @ApiOperation({ summary: 'Create a new app review' })
  @ApiResponse({
    status: 201,
    description: 'The app review has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  createAppReview(@Body() createReviewAppDto: CreateReviewAppDto) {
    return this.reviewsService.createAppReview(createReviewAppDto);
  }

  @Get('app/:id')
  @ApiOperation({ summary: 'Get an app review by id' })
  @ApiResponse({ status: 200, description: 'Return the app review.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOneAppReview(@Param('id') id: string) {
    return this.reviewsService.findOneAppReview(id);
  }

  @Get('app/user/:userId')
  @ApiOperation({ summary: 'Get app reviews by user id' })
  @ApiResponse({ status: 200, description: 'Return the app reviews.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAppReviewsByUserId(@Param('userId') userId: string) {
    return this.reviewsService.findAppReviewsByUserId(userId);
  }

  @Get('app/check/:userId')
  @ApiOperation({ summary: 'Check if user has already reviewed the app' })
  @ApiResponse({ status: 200, description: 'Return whether user has reviewed the app.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  checkUserAppReview(@Param('userId') userId: string) {
    return this.reviewsService.checkUserAppReview(userId);
  }

  @Patch('app/:id')
  @ApiOperation({ summary: 'Update an app review' })
  @ApiResponse({
    status: 200,
    description: 'The app review has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateAppReview(@Param('id') id: string, @Body() updateReviewAppDto: UpdateReviewAppDto) {
    return this.reviewsService.updateAppReview(id, updateReviewAppDto);
  }

  @Delete('app/:id')
  @ApiOperation({ summary: 'Delete an app review' })
  @ApiResponse({
    status: 200,
    description: 'The app review has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  removeAppReview(@Param('id') id: string) {
    return this.reviewsService.removeAppReview(id);
  }
}
