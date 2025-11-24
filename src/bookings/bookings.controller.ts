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
  Request,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import {
  ValidateCodeDto,
  ValidateCodeResponseDto,
} from './dto/validate-code.dto';
import {
  CalculatePricingDto,
  PricingResponseDto,
} from './dto/calculate-pricing.dto';
import {
  CheckAvailabilityDto,
  AvailabilityResponseDto,
} from './dto/check-availability.dto';
import {
  BookingStatsQueryDto,
  BookingStatsResponseDto,
} from './dto/booking-stats.dto';
import {
  AdminBookingQueryDto,
  AdminBookingResponseDto,
} from './dto/admin-booking-query.dto';
import { ConfirmToolReturnDto } from './dto/confirm-tool-return.dto';
import { ConfirmDepositSetupDto } from './dto/confirm-deposit-setup.dto';
import { CreateBookingWithDepositDto } from './dto/create-booking-with-deposit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  // ApiQuery,
} from '@nestjs/swagger';
import { Booking } from './entities/booking.entity';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Endpoint de test temporaire sans authentification
  @Get('test-stats')
  @ApiOperation({ summary: 'Test booking statistics (no auth)' })
  @ApiResponse({
    status: 200,
    description: 'Booking statistics retrieved successfully.',
  })
  async testBookingStats(@Query() queryDto?: BookingStatsQueryDto) {
    try {
      const stats = await this.bookingsService.getBookingStats(queryDto);
      return {
        data: stats,
        message: 'Request successful',
      };
    } catch (error) {
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({
    status: 201,
    description: 'The booking has been successfully created.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Post('with-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new booking with payment integration' })
  @ApiResponse({
    status: 201,
    description:
      'The booking and payment intent have been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  createWithPayment(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.createBookingWithPayment(createBookingDto);
  }

  @Post('with-deposit-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new booking with automatic deposit setup',
  })
  @ApiResponse({
    status: 201,
    description:
      'The booking and deposit setup intent have been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  createWithDepositSetup(
    @Body() createBookingDto: CreateBookingWithDepositDto,
  ) {
    return this.bookingsService.createBookingWithDepositSetup(createBookingDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Return all bookings.',
    type: [Booking],
  })
  findAll() {
    return this.bookingsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a booking by id' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the booking.',
    type: Booking,
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Return all bookings for the user.',
    type: [Booking],
  })
  findByUserId(@Param('userId') userId: string) {
    return this.bookingsService.findByUserId(userId);
  }

  @Get('user/owner/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all bookings where the authenticated user is the owner',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Return all bookings where the user is the tool owner.',
    type: [Booking],
  })
  findByOwnerId(@Param('userId') userId: string) {
    return this.bookingsService.findByOwnerId(userId);
  }

  @Get('tool/:toolId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a tool' })
  @ApiParam({ name: 'toolId', description: 'Tool ID' })
  @ApiResponse({
    status: 200,
    description: 'Return all bookings for the tool.',
    type: [Booking],
  })
  findByToolId(@Param('toolId') toolId: string) {
    return this.bookingsService.findByToolId(toolId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully updated.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully confirmed.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  confirmBooking(@Param('id') id: string) {
    return this.bookingsService.confirmBooking(id);
  }

  @Post(':id/confirm-deposit-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm deposit setup intent for automatic capture',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description:
      'Deposit setup confirmed successfully and automatic capture scheduled.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  confirmDepositSetup(
    @Param('id') id: string,
    @Body() confirmData: ConfirmDepositSetupDto,
  ) {
    return this.bookingsService.confirmDepositSetup(id, confirmData);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully cancelled.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  cancelBooking(
    @Param('id') id: string,
    @Body() cancelBookingDto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(id, cancelBookingDto);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully completed.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  completeBooking(@Param('id') id: string) {
    return this.bookingsService.completeBooking(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully rejected.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  rejectBooking(
    @Param('id') id: string,
    @Body() rejectBookingDto: RejectBookingDto,
  ) {
    return this.bookingsService.rejectBooking(id, rejectBookingDto);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a booking and generate validation code' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description:
      'The booking has been successfully accepted with validation code.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  acceptBooking(@Param('id') id: string) {
    return this.bookingsService.acceptBooking(id);
  }

  @Patch(':id/validate-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validate booking code and update status to ONGOING',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description:
      'Validation code verified successfully and booking status updated to ONGOING.',
    type: ValidateCodeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid validation code.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  validateBookingCode(
    @Param('id') id: string,
    @Body() validateCodeDto: ValidateCodeDto,
  ) {
    return this.bookingsService.validateBookingCode(
      id,
      validateCodeDto.validationCode,
    );
  }

  @Patch(':id/confirm-return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm tool return by renter' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Tool return confirmed successfully and owner notified.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  confirmToolReturn(
    @Param('id') id: string,
    @Body() confirmToolReturnDto: ConfirmToolReturnDto,
    @Request() req,
  ) {
    return this.bookingsService.confirmToolReturn(
      id,
      confirmToolReturnDto,
      req.user.id,
    );
  }

  @Patch(':id/confirm-pickup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm tool pickup by owner' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Tool pickup confirmed successfully and booking completed.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  confirmToolPickup(@Param('id') id: string, @Request() req) {
    return this.bookingsService.confirmToolPickup(id, req.user.id);
  }

  @Post(':id/report-pickup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report issue with tool pickup by owner' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Pickup issue reported successfully and dispute created.',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  reportToolPickup(
    @Param('id') id: string,
    @Body() reportData: any,
    @Request() req,
  ) {
    return this.bookingsService.reportToolPickup(id, reportData, req.user.id);
  }

  @Post('calculate-pricing')
  @ApiOperation({ summary: 'Calculate pricing for a booking' })
  @ApiResponse({
    status: 200,
    description: 'Pricing calculated successfully.',
    type: PricingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  calculatePricing(@Body() calculatePricingDto: CalculatePricingDto) {
    return this.bookingsService.calculatePricing(calculatePricingDto);
  }

  @Post('check-availability')
  @ApiOperation({ summary: 'Check tool availability for given dates' })
  @ApiResponse({
    status: 200,
    description: 'Availability checked successfully.',
    type: AvailabilityResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  checkAvailability(@Body() checkAvailabilityDto: CheckAvailabilityDto) {
    return this.bookingsService.checkAvailability(checkAvailabilityDto);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all bookings with pagination and filters (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated bookings retrieved successfully.',
    type: AdminBookingResponseDto,
  })
  findAllAdmin(@Query() queryDto: AdminBookingQueryDto) {
    return this.bookingsService.findAllAdmin(queryDto);
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Booking statistics retrieved successfully.',
    type: BookingStatsResponseDto,
  })
  getBookingStats(@Query() queryDto?: BookingStatsQueryDto) {
    return this.bookingsService.getBookingStats(queryDto);
  }

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking analytics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Booking analytics retrieved successfully.',
  })
  getBookingAnalytics(
    @Query('period') period: 'week' | 'month' | 'year' = 'month',
  ) {
    return this.bookingsService.getBookingAnalytics(period);
  }

  @Get('admin/deposit-jobs')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all deposit capture jobs (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Deposit capture jobs retrieved successfully.',
  })
  getDepositJobs(@Query('status') status?: string) {
    return this.bookingsService.getDepositJobs(status);
  }

  @Post('admin/bulk-action')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perform bulk actions on bookings (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Bulk action performed successfully.',
  })
  bulkUpdateBookings(
    @Body()
    bulkActionDto: {
      bookingIds: string[];
      action: 'confirm' | 'cancel' | 'complete';
      reason?: string;
      adminNotes?: string;
    },
  ) {
    return this.bookingsService.bulkUpdateBookings(
      bulkActionDto.bookingIds,
      bulkActionDto.action,
      {
        reason: bulkActionDto.reason,
        message: bulkActionDto.adminNotes,
      },
    );
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking history' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking history retrieved successfully.',
  })
  getBookingHistory(@Param('id') id: string) {
    return this.bookingsService.getBookingHistory(id);
  }

  @Post(':id/notify')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send booking notification (admin only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification sent successfully.',
  })
  sendBookingNotification(
    @Param('id') id: string,
    @Body()
    notificationDto: {
      type: 'reminder' | 'update' | 'confirmation';
      message?: string;
    },
  ) {
    return this.bookingsService.sendBookingNotification(
      id,
      notificationDto.type,
      notificationDto.message,
    );
  }

  @Post(':id/cancel-deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel booking due to unpaid deposit' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled due to unpaid deposit.',
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  cancelBookingForDeposit(@Param('id') id: string, @Request() req) {
    return this.bookingsService.cancelBookingForDeposit(id, req.user.id);
  }

  @Post(':id/refund-deposit')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund deposit for a booking (admin only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Deposit refunded successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  refundDeposit(
    @Param('id') id: string,
    @Body() refundData: { amount?: number; reason?: string },
  ) {
    return this.bookingsService.refundDeposit(
      id,
      refundData.amount,
      refundData.reason,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a booking (admin only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
