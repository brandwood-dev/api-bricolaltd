import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { CreateAccountDeletionRequestDto } from './dto/create-account-deletion-request.dto';
import { UpdateAccountDeletionRequestDto } from './dto/update-account-deletion-request.dto';
import { DeletionStatus } from './enums/deletion-status.enum';
import { User } from './entities/user.entity';

@Injectable()
export class AccountDeletionRequestService {
  constructor(
    @InjectRepository(AccountDeletionRequest)
    private readonly accountDeletionRequestRepository: Repository<AccountDeletionRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    createAccountDeletionRequestDto: CreateAccountDeletionRequestDto,
  ): Promise<AccountDeletionRequest> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if there's already a pending request
    const existingRequest = await this.accountDeletionRequestRepository.findOne(
      {
        where: {
          userId,
          status: DeletionStatus.PENDING,
        },
      },
    );

    if (existingRequest) {
      throw new BadRequestException(
        'You already have a pending account deletion request',
      );
    }

    const deletionRequest = this.accountDeletionRequestRepository.create({
      userId,
      user,
      status: DeletionStatus.PENDING,
      ...createAccountDeletionRequestDto,
    });

    return this.accountDeletionRequestRepository.save(deletionRequest);
  }

  async findAll(): Promise<AccountDeletionRequest[]> {
    return this.accountDeletionRequestRepository.find({
      relations: ['user', 'reviewedByAdmin'],
      order: { requestedAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<AccountDeletionRequest[]> {
    return this.accountDeletionRequestRepository.find({
      where: { userId },
      relations: ['user', 'reviewedByAdmin'],
      order: { requestedAt: 'DESC' },
    });
  }

  async findByStatus(
    status: DeletionStatus,
  ): Promise<AccountDeletionRequest[]> {
    return this.accountDeletionRequestRepository.find({
      where: { status },
      relations: ['user', 'reviewedByAdmin'],
      order: { requestedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AccountDeletionRequest> {
    const deletionRequest = await this.accountDeletionRequestRepository.findOne(
      {
        where: { id },
        relations: ['user', 'reviewedByAdmin'],
      },
    );

    if (!deletionRequest) {
      throw new NotFoundException('Account deletion request not found');
    }

    return deletionRequest;
  }

  async updateStatus(
    id: string,
    updateDto: UpdateAccountDeletionRequestDto,
    adminId: string,
  ): Promise<AccountDeletionRequest> {
    const deletionRequest = await this.findOne(id);

    // Verify admin exists
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isAdmin: true },
    });
    if (!admin) {
      throw new ForbiddenException('Only admins can update deletion requests');
    }

    // Update the request
    Object.assign(deletionRequest, {
      ...updateDto,
      reviewedByAdminId: adminId,
      reviewedByAdmin: admin,
      reviewedAt: new Date(),
    });

    return this.accountDeletionRequestRepository.save(deletionRequest);
  }

  async cancel(id: string, userId: string): Promise<AccountDeletionRequest> {
    const deletionRequest = await this.findOne(id);

    // Check if the request belongs to the user
    if (deletionRequest.userId !== userId) {
      throw new ForbiddenException(
        'You can only cancel your own deletion requests',
      );
    }

    // Check if the request is still pending
    if (deletionRequest.status !== DeletionStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    // Remove the request instead of updating status
    await this.accountDeletionRequestRepository.remove(deletionRequest);
    return deletionRequest;
  }

  async remove(id: string): Promise<void> {
    const deletionRequest = await this.findOne(id);
    await this.accountDeletionRequestRepository.remove(deletionRequest);
  }

  async getPendingRequests(): Promise<AccountDeletionRequest[]> {
    return this.findByStatus(DeletionStatus.PENDING);
  }

  async getRequestStats(): Promise<{
    total: number;
    pending: number;
    deleted: number;
    restored: number;
  }> {
    const [total, pending, deleted, restored] = await Promise.all([
      this.accountDeletionRequestRepository.count(),
      this.accountDeletionRequestRepository.count({
        where: { status: DeletionStatus.PENDING },
      }),
      this.accountDeletionRequestRepository.count({
        where: { status: DeletionStatus.DELETED },
      }),
      this.accountDeletionRequestRepository.count({
        where: { status: DeletionStatus.RESTORED },
      }),
    ]);

    return { total, pending, deleted, restored };
  }
}
