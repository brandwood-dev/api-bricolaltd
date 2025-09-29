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
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { ConfirmToolReturnDto } from './dto/confirm-tool-return.dto';
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
  BookingStatus as AdminBookingStatus,
  SortField,
  SortOrder,
} from './dto/admin-booking-query.dto';
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
    const {
      renterId,
      toolId,
      ownerId,
      startDate,
      endDate,
      message,
      paymentMethod,
      totalPrice,
      pickupHour,
    } = createBookingDto;

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

    // Get ownerId from tool if not provided
    const finalOwnerId = ownerId || tool.ownerId;

    // Validate user exists
    await this.usersService.findOne(renterId);

    // Check if the tool is already booked for the requested dates
    const conflictingBookings = await this.bookingsRepository.find({
      where: [
        {
          toolId,
          status: BookingStatus.ACCEPTED,
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
    const bookingData: any = {
      ...createBookingDto,
      toolId: toolId,
      startDate: start,
      endDate: end,
      status: BookingStatus.PENDING,
      ownerId: finalOwnerId,
      totalPrice: totalPrice,
      paymentMethod: paymentMethod,
      message: message,
      pickupHour: pickupHour,
    };

    // Convert pickupHour string to Date if provided
    if (createBookingDto.pickupHour) {
      // Create a date object with today's date and the specified time
      const [hours, minutes] = createBookingDto.pickupHour.split(':');
      const pickupDate = new Date();
      pickupDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      bookingData.pickupHour = pickupDate;
    }

    const booking = this.bookingsRepository.create(bookingData);
    const savedBookings = await this.bookingsRepository.save(booking);
    const savedBooking = Array.isArray(savedBookings)
      ? savedBookings[0]
      : savedBookings;

    // Send notification
    try {
      await this.bookingNotificationService.notifyBookingCreated(savedBooking);
    } catch (error) {
      console.error('Failed to send booking notification:', error);
    }

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
      relations: ['renter', 'tool', 'tool.photos', 'owner'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllAdmin(queryDto: AdminBookingQueryDto): Promise<AdminBookingResponseDto> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      startDate,
      endDate,
      renterId,
      ownerId,
      toolId,
      sortBy = SortField.CREATED_AT,
      sortOrder = SortOrder.DESC,
      minAmount,
      maxAmount,
    } = queryDto;

    const queryBuilder = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.renter', 'renter')
      .leftJoinAndSelect('booking.tool', 'tool')
      .leftJoinAndSelect('tool.photos', 'photos')
      .leftJoinAndSelect('booking.owner', 'owner');

    // Apply search filter
    if (search) {
      queryBuilder.andWhere(
        '(booking.id LIKE :search OR renter.firstName LIKE :search OR renter.lastName LIKE :search OR tool.title LIKE :search OR owner.firstName LIKE :search OR owner.lastName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply status filter
    if (status) {
      queryBuilder.andWhere('booking.status = :status', { status });
    }

    // Apply date range filter
    if (startDate) {
      queryBuilder.andWhere('booking.startDate >= :startDate', {
        startDate: new Date(startDate),
      });
    }
    if (endDate) {
      queryBuilder.andWhere('booking.endDate <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // Apply user filters
    if (renterId) {
      queryBuilder.andWhere('booking.renterId = :renterId', { renterId });
    }
    if (ownerId) {
      queryBuilder.andWhere('booking.ownerId = :ownerId', { ownerId });
    }
    if (toolId) {
      queryBuilder.andWhere('booking.toolId = :toolId', { toolId });
    }

    // Apply amount filters
    if (minAmount !== undefined) {
      queryBuilder.andWhere('booking.totalPrice >= :minAmount', { minAmount });
    }
    if (maxAmount !== undefined) {
      queryBuilder.andWhere('booking.totalPrice <= :maxAmount', { maxAmount });
    }

    // Apply sorting
    let orderByField: string;
    switch (sortBy) {
      case SortField.START_DATE:
        orderByField = 'booking.startDate';
        break;
      case SortField.END_DATE:
        orderByField = 'booking.endDate';
        break;
      case SortField.STATUS:
        orderByField = 'booking.status';
        break;
      case SortField.TOTAL_AMOUNT:
        orderByField = 'booking.totalPrice';
        break;
      default:
        orderByField = 'booking.createdAt';
    }
    queryBuilder.orderBy(orderByField, sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Get paginated results
    const bookings = await queryBuilder.getMany();

    // Transform bookings to add primary image to tool
    const transformedBookings = bookings.map(booking => {
      // The image property is now available as a getter on the Tool entity
      return booking;
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data: transformedBookings,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: ['renter', 'tool', 'tool.photos', 'owner'],
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    // The image property is now available as a getter on the Tool entity
    return booking;
  }

  async findByUserId(userId: string): Promise<Booking[]> {
    const bookings = await this.bookingsRepository.find({
      where: { renterId: userId },
      relations: ['tool', 'tool.owner', 'tool.photos', 'owner', 'renter'],
      order: { createdAt: 'DESC' },
    });

    // The image property is now available as a getter on the Tool entity
    return bookings;
  }

  async findByToolId(toolId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { toolId },
      relations: ['renter', 'owner'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOwnerId(ownerId: string): Promise<Booking[]> {
    const bookings = await this.bookingsRepository.find({
      where: { ownerId },
      relations: ['tool', 'tool.owner', 'tool.photos', 'owner', 'renter'],
      order: { createdAt: 'DESC' },
    });

    // The image property is now available as a getter on the Tool entity
    return bookings;
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
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.ACCEPTED, BookingStatus.PENDING],
        })
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
          new Date(startDate),
          new Date(endDate),
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

    booking.status = BookingStatus.ACCEPTED;
    const savedBooking = await this.bookingsRepository.save(booking);

    // Send notification
    try {
      await this.bookingNotificationService.notifyBookingConfirmed(
        savedBooking,
      );
    } catch (error) {
      console.error('Failed to send booking confirmation notification:', error);
    }

    return savedBooking;
  }

  async cancelBooking(
    id: string,
    cancelBookingDto: CancelBookingDto,
  ): Promise<Booking> {
    const booking = await this.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancellationReason = cancelBookingDto.reason;
    booking.cancellationMessage = cancelBookingDto.cancellationMessage;
    const savedBooking = await this.bookingsRepository.save(booking);

    // Send notification
    await this.bookingNotificationService.notifyBookingCancelled(
      savedBooking,
      'renter',
      cancelBookingDto.reason,
    );

    return savedBooking;
  }

  async completeBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new BadRequestException(
        `Booking cannot be completed because it is ${booking.status}`,
      );
    }

    booking.status = BookingStatus.COMPLETED;
    const savedBooking = await this.bookingsRepository.save(booking);

    // Send notification
    try {
      await this.bookingNotificationService.notifyBookingCompleted(
        savedBooking,
      );
    } catch (error) {
      console.error('Failed to send booking completion notification:', error);
    }

    return savedBooking;
  }

  async rejectBooking(
    id: string,
    rejectBookingDto: RejectBookingDto,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking cannot be rejected because it is ${booking.status}`,
      );
    }

    booking.status = BookingStatus.REJECTED;
    booking.refusalReason = rejectBookingDto.refusalReason;
    booking.refusalMessage = rejectBookingDto.refusalMessage;

    const savedBooking = await this.bookingsRepository.save(booking);

    // Send notification
    try {
      await this.bookingNotificationService.notifyBookingRejected(
        savedBooking,
        rejectBookingDto.refusalReason,
      );
    } catch (error) {
      console.error('Failed to send booking rejection notification:', error);
    }

    return savedBooking;
  }

  async acceptBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking cannot be accepted because it is ${booking.status}`,
      );
    }

    // Generate 6-character alphanumeric validation code
    const validationCode = this.generateValidationCode();

    booking.status = BookingStatus.ACCEPTED;
    booking.validationCode = validationCode;

    const savedBooking = await this.bookingsRepository.save(booking);

    // Send notification with validation code
    try {
      await this.bookingNotificationService.notifyBookingAccepted(
        savedBooking,
      );
    } catch (error) {
      console.error('Failed to send booking acceptance notification:', error);
    }

    return savedBooking;
  }

  async validateBookingCode(id: string, validationCode: string): Promise<{ message: string; data: Booking }> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new BadRequestException(
        `Booking cannot be validated because it is ${booking.status}. Only ACCEPTED bookings can be validated.`,
      );
    }

    if (!booking.validationCode) {
      throw new BadRequestException(
        'No validation code found for this booking',
      );
    }

    if (booking.validationCode !== validationCode) {
      throw new BadRequestException(
        'Invalid validation code provided',
      );
    }

    // Start transaction to ensure data consistency
    const queryRunner = this.bookingsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update booking status to ONGOING
      booking.status = BookingStatus.ONGOING;
      
      // If booking has active claim, close it and update related dispute
      if (booking.hasActiveClaim) {
        booking.hasActiveClaim = false;
        
        // Find and close the active dispute for this booking
        const dispute = await queryRunner.manager.findOne('Dispute', {
          where: { bookingId: id, status: 'PENDING' },
        });
        
        if (dispute) {
          await queryRunner.manager.update('Dispute', { bookingId: id, status: 'PENDING' }, {
            status: 'CLOSED',
            updatedAt: new Date(),
          });
        }
      }
      
      const savedBooking = await queryRunner.manager.save(booking);
      
      // Commit transaction
      await queryRunner.commitTransaction();
      
      // Send notifications to both parties
      try {
        await this.bookingNotificationService.notifyBookingStarted(savedBooking);
      } catch (error) {
        console.error('Failed to send booking started notification:', error);
      }

      return {
        message: 'Validation code verified successfully. Booking status updated to ONGOING.',
        data: savedBooking,
      };
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  private generateValidationCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  async remove(id: string): Promise<void> {
    const booking = await this.findOne(id);
    await this.bookingsRepository.remove(booking);
  }

  async calculatePricing(
    calculatePricingDto: CalculatePricingDto,
  ): Promise<PricingResponseDto> {
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
    const fees = Math.round(subtotal * 0.06 * 100) / 100;

    // Calculate deposit (20% of subtotal, minimum 50)
    // const deposit = Math.max(Math.round(subtotal * 0.2 * 100) / 100, 50);
    const deposit = tool.depositAmount;

    const totalAmount = subtotal + fees + deposit;

    return {
      basePrice: tool.basePrice,
      totalDays,
      subtotal,
      fees,
      deposit,
      totalAmount,
    };
  }

  async checkAvailability(
    checkAvailabilityDto: CheckAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
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
          status: BookingStatus.ACCEPTED,
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
          status: BookingStatus.ONGOING,
          startDate: LessThanOrEqual(end),
          endDate: MoreThanOrEqual(start),
        },
      ],
      relations: ['user'],
    });

    const available = conflictingBookings.length === 0;
    const unavailableDates: string[] = [];

    // Generate list of unavailable dates
    conflictingBookings.forEach((booking) => {
      const bookingStart = new Date(booking.startDate);
      const bookingEnd = new Date(booking.endDate);

      for (
        let d = new Date(bookingStart);
        d <= bookingEnd;
        d.setDate(d.getDate() + 1)
      ) {
        unavailableDates.push(d.toISOString().split('T')[0]);
      }
    });

    const conflicts = conflictingBookings.map((booking) => ({
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      status: booking.status,
    }));

    return {
      available,
      unavailableDates: [...new Set(unavailableDates)], // Remove duplicates
      message: available
        ? 'Tool is available for the requested dates'
        : 'Tool has conflicting bookings',
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  async getBookingStats(
    queryDto?: BookingStatsQueryDto,
  ): Promise<BookingStatsResponseDto> {
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
      relations: ['tool'],
    });

    const totalBookings = bookings.length;
    const pendingBookings = bookings.filter(
      (b) => b.status === BookingStatus.PENDING,
    ).length;
    const acceptedBookings = bookings.filter(
      (b) => b.status === BookingStatus.ACCEPTED,
    ).length;
    const ongoingBookings = bookings.filter(
      (b) => b.status === BookingStatus.ONGOING,
    ).length;
    const completedBookings = bookings.filter(
      (b) => b.status === BookingStatus.COMPLETED,
    ).length;
    const cancelledBookings = bookings.filter(
      (b) => b.status === BookingStatus.CANCELLED,
    ).length;
    const rejectedBookings = bookings.filter(
      (b) => b.status === BookingStatus.REJECTED,
    ).length;

    const completedBookingsList = bookings.filter(
      (b) => b.status === BookingStatus.COMPLETED,
    );
    const totalRevenue = completedBookingsList.reduce(
      (sum, booking) => sum + (booking.totalPrice || 0),
      0,
    );
    const averageBookingValue =
      completedBookingsList.length > 0
        ? totalRevenue / completedBookingsList.length
        : 0;

    // Popular tools
    const toolCounts = new Map<
      string,
      { toolId: string; toolTitle: string; count: number }
    >();
    bookings.forEach((booking) => {
      if (booking.tool) {
        const key = booking.toolId;
        if (toolCounts.has(key)) {
          toolCounts.get(key)!.count++;
        } else {
          toolCounts.set(key, {
            toolId: booking.toolId,
            toolTitle: booking.tool.title || 'Unknown Tool',
            count: 1,
          });
        }
      }
    });

    const popularTools = Array.from(toolCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        toolId: item.toolId,
        toolTitle: item.toolTitle,
        bookingCount: item.count,
      }));

    // Status breakdown
    const statusBreakdown = [
      {
        status: 'PENDING',
        count: pendingBookings,
        percentage:
          totalBookings > 0 ? (pendingBookings / totalBookings) * 100 : 0,
      },
      {
        status: 'ACCEPTED',
        count: acceptedBookings,
        percentage:
          totalBookings > 0 ? (acceptedBookings / totalBookings) * 100 : 0,
      },
      {
        status: 'ONGOING',
        count: ongoingBookings,
        percentage:
          totalBookings > 0 ? (ongoingBookings / totalBookings) * 100 : 0,
      },
      {
        status: 'COMPLETED',
        count: completedBookings,
        percentage:
          totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
      },
      {
        status: 'CANCELLED',
        count: cancelledBookings,
        percentage:
          totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
      },
      {
        status: 'REJECTED',
        count: rejectedBookings,
        percentage:
          totalBookings > 0 ? (rejectedBookings / totalBookings) * 100 : 0,
      },
    ];

    return {
      totalBookings,
      pendingBookings,
      acceptedBookings,
      ongoingBookings,
      completedBookings,
      cancelledBookings,
      rejectedBookings,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      popularTools,
      statusBreakdown,
    };
  }

  private calculateDays(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  }

  // Admin-specific methods
  async getBookingAnalytics(
    period: 'week' | 'month' | 'year',
  ): Promise<{ date: string; bookings: number; revenue: number }[]> {
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
        createdAt: MoreThanOrEqual(startDate),
      },
      order: { createdAt: 'ASC' },
    });

    // Group bookings by period
    const analytics = new Map<string, { bookings: number; revenue: number }>();

    bookings.forEach((booking) => {
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
      revenue: Math.round(data.revenue * 100) / 100,
    }));
  }

  async bulkUpdateBookings(
    bookingIds: string[],
    action: 'confirm' | 'cancel' | 'complete',
    data?: { reason?: string; message?: string },
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const bookingId of bookingIds) {
      try {
        switch (action) {
          case 'confirm':
            await this.confirmBooking(bookingId);
            break;
          case 'cancel':
            await this.cancelBooking(bookingId, {
              reason: data?.reason || 'Cancelled by admin',
              cancellationMessage:
                data?.message || 'Booking cancelled through bulk operation',
            });
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

  async getBookingHistory(
    id: string,
  ): Promise<
    { action: string; timestamp: string; user: string; notes?: string }[]
  > {
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
        notes: 'Booking created',
      },
    ];

    if (booking.status !== BookingStatus.PENDING) {
      history.push({
        action: booking.status,
        timestamp: booking.updatedAt.toISOString(),
        user: 'Admin',
        notes: `Booking ${booking.status.toLowerCase()}`,
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
          await this.bookingNotificationService.notifyBookingReminder(
            booking,
            'start',
          );
        } else {
          await this.bookingNotificationService.notifyBookingReminder(
            booking,
            'end',
          );
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

  async confirmToolReturn(
    id: string,
    confirmToolReturnDto: ConfirmToolReturnDto,
    userId: string,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    // Verify that the user is the renter
    if (booking.renterId !== userId) {
      throw new BadRequestException('Only the renter can confirm tool return');
    }

    // Verify that the booking is in ONGOING status
    if (booking.status !== BookingStatus.ONGOING) {
      throw new BadRequestException('Tool return can only be confirmed for ongoing bookings');
    }

    // Verify that the tool hasn't already been returned
    if (booking.renterHasReturned) {
      throw new BadRequestException('Tool return has already been confirmed');
    }

    // Update the booking
    booking.renterHasReturned = true;
    booking.hasUsedReturnButton = true;
    booking.updatedAt = new Date();

    const updatedBooking = await this.bookingsRepository.save(booking);

    // Send notification to the owner
    try {
      await this.bookingNotificationService.notifyToolReturned(updatedBooking);
    } catch (error) {
      console.error('Failed to send tool return notification:', error);
    }

    return updatedBooking;
  }

  async confirmToolPickup(id: string, userId: string): Promise<Booking> {
    const booking = await this.findOne(id);

    // Verify that the user is the owner
    if (booking.ownerId !== userId) {
      throw new BadRequestException('Only the owner can confirm tool pickup');
    }

    // Verify that the booking is in ONGOING status and tool has been returned
    if (booking.status !== BookingStatus.ONGOING) {
      throw new BadRequestException('Tool pickup can only be confirmed for ongoing bookings');
    }

    if (!booking.renterHasReturned) {
      throw new BadRequestException('Tool must be returned by renter before pickup confirmation');
    }

    // Update the booking
    booking.pickupTool = true;
    booking.status = BookingStatus.COMPLETED;
    booking.updatedAt = new Date();

    const updatedBooking = await this.bookingsRepository.save(booking);

    // Send notification
    try {
      await this.bookingNotificationService.notifyBookingCompleted(updatedBooking);
    } catch (error) {
      console.error('Failed to send pickup confirmation notification:', error);
    }

    return updatedBooking;
  }

  async reportToolPickup(id: string, reportData: any, userId: string): Promise<Booking> {
    const booking = await this.findOne(id);

    // Verify that the user is the owner
    if (booking.ownerId !== userId) {
      throw new BadRequestException('Only the owner can report pickup issues');
    }

    // Verify that the booking is in ONGOING status and tool has been returned
    if (booking.status !== BookingStatus.ONGOING) {
      throw new BadRequestException('Pickup issues can only be reported for ongoing bookings');
    }

    if (!booking.renterHasReturned) {
      throw new BadRequestException('Tool must be returned by renter before reporting pickup issues');
    }

    // Update the booking
    booking.pickupTool = true;
    booking.updatedAt = new Date();
    // Note: status remains ONGOING as there's a dispute

    const updatedBooking = await this.bookingsRepository.save(booking);

    // TODO: Create dispute with the provided data
    // This would typically involve calling a disputes service
    // await this.disputesService.create({
    //   bookingId: id,
    //   initiatorId: userId,
    //   reason: reportData.reason,
    //   description: reportData.description,
    //   images: reportData.images
    // });

    // Send notification
    try {
      // TODO: Create specific notification for pickup dispute
      console.log('Pickup issue reported for booking:', id);
    } catch (error) {
      console.error('Failed to send pickup issue notification:', error);
    }

    return updatedBooking;
  }
}
