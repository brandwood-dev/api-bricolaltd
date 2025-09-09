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
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Dispute } from './entities/dispute.entity';
import { DisputeStatus } from './enums/dispute-status.enum';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new dispute' })
  @ApiResponse({
    status: 201,
    description: 'The dispute has been successfully created.',
    type: Dispute,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createDisputeDto: CreateDisputeDto) {
    return this.disputesService.create(createDisputeDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all disputes (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Return all disputes.',
    type: [Dispute],
  })
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    
    const filters: any = {};
    if (search) filters.search = search;
    if (status) filters.status = status;
    if (startDate && endDate) {
      filters.dateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    }
    
    return this.disputesService.findAll(pageNum, limitNum, filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a dispute by id' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the dispute.',
    type: Dispute,
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  findOne(@Param('id') id: string) {
    return this.disputesService.findOne(id);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all disputes for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Return all disputes for the user.',
    type: [Dispute],
  })
  findByUserId(@Param('userId') userId: string) {
    return this.disputesService.findByUserId(userId);
  }

  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dispute for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the dispute for the booking.',
    type: Dispute,
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  findByBookingId(@Param('bookingId') bookingId: string) {
    return this.disputesService.findByBookingId(bookingId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a dispute' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiResponse({
    status: 200,
    description: 'The dispute has been successfully updated.',
    type: Dispute,
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  update(@Param('id') id: string, @Body() updateDisputeDto: UpdateDisputeDto) {
    return this.disputesService.update(id, updateDisputeDto);
  }

  @Patch(':id/status/in-progress')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a dispute as in progress (admin only)' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiResponse({
    status: 200,
    description: 'The dispute has been marked as in progress.',
    type: Dispute,
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  markAsInProgress(@Param('id') id: string) {
    return this.disputesService.updateStatus(id, DisputeStatus.PENDING);
  }

  @Patch(':id/status/resolved')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a dispute as resolved (admin only)' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiResponse({
    status: 200,
    description: 'The dispute has been marked as resolved.',
    type: Dispute,
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  markAsResolved(@Param('id') id: string) {
    return this.disputesService.updateStatus(id, DisputeStatus.RESOLVED);
  }

  @Patch(':id/status/closed')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a dispute as closed (admin only)' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiResponse({
    status: 200,
    description: 'The dispute has been marked as closed.',
    type: Dispute,
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  markAsClosed(@Param('id') id: string) {
    return this.disputesService.updateStatus(id, DisputeStatus.CLOSED);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a dispute (admin only)' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiResponse({
    status: 200,
    description: 'The dispute has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Dispute not found.' })
  remove(@Param('id') id: string) {
    return this.disputesService.remove(id);
  }
}
