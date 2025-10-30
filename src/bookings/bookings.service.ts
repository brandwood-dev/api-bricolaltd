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
import { BookingSchedulerService } from './booking-scheduler.service';
import { PaymentService } from '../payments/payment.service';
import { StripeDepositService } from './services/stripe-deposit.service';
import { DepositSchedulerService } from './services/deposit-scheduler.service';
import { CreateBookingWithDepositDto } from './dto/create-booking-with-deposit.dto';
import { ConfirmDepositSetupDto } from './dto/confirm-deposit-setup.dto';
import { DepositCaptureStatus } from './enums/deposit-capture-status.enum';
import { DepositJobStatus } from './enums/deposit-job-status.enum';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private toolsService: ToolsService,
    private usersService: UsersService,
    private bookingNotificationService: BookingNotificationService,
    private bookingNotificationsService: BookingNotificationsService,
    private bookingSchedulerService: BookingSchedulerService,
    private paymentService: PaymentService,
    private stripeDepositService: StripeDepositService,
    private depositSchedulerService: DepositSchedulerService,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    console.log('🔍 [BookingService] create called with:', createBookingDto);
    
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

    console.log('🔍 [BookingService] Extracted data:', {
      renterId,
      toolId,
      ownerId,
      startDate,
      endDate,
      message,
      paymentMethod,
      totalPrice,
      pickupHour,
    });

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Create start date with pickup hour for proper comparison (with timezone handling)
    const startWithPickupTime = new Date(start);
    if (pickupHour) {
      const [hours, minutes] = pickupHour.split(':').map(Number);
      // Use local timezone for pickup time calculation
      const localStartDate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hours, minutes || 0, 0, 0);
      startWithPickupTime.setTime(localStartDate.getTime());
    } else {
      // Default to start of day if no pickup hour specified
      startWithPickupTime.setHours(0, 0, 0, 0);
    }

    // Set end date to start of day for comparison
    const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    console.log('🔍 [BookingService] Date validation:', {
      startDateInput: startDate,
      endDateInput: endDate,
      pickupHour: pickupHour,
      startDateType: typeof startDate,
      endDateType: typeof endDate,
      start: start.toISOString(),
      end: end.toISOString(),
      now: now.toISOString(),
      startWithPickupTime: startWithPickupTime.toISOString(),
      endOfDay: endOfDay.toISOString(),
      startTime: start.getTime(),
      endTime: end.getTime(),
      comparison: start > end,
      timeDifference: end.getTime() - start.getTime(),
      daysDifference: (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    });

    // La date de fin ne peut JAMAIS être la même que la date de début
    if (start >= end) {
      console.log('❌ [BookingService] Date validation failed: End date must be after start date');
      console.log('❌ [BookingService] Detailed comparison:', {
        startDate: startDate,
        endDate: endDate,
        startParsed: start.toISOString(),
        endParsed: end.toISOString(),
        startWithPickupTime: startWithPickupTime.toISOString(),
        endOfDay: endOfDay.toISOString(),
        isStartGreaterOrEqual: start >= end
      });
      throw new BadRequestException('End date must be after start date');
    }

    // Minimum 48 hours advance booking requirement
    // This allows time for: owner confirmation, deposit jobs (24h before), and notifications
    const minimumAdvanceHours = 48;
    const minimumStartTime = new Date(now.getTime() + (minimumAdvanceHours * 60 * 60 * 1000));
    
    console.log('🔍 [BookingService] 48-hour advance booking validation:', {
      now: now.toISOString(),
      startWithPickupTime: startWithPickupTime.toISOString(),
      minimumStartTime: minimumStartTime.toISOString(),
      minimumAdvanceHours: minimumAdvanceHours,
      hoursUntilPickup: (startWithPickupTime.getTime() - now.getTime()) / (1000 * 60 * 60),
      pickupHour: pickupHour
    });

    if (startWithPickupTime < minimumStartTime) {
      const hoursUntilPickup = (startWithPickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      console.log('❌ [BookingService] Date validation failed: Booking must be made at least 48 hours in advance');
      console.log('❌ [BookingService] 48-hour validation details:', {
        startWithPickupTime: startWithPickupTime.toISOString(),
        now: now.toISOString(),
        minimumStartTime: minimumStartTime.toISOString(),
        hoursUntilPickup: hoursUntilPickup,
        minimumRequired: minimumAdvanceHours
      });
      throw new BadRequestException(
        `Les réservations doivent être faites au moins ${minimumAdvanceHours} heures à l'avance. ` +
        `Cette réservation n'est que ${Math.round(hoursUntilPickup)} heures à l'avance. ` +
        `Veuillez sélectionner une date et une heure au moins 48 heures à partir de maintenant.`
      );
    }

    // Validate tool exists and is available
    console.log('🔍 [BookingService] Fetching tool:', toolId);
    const tool = await this.toolsService.findOne(toolId);
    if (!tool) {
      console.log('❌ [BookingService] Tool not found:', toolId);
      throw new NotFoundException('Tool not found');
    }

    console.log('🔍 [BookingService] Tool found:', {
      id: tool.id,
      title: tool.title,
      availabilityStatus: tool.availabilityStatus,
      ownerId: tool.ownerId,
    });

    if (tool.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
      console.log('❌ [BookingService] Tool not available:', tool.availabilityStatus);
      throw new BadRequestException('Tool is not available for booking');
    }

    // Get ownerId from tool if not provided
    const finalOwnerId = ownerId || tool.ownerId;
    console.log('🔍 [BookingService] Final owner ID:', finalOwnerId);

    // Validate user exists
    console.log('🔍 [BookingService] Validating user:', renterId);
    await this.usersService.findOne(renterId);

    // Check if the tool is already booked for the requested dates
    console.log('🔍 [BookingService] Checking for conflicting bookings...');
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

    console.log('🔍 [BookingService] Conflicting bookings found:', conflictingBookings.length);

    if (conflictingBookings.length > 0) {
      console.log('❌ [BookingService] Tool already booked for requested dates');
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
      paymentStatus: 'pending', // Initialize payment status
    };

    console.log('🔍 [BookingService] Booking data to save:', bookingData);

    // Convert pickupHour string to Date if provided
    if (createBookingDto.pickupHour) {
      // Create a date object with today's date and the specified time
      const [hours, minutes] = createBookingDto.pickupHour.split(':');
      const pickupDate = new Date();
      pickupDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      bookingData.pickupHour = pickupDate;
      console.log('🔍 [BookingService] Converted pickup hour:', pickupDate.toISOString());
    }

    try {
      const booking = this.bookingsRepository.create(bookingData);
      console.log('🔍 [BookingService] Booking entity created:', booking);
      
      const savedBookings = await this.bookingsRepository.save(booking);
      const savedBooking = Array.isArray(savedBookings) ? savedBookings[0] : savedBookings;
      console.log('🔍 [BookingService] Booking saved successfully:', savedBooking);

      // Send notification
      try {
        console.log('🔍 [BookingService] Sending booking notification...');
        await this.bookingNotificationService.notifyBookingCreated(savedBooking);
        console.log('🔍 [BookingService] Booking notification sent successfully');
      } catch (error) {
        console.error('❌ [BookingService] Failed to send booking notification:', error);
      }

      // Schedule deposit reminder for testing (1 minute delay)
      try {
        console.log('🔍 [BookingService] Scheduling deposit reminder...');
        await this.bookingSchedulerService.scheduleDepositReminder(savedBooking.id);
        console.log('🔍 [BookingService] Deposit reminder scheduled successfully');
      } catch (error) {
        console.error('❌ [BookingService] Failed to schedule deposit reminder:', error);
      }

      return savedBooking;
    } catch (error) {
      console.error('❌ [BookingService] Error saving booking:', error);
      throw error;
    }
  }

  private calculateTotalPrice(
    pricePerDay: number,
    startDate: Date,
    endDate: Date,
  ): number {
    const diffDays = this.calculateDays(startDate, endDate);
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

  /**
   * Create a booking with payment integration
   */
  async createBookingWithPayment(createBookingDto: CreateBookingDto): Promise<{
    booking: Booking;
    paymentIntent: any;
  }> {
    // First create the booking
    const booking = await this.create(createBookingDto);

    try {
      // Create Payment Intent for the booking
      const paymentIntent = await this.paymentService.createPaymentIntent({
        amount: Math.round(booking.totalPrice * 100), // Convert to cents
        currency: 'gbp',
        bookingId: booking.id,
        metadata: {
          booking_id: booking.id,
          renter_id: booking.renterId,
          tool_id: booking.toolId,
          owner_id: booking.ownerId,
        },
      });

      // Update booking with payment intent ID
      booking.paymentIntentId = paymentIntent.id;
      booking.paymentStatus = 'pending';
      await this.bookingsRepository.save(booking);

      return {
        booking,
        paymentIntent,
      };
    } catch (error) {
      // If payment creation fails, remove the booking
      await this.bookingsRepository.remove(booking);
      throw new BadRequestException(`Failed to create payment: ${error.message}`);
    }
  }

  /**
   * Create a booking with automatic deposit setup
   */
  async createBookingWithDepositSetup(createBookingDto: CreateBookingWithDepositDto): Promise<{
    booking: Booking;
    setupIntent: any;
    paymentIntent: any;
  }> {
    // Convert paymentMethod to match CreateBookingDto type
    const convertedDto: CreateBookingDto = {
      ...createBookingDto,
      paymentMethod: createBookingDto.paymentMethod === 'card' ? 'CARD' : 'PAYPAL'
    };

    // First create the booking
    const booking = await this.create(convertedDto);

    try {
      // Get or create Stripe customer
      const user = await this.usersService.findOne(booking.renterId);
      const customerId = await this.stripeDepositService.createOrGetCustomer(
        user.email,
        user.firstName + ' ' + user.lastName
      );

      // Calculate rental amount (without deposit) for immediate capture
      const tool = await this.toolsService.findOne(booking.toolId);
      const totalDays = this.calculateDays(booking.startDate, booking.endDate);
      const subtotal = tool.basePrice * totalDays;
      const fees = Math.round(subtotal * 0.06 * 100) / 100;
      const rentalAmount = subtotal + fees; // Amount to capture immediately (without deposit)

      console.log('🔍 [BookingService] Creating payment for rental amount:', {
        subtotal,
        fees,
        rentalAmount,
        depositAmount: tool.depositAmount
      });

      // Create PaymentIntent for immediate capture of rental amount (without deposit)
      const paymentIntent = await this.paymentService.createPaymentIntent({
        amount: Math.round(rentalAmount * 100), // Convert to cents
        currency: 'gbp',
        bookingId: booking.id,
        metadata: {
          booking_id: booking.id,
          renter_id: booking.renterId,
          tool_id: booking.toolId,
          owner_id: booking.ownerId,
          type: 'rental_payment', // Distinguish from deposit
        },
      });

      // Create SetupIntent for deposit (managed separately)
      const setupData = await this.stripeDepositService.createSetupIntent(customerId, booking.id);

      // Update booking with both payment and deposit setup data
      booking.paymentIntentId = paymentIntent.id;
      booking.paymentStatus = 'pending';
      booking.setupIntentId = setupData.setupIntentId;
      booking.depositCaptureScheduledAt = new Date(booking.startDate.getTime() - 24 * 60 * 60 * 1000); // 24h before
      booking.depositCaptureStatus = DepositCaptureStatus.PENDING;
      
      await this.bookingsRepository.save(booking);

      return {
        booking,
        setupIntent: setupData,
        paymentIntent: paymentIntent,
      };
    } catch (error) {
      // If setup creation fails, remove the booking
      await this.bookingsRepository.remove(booking);
      throw new BadRequestException(`Failed to create payment and deposit setup: ${error.message}`);
    }
  }

  /**
   * Confirm deposit setup after user completes the SetupIntent
   */
  async confirmDepositSetup(bookingId: string, confirmData: ConfirmDepositSetupDto): Promise<Booking> {
    const booking = await this.findOne(bookingId);

    if (!booking.setupIntentId) {
      throw new BadRequestException('No setup intent found for this booking');
    }

    try {
      // Confirm the SetupIntent with Stripe
      const confirmResult = await this.stripeDepositService.confirmSetupIntent(
        booking.setupIntentId
      );

      if (!confirmResult.success) {
        throw new BadRequestException(`Failed to confirm deposit setup: ${confirmResult.error}`);
      }

      // Update booking with confirmed deposit data
      booking.depositPaymentMethodId = confirmResult.paymentMethodId;
      booking.depositCaptureStatus = DepositCaptureStatus.SUCCESS;
      
      const savedBooking = await this.bookingsRepository.save(booking);

      // Schedule deposit capture and notification jobs
      await this.depositSchedulerService.scheduleDepositCapture(savedBooking);

      return savedBooking;
    } catch (error) {
      booking.depositCaptureStatus = DepositCaptureStatus.FAILED;
      booking.depositFailureReason = error.message;
      await this.bookingsRepository.save(booking);
      throw new BadRequestException(`Failed to confirm deposit setup: ${error.message}`);
    }
  }

  /**
   * Refund deposit for a booking (admin only)
   */
  async refundDeposit(bookingId: string, amount?: number, reason?: string): Promise<{
    success: boolean;
    refundId?: string;
    message: string;
  }> {
    const booking = await this.findOne(bookingId);

    if (!booking.depositPaymentMethodId) {
      throw new BadRequestException('No deposit payment method found for this booking');
    }

    if (booking.depositCaptureStatus !== DepositCaptureStatus.SUCCESS) {
      throw new BadRequestException('Deposit has not been captured yet');
    }

    try {
      // Get tool for deposit amount if not specified
      const tool = await this.toolsService.findOne(booking.toolId);
      const refundAmount = amount || tool.depositAmount;

      // Process refund through Stripe
      const refundResult = await this.stripeDepositService.refundDeposit(
        booking.depositPaymentMethodId,
        Math.round(refundAmount * 100), // Convert to cents
        reason || 'Deposit refund'
      );

      if (refundResult.success) {
        // Update booking status
        booking.depositCaptureStatus = DepositCaptureStatus.CANCELLED;
        await this.bookingsRepository.save(booking);

        return {
          success: true,
          refundId: refundResult.refundId,
          message: 'Deposit refunded successfully'
        };
      } else {
        throw new BadRequestException('Failed to process refund');
      }
    } catch (error) {
      throw new BadRequestException(`Failed to refund deposit: ${error.message}`);
    }
  }

  async acceptBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking cannot be accepted because it is ${booking.status}`,
      );
    }

    // Check if payment is authorized before accepting
    if (booking.paymentStatus !== 'authorized') {
      throw new BadRequestException(
        'Payment must be authorized before accepting the booking',
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
      
      // Capture payment when booking starts
      if (savedBooking.paymentIntentId && savedBooking.paymentStatus === 'authorized') {
        try {
          await this.paymentService.capturePaymentIntent(savedBooking.paymentIntentId);
          savedBooking.paymentStatus = 'captured';
          savedBooking.paymentCapturedAt = new Date();
          await queryRunner.manager.save(savedBooking);
        } catch (error) {
          console.error('Failed to capture payment:', error);
          // Don't fail the validation, but log the error
        }
      }

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
    console.log('🔍 [BookingService] calculatePricing called with:', calculatePricingDto);
    
    try {
      const tool = await this.toolsService.findOne(calculatePricingDto.toolId);
      console.log('🔍 [BookingService] Tool found:', { id: tool.id, title: tool.title, basePrice: tool.basePrice });
    
      // Parse dates from YYYY-MM-DD format
    const startDate = new Date(calculatePricingDto.startDate + 'T00:00:00.000Z');
    const endDate = new Date(calculatePricingDto.endDate + 'T00:00:00.000Z');
      
      console.log('🔍 [BookingService] Parsed dates:', {
        startDateInput: calculatePricingDto.startDate,
        endDateInput: calculatePricingDto.endDate,
        startDateParsed: startDate.toISOString(),
        endDateParsed: endDate.toISOString()
      });
    
      // Validate dates - la date de fin ne peut JAMAIS être la même que la date de début
      if (startDate >= endDate) {
        console.log('❌ [BookingService] Date validation failed: End date must be after start date');
        throw new BadRequestException('End date must be after start date');
      }
    
      // Temporarily disable past date validation for testing
      console.log('🔍 [BookingService] Date validation (temporarily disabled):', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      // if (startDate < new Date()) {
      //   throw new BadRequestException('Start date cannot be in the past');
      // }
    
      const totalDays = this.calculateDays(startDate, endDate);
      console.log('🔍 [BookingService] Total days calculated:', totalDays);
      
      const subtotal = tool.basePrice * totalDays;
      console.log('🔍 [BookingService] Subtotal calculated:', subtotal);
    
      // Calculate fees (6% platform fee)
      const fees = Math.round(subtotal * 0.06 * 100) / 100;
      console.log('🔍 [BookingService] Fees calculated:', fees);
    
      // Calculate deposit (20% of subtotal, minimum 50)
      // const deposit = Math.max(Math.round(subtotal * 0.2 * 100) / 100, 50);
      const deposit = tool.depositAmount;
      console.log('🔍 [BookingService] Deposit (managed separately):', deposit);
    
      // Total amount to pay = subtotal + fees (WITHOUT deposit)
      // Deposit is managed separately by the automatic system
      const totalAmount = subtotal + fees;
      console.log('🔍 [BookingService] Total amount to pay (without deposit):', totalAmount);
      console.log('🔍 [BookingService] Deposit amount (handled separately):', deposit);
    
      const result = {
        basePrice: tool.basePrice,
        totalDays,
        subtotal,
        fees,
        deposit,
        totalAmount,
      };
      
      console.log('🔍 [BookingService] Final pricing result:', result);
      return result;
    } catch (error) {
      console.error('❌ [BookingService] Error in calculatePricing:', error);
      throw error;
    }
  }

  async checkAvailability(
    checkAvailabilityDto: CheckAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    const { toolId, startDate, endDate } = checkAvailabilityDto;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    console.log('🔍 [BookingService] Date validation:', {
      startDateInput: startDate,
      endDateInput: endDate,
      startDateType: typeof startDate,
      endDateType: typeof endDate,
      start: start.toISOString(),
      end: end.toISOString(),
      now: now.toISOString(),
      startTime: start.getTime(),
      endTime: end.getTime(),
      comparison: start > end,
      timeDifference: end.getTime() - start.getTime(),
      daysDifference: (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    });

    if (start >= end) {
      console.log('❌ [BookingService] Date validation failed: End date must be after start date');
      console.log('❌ [BookingService] Detailed comparison:', {
        startDate: startDate,
        endDate: endDate,
        startParsed: start.toISOString(),
        endParsed: end.toISOString(),
        startTime: start.getTime(),
        endTime: end.getTime(),
        isStartGreaterOrEqual: start >= end
      });
      throw new BadRequestException('End date must be after start date');
    }

    // Enhanced date validation logic (consistent with create method)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    
    if (startDay < today) {
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
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Si début = 10 oct, fin = 11 oct → diffTime = 1 jour → return 1
    // Si début = 10 oct, fin = 12 oct → diffTime = 2 jours → return 2
    return days;
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

  async cancelBookingForDeposit(id: string, userId: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: ['renter', 'tool', 'tool.owner'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Vérifier que l'utilisateur est bien le locataire
    if (booking.renter.id !== userId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }

    // Vérifier que la réservation peut être annulée
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel this booking');
    }

    // Mettre à jour le statut de la réservation
    booking.status = BookingStatus.CANCELLED;
    booking.cancellationReason = 'Unpaid deposit';
    booking.cancelledAt = new Date();

    const updatedBooking = await this.bookingsRepository.save(booking);

    // Envoyer des notifications
    try {
      await this.bookingNotificationService.sendBookingCancelledNotification(
        updatedBooking,
        'Unpaid deposit'
      );
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
    }

    return updatedBooking;
  }

  async getDepositJobs(status?: string): Promise<any> {
    try {
      if (status) {
        // Vérifier que le statut est valide
        const validStatuses = Object.values(DepositJobStatus);
        if (!validStatuses.includes(status as any)) {
          throw new BadRequestException(`Invalid status: ${status}`);
        }
        return await this.depositSchedulerService.getDepositJobsByStatus(status as any);
      } else {
        return await this.depositSchedulerService.getAllDepositJobs();
      }
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve deposit jobs: ${error.message}`);
    }
  }
}
