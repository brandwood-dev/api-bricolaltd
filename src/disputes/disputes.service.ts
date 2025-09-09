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

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepository: Repository<Dispute>,
    private bookingsService: BookingsService,
    private usersService: UsersService,
  ) {}

  async create(createDisputeDto: CreateDisputeDto): Promise<Dispute> {
    // Validate booking exists
    await this.bookingsService.findOne(createDisputeDto.bookingId);

    // Validate user exists
    await this.usersService.findOne(createDisputeDto.userId);

    // Check if dispute already exists for this booking
    const existingDispute = await this.disputesRepository.findOne({
      where: { bookingId: createDisputeDto.bookingId },
    });

    if (existingDispute) {
      throw new BadRequestException(
        'A dispute already exists for this booking',
      );
    }

    // Create and save the dispute
    const dispute = this.disputesRepository.create({
      ...createDisputeDto,
      status: DisputeStatus.PENDING,
    });

    return this.disputesRepository.save(dispute);
  }

  async findAll(page: number = 1, limit: number = 10, filters?: any): Promise<{
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
        '(dispute.title LIKE :search OR dispute.description LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    if (filters?.status) {
      queryBuilder.andWhere('dispute.status = :status', { status: filters.status });
    }

    if (filters?.dateRange?.startDate && filters?.dateRange?.endDate) {
      queryBuilder.andWhere(
        'dispute.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: filters.dateRange.startDate,
          endDate: filters.dateRange.endDate,
        }
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
