import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { BookingsService } from '../bookings/bookings.service';
import { UsersService } from '../users/users.service';
import { DisputeStatus } from './enums/dispute-status.enum';
import { S3Service } from '../common/services/s3.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    private bookingsService: BookingsService,
    private usersService: UsersService,
    private s3Service: S3Service,
    private notificationsService: NotificationsService,
  ) {}

  async create(createDisputeDto: CreateDisputeDto): Promise<Dispute> {
    // Validate booking exists and get it with relations
    const booking = await this.bookingsService.findOne(
      createDisputeDto.bookingId,
    );

    // Validate user exists
    await this.usersService.findOne(createDisputeDto.userId);

    // Check if the current user already has an active dispute for this booking
    const existingActiveDispute = await this.disputesRepository.findOne({
      where: {
        bookingId: createDisputeDto.bookingId,
        initiatorId: createDisputeDto.userId,
        status: DisputeStatus.PENDING,
      },
    });

    if (existingActiveDispute) {
      throw new BadRequestException(
        "Vous avez déjà une réclamation en cours pour cette réservation. Veuillez attendre sa résolution avant d'en créer une nouvelle.",
      );
    }

    // Determine initiator and respondent
    const initiatorId = createDisputeDto.userId;
    const respondentId =
      createDisputeDto.userId === booking.renterId
        ? booking.ownerId
        : booking.renterId;
    const toolId = booking.toolId;

    // Create and save the dispute with all required fields
    const dispute = this.disputesRepository.create({
      reason: createDisputeDto.reportReason || createDisputeDto.reason,
      description: createDisputeDto.reportMessage,
      initiatorId,
      respondentId,
      toolId,
      bookingId: createDisputeDto.bookingId,
      images: [],
      status: DisputeStatus.PENDING,
    });

    const savedDispute = await this.disputesRepository.save(dispute);

    // Update booking hasActiveClaim to true
    await this.bookingsService.update(createDisputeDto.bookingId, {
      hasActiveClaim: true,
    });

    // Send notification to the respondent (owner or renter)
    try {
      const initiator = await this.usersService.findOne(initiatorId);
      const tool = booking.tool;

      await this.notificationsService.createSystemNotification(
        respondentId,
        NotificationType.DISPUTE_CREATED,
        'Nouvelle réclamation',
        `${initiator.firstName} ${initiator.lastName} a créé une réclamation concernant "${tool?.title || "l'outil"}". Motif: ${createDisputeDto.reportReason}`,
        savedDispute.id,
        'dispute',
        `/disputes/${savedDispute.id}`,
      );
    } catch (error) {
      // Log error but don't fail the dispute creation
      console.error('Failed to send dispute notification:', error);
    }

    return savedDispute;
  }

  async createWithImages(
    createDisputeDto: CreateDisputeDto,
    files?: Express.Multer.File[],
  ): Promise<Dispute> {
    // Validate file sizes (max 1MB each)
    if (files && files.length > 0) {
      const maxSize = 1024 * 1024; // 1MB
      for (const file of files) {
        if (file.size > maxSize) {
          throw new BadRequestException(
            `File ${file.originalname} exceeds maximum size of 1MB`,
          );
        }
      }
    }

    // Validate booking exists and get it with relations
    const booking = await this.bookingsService.findOne(
      createDisputeDto.bookingId,
    );

    // Validate user exists
    await this.usersService.findOne(createDisputeDto.userId);

    // Check if the current user already has an active dispute for this booking
    const existingActiveDispute = await this.disputesRepository.findOne({
      where: {
        bookingId: createDisputeDto.bookingId,
        initiatorId: createDisputeDto.userId,
        status: DisputeStatus.PENDING,
      },
    });

    if (existingActiveDispute) {
      throw new BadRequestException(
        "Vous avez déjà une réclamation en cours pour cette réservation. Veuillez attendre sa résolution avant d'en créer une nouvelle.",
      );
    }

    // Upload images to S3 if provided
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        const uploadResults = await this.s3Service.uploadFiles(files, 'disp');
        imageUrls = uploadResults.map((result) => result.url);
      } catch (error) {
        throw new BadRequestException(
          `Failed to upload images: ${error.message}`,
        );
      }
    }

    // Determine initiator and respondent
    const initiatorId = createDisputeDto.userId;
    const respondentId =
      createDisputeDto.userId === booking.renterId
        ? booking.ownerId
        : booking.renterId;
    const toolId = booking.toolId;

    // Create and save the dispute with all required fields including images
    const dispute = this.disputesRepository.create({
      reason: createDisputeDto.reportReason || createDisputeDto.reason,
      description: createDisputeDto.reportMessage,
      initiatorId,
      respondentId,
      toolId,
      bookingId: createDisputeDto.bookingId,
      images: imageUrls,
      status: DisputeStatus.PENDING,
    });

    const savedDispute = await this.disputesRepository.save(dispute);

    // Update booking hasActiveClaim to true
    await this.bookingsService.update(createDisputeDto.bookingId, {
      hasActiveClaim: true,
    });

    return savedDispute;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: any,
  ): Promise<{
    items: Dispute[];
    meta: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.disputesRepository
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.initiator', 'initiator')
      .leftJoinAndSelect('dispute.respondent', 'respondent')
      .leftJoinAndSelect('dispute.booking', 'booking')
      .leftJoinAndSelect('dispute.tool', 'tool')
      .leftJoinAndSelect('dispute.moderator', 'moderator')
      .orderBy('dispute.createdAt', 'DESC');

    // Apply filters if provided
    if (filters?.search) {
      queryBuilder.andWhere(
        '(dispute.reason LIKE :search OR dispute.description LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters?.status) {
      queryBuilder.andWhere('dispute.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.dateRange?.startDate && filters?.dateRange?.endDate) {
      queryBuilder.andWhere(
        'dispute.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: filters.dateRange.startDate,
          endDate: filters.dateRange.endDate,
        },
      );
    }

    const [items, totalItems] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<Dispute> {
    const dispute = await this.disputesRepository.findOne({
      where: { id },
      relations: ['initiator', 'respondent', 'moderator', 'booking', 'tool'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    return dispute;
  }

  async findByUserId(userId: string): Promise<Dispute[]> {
    return this.disputesRepository.find({
      where: { initiatorId: userId },
      relations: ['initiator', 'respondent', 'moderator', 'booking', 'tool'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByBookingId(bookingId: string): Promise<Dispute> {
    const dispute = await this.disputesRepository.findOne({
      where: { bookingId },
      relations: ['initiator', 'respondent', 'moderator', 'booking', 'tool'],
    });

    if (!dispute) {
      throw new NotFoundException(
        `Dispute for booking ID ${bookingId} not found`,
      );
    }

    return dispute;
  }

  async update(
    id: string,
    updateDisputeDto: UpdateDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.findOne(id);

    // Update admin if provided
    if (updateDisputeDto.adminId) {
      await this.usersService.findOne(updateDisputeDto.adminId);
    }

    Object.assign(dispute, updateDisputeDto);
    return this.disputesRepository.save(dispute);
  }

  async updateStatus(id: string, status: DisputeStatus): Promise<Dispute> {
    const dispute = await this.findOne(id);
    dispute.status = status;
    return this.disputesRepository.save(dispute);
  }

  async remove(id: string): Promise<void> {
    const dispute = await this.findOne(id);
    await this.disputesRepository.remove(dispute);
  }
}
