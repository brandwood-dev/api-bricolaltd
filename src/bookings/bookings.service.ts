/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThanOrEqual,
  MoreThanOrEqual,
  //Between
} from 'typeorm';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CalculatePricingDto, PricingResponseDto } from './dto/calculate-pricing.dto';
import { CheckAvailabilityDto, AvailabilityResponseDto } from './dto/check-availability.dto';
import { BookingStatsQueryDto, BookingStatsResponseDto } from './dto/booking-stats.dto';
import { ToolsService } from '../tools/tools.service';
import { UsersService } from '../users/users.service';
import { AvailabilityStatus } from '../tools/enums/availability-status.enum';
import { BookingStatus } from './enums/booking-status.enum';
import { BookingNotificationService } from './booking-notification.service';
import { BookingNotificationsService } from './booking-notifications.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private toolsService: ToolsService,
    private usersService: UsersService,
    private bookingNotificationService: BookingNotificationService,
    private bookingNotificationsService: BookingNotificationsService,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const { renterId, toolId, startDate, endDate } = createBookingDto;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
      throw new BadRequestException('End date must be after start date');
    }

    if (start < now) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // Validate tool exists and is available
    const tool = await this.toolsService.findOne(toolId);
    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    if (tool.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
      throw new BadRequestException('Tool is not available for booking');
    }

    // Validate user exists
    await this.usersService.findOne(renterId);

    // Check if the tool is already booked for the requested dates
    const conflictingBookings = await this.bookingsRepository.find({
      where: [
        {
          toolId,
          status: BookingStatus.CONFIRMED,
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
        {
          toolId,
          status: BookingStatus.PENDING,
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
      ],
    });

    if (conflictingBookings.length > 0) {
      throw new BadRequestException(
        'Tool is already booked for the requested dates',
      );
    }

    // Create and save the booking
    const booking = this.bookingsRepository.create({
      ...createBookingDto,
      startDate: start,
      endDate: end,
      status: BookingStatus.PENDING,
      totalPrice: this.calculateTotalPrice(
        tool.basePrice,
        start,
        end,
      ),
    });

    const savedBooking = await this.bookingsRepository.save(booking);
    
    // Send notification
    await this.bookingNotificationService.notifyBookingCreated(savedBooking);
    await this.bookingNotificationsService.notifyBookingCreated(savedBooking);
    
    return savedBooking;
  }

  private calculateTotalPrice(
    pricePerDay: number,
    startDate: Date,
    endDate: Date,
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return pricePerDay * diffDays;
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingsRepository.find({
      relations: ['user', 'tool'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: ['user', 'tool'],
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  async findByUserId(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { renterId: userId },
      relations: ['tool'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByToolId(toolId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { toolId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateBookingDto: UpdateBookingDto,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    // If updating dates, check for conflicts
    if (updateBookingDto.startDate || updateBookingDto.endDate) {
      const startDate = updateBookingDto.startDate || booking.startDate;
      const endDate = updateBookingDto.endDate || booking.endDate;

      const conflictingBookings = await this.bookingsRepository
        .createQueryBuilder('booking')
        .where('booking.toolId = :toolId', { toolId: booking.toolId })
        .andWhere('booking.id != :id', { id })
        .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
        .andWhere('booking.startDate <= :endDate', { endDate })
        .andWhere('booking.endDate >= :startDate', { startDate })
        .getMany();

      if (conflictingBookings.length > 0) {
        throw new BadRequestException(
          'Tool is already booked for the requested dates',
        );
      }

      // Recalculate total price if dates changed
      if (updateBookingDto.startDate || updateBookingDto.endDate) {
        const tool = await this.toolsService.findOne(booking.toolId);
        updateBookingDto.totalPrice = this.calculateTotalPrice(
          tool.basePrice,
          startDate,
          endDate,
        );
      }
    }

    Object.assign(booking, updateBookingDto);
    return this.bookingsRepository.save(booking);
  }

  async confirmBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking cannot be confirmed because it is ${booking.status}`,
      );
    }

    booking.status = BookingStatus.CONFIRMED;
    const savedBooking = await this.bookingsRepository.save(booking);
    
    // Send notification
    await this.bookingNotificationService.notifyBookingConfirmed(savedBooking);
    await this.bookingNotificationsService.notifyBookingConfirmed(savedBooking);
    
    return savedBooking;
  }

  async cancelBooking(id: string, cancelledBy: 'renter' | 'owner' = 'renter', reason?: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    booking.status = BookingStatus.CANCELLED;
    const savedBooking = await this.bookingsRepository.save(booking);
    
    // Send notification
    await this.bookingNotificationService.notifyBookingCancelled(savedBooking, cancelledBy, reason);
    const cancelType = cancelledBy === 'renter' ? 'client' : 'provider';
    await this.bookingNotificationsService.notifyBookingCancelled(savedBooking, cancelType);
    
    return savedBooking;
  }

  async completeBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Booking cannot be completed because it is ${booking.status}`,
      );
    }

    booking.status = BookingStatus.COMPLETED;
    const savedBooking = await this.bookingsRepository.save(booking);
    
    // Send notification
    await this.bookingNotificationService.notifyBookingCompleted(savedBooking);
    await this.bookingNotificationsService.notifyBookingCompleted(savedBooking);
    
    return savedBooking;
  }

  async remove(id: string): Promise<void> {
    const booking = await this.findOne(id);
    await this.bookingsRepository.remove(booking);
  }

  async calculatePricing(calculatePricingDto: CalculatePricingDto): Promise<PricingResponseDto> {
    const tool = await this.toolsService.findOne(calculatePricingDto.toolId);
    
    const startDate = new Date(calculatePricingDto.startDate);
    const endDate = new Date(calculatePricingDto.endDate);
    
    // Validate dates
    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }
    
    if (startDate < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }
    
    const totalDays = this.calculateDays(startDate, endDate);
    const subtotal = tool.basePrice * totalDays;
    
    // Calculate fees (5% platform fee)
    const fees = Math.round(subtotal * 0.05 * 100) / 100;
    
    // Calculate deposit (20% of subtotal, minimum 50)
    const deposit = Math.max(Math.round(subtotal * 0.20 * 100) / 100, 50);
    
    const totalAmount = subtotal + fees + deposit;
    
    return {
      basePrice: tool.basePrice,
      totalDays,
      subtotal,
      fees,
      deposit,
      totalAmount
    };
  }

  async checkAvailability(checkAvailabilityDto: CheckAvailabilityDto): Promise<AvailabilityResponseDto> {
    const { toolId, startDate, endDate } = checkAvailabilityDto;
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      throw new BadRequestException('End date must be after start date');
    }
    
    if (start < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }
    
    // Check for conflicting bookings
    const conflictingBookings = await this.bookingsRepository.find({
      where: [
        {
          toolId,
          status: BookingStatus.CONFIRMED,
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
        {
          toolId,
          status: BookingStatus.PENDING,
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
        {
          toolId,
          status: BookingStatus.APPROVED,
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
      ],
      relations: ['user'],
    });
    
    const available = conflictingBookings.length === 0;
    const unavailableDates: string[] = [];
    
    // Generate list of unavailable dates
    conflictingBookings.forEach(booking => {
      const bookingStart = new Date(booking.startDate);
      const bookingEnd = new Date(booking.endDate);
      
      for (let d = new Date(bookingStart); d <= bookingEnd; d.setDate(d.getDate() + 1)) {
        unavailableDates.push(d.toISOString().split('T')[0]);
      }
    });
    
    const conflicts = conflictingBookings.map(booking => ({
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      status: booking.status
    }));
    
    return {
      available,
      unavailableDates: [...new Set(unavailableDates)], // Remove duplicates
      message: available ? 'Tool is available for the requested dates' : 'Tool has conflicting bookings',
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  async getBookingStats(queryDto?: BookingStatsQueryDto): Promise<BookingStatsResponseDto> {
    const whereCondition: any = {};
    
    if (queryDto?.startDate || queryDto?.endDate) {
      whereCondition.createdAt = {};
      if (queryDto.startDate) {
        whereCondition.createdAt.gte = new Date(queryDto.startDate);
      }
      if (queryDto.endDate) {
        whereCondition.createdAt.lte = new Date(queryDto.endDate);
      }
    }
    
    const bookings = await this.bookingsRepository.find({
      where: whereCondition,
      relations: ['tool']
    });
    
    const totalBookings = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === BookingStatus.PENDING).length;
    const confirmedBookings = bookings.filter(b => b.status === BookingStatus.CONFIRMED).length;
    const completedBookings = bookings.filter(b => b.status === BookingStatus.COMPLETED).length;
    const cancelledBookings = bookings.filter(b => b.status === BookingStatus.CANCELLED).length;
    const rejectedBookings = bookings.filter(b => b.status === BookingStatus.REJECTED).length;
    
    const completedBookingsList = bookings.filter(b => b.status === BookingStatus.COMPLETED);
    const totalRevenue = completedBookingsList.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
    const averageBookingValue = completedBookingsList.length > 0 ? totalRevenue / completedBookingsList.length : 0;
    
    // Popular tools
    const toolCounts = new Map<string, { toolId: string; toolTitle: string; count: number }>();
    bookings.forEach(booking => {
      if (booking.tool) {
        const key = booking.toolId;
        if (toolCounts.has(key)) {
          toolCounts.get(key)!.count++;
        } else {
          toolCounts.set(key, {
            toolId: booking.toolId,
            toolTitle: booking.tool.title || 'Unknown Tool',
            count: 1
          });
        }
      }
    });
    
    const popularTools = Array.from(toolCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => ({
        toolId: item.toolId,
        toolTitle: item.toolTitle,
        bookingCount: item.count
      }));
    
    // Status breakdown
    const statusBreakdown = [
      { status: 'PENDING', count: pendingBookings, percentage: totalBookings > 0 ? (pendingBookings / totalBookings) * 100 : 0 },
      { status: 'CONFIRMED', count: confirmedBookings, percentage: totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0 },
      { status: 'COMPLETED', count: completedBookings, percentage: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0 },
      { status: 'CANCELLED', count: cancelledBookings, percentage: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0 },
      { status: 'REJECTED', count: rejectedBookings, percentage: totalBookings > 0 ? (rejectedBookings / totalBookings) * 100 : 0 }
    ];
    
    return {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      rejectedBookings,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      popularTools,
      statusBreakdown
    };
  }

  private calculateDays(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  }

  // Admin-specific methods
  async getBookingAnalytics(period: 'week' | 'month' | 'year'): Promise<{ date: string; bookings: number; revenue: number }[]> {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'DATE(created_at)';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 4, 0, 1);
        groupBy = 'YEAR(created_at)';
        break;
    }

    const bookings = await this.bookingsRepository.find({
      where: {
        createdAt: MoreThanOrEqual(startDate)
      },
      order: { createdAt: 'ASC' }
    });

    // Group bookings by period
    const analytics = new Map<string, { bookings: number; revenue: number }>();
    
    bookings.forEach(booking => {
      let key: string;
      const date = new Date(booking.createdAt);
      
      switch (period) {
        case 'week':
          key = date.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
      }
      
      if (!analytics.has(key)) {
        analytics.set(key, { bookings: 0, revenue: 0 });
      }
      
      const data = analytics.get(key)!;
      data.bookings++;
      if (booking.status === BookingStatus.COMPLETED) {
        data.revenue += booking.totalPrice || 0;
      }
    });

    return Array.from(analytics.entries()).map(([date, data]) => ({
      date,
      bookings: data.bookings,
      revenue: Math.round(data.revenue * 100) / 100
    }));
  }

  async bulkUpdateBookings(
    bookingIds: string[], 
    action: 'confirm' | 'cancel' | 'complete', 
    data?: { reason?: string; adminNotes?: string }
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const bookingId of bookingIds) {
      try {
        switch (action) {
          case 'confirm':
            await this.confirmBooking(bookingId);
            break;
          case 'cancel':
            await this.cancelBooking(bookingId);
            break;
          case 'complete':
            await this.completeBooking(bookingId);
            break;
        }
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Booking ${bookingId}: ${error.message}`);
      }
    }

    return results;
  }

  async getBookingHistory(id: string): Promise<{ action: string; timestamp: string; user: string; notes?: string }[]> {
    const booking = await this.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // For now, return a basic history based on booking status
    // In a real implementation, you'd have a separate BookingHistory entity
    const history = [
      {
        action: 'CREATED',
        timestamp: booking.createdAt.toISOString(),
        user: 'System',
        notes: 'Booking created'
      }
    ];

    if (booking.status !== BookingStatus.PENDING) {
      history.push({
        action: booking.status,
        timestamp: booking.updatedAt.toISOString(),
        user: 'Admin',
        notes: `Booking ${booking.status.toLowerCase()}`
      });
    }

    return history;
  }

  async sendBookingNotification(
    id: string,
    type: 'reminder' | 'update' | 'confirmation',
    message?: string,
  ): Promise<{ message: string }> {
    const booking = await this.findOne(id);

    switch (type) {
      case 'reminder':
        // Determine if it's a start or end reminder based on current date
        const now = new Date();
        const startDate = new Date(booking.startDate);
        const endDate = new Date(booking.endDate);
        
        if (now < startDate) {
          await this.bookingNotificationService.notifyBookingReminder(booking, 'start');
        } else {
          await this.bookingNotificationService.notifyBookingReminder(booking, 'end');
        }
        break;
        
      case 'confirmation':
        await this.bookingNotificationService.notifyBookingConfirmed(booking);
        break;
        
      case 'update':
        // Send a custom notification with the provided message
        await this.bookingNotificationService.notifyBookingCreated(booking);
        break;
        
      default:
        throw new BadRequestException('Invalid notification type');
    }

    return { message: 'Notification sent successfully' };
  }
}
