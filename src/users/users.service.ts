import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, MoreThan, LessThan, Between } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { S3Service } from '../common/services/s3.service';
import { UserSession } from './entities/user-session.entity';
import { UserActivity } from './entities/user-activity.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface AdminUserFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'suspended';
  verified?: boolean;
  isAdmin?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  city?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  adminUsers: number;
  newUsersThisMonth: number;
  newUsersToday: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserSession)
    private userSessionRepository: Repository<UserSession>,
    @InjectRepository(UserActivity)
    private userActivityRepository: Repository<UserActivity>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private readonly s3Service: S3Service,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findOneWithRelations(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['tools', 'bookingsAsRenter', 'reviewsGiven', 'reviewsReceived', 'country'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    await this.usersRepository.save(user);
    
    // Return user with relations loaded
    return this.findOneWithRelations(id);
  }

  async updateWithHashedPassword(id: string, hashedPassword: string): Promise<User> {
    const user = await this.findOne(id);
    user.password = hashedPassword;
    await this.usersRepository.save(user);
    return this.findOneWithRelations(id);
  }

  async uploadProfilePicture(
    id: string,
    file: Express.Multer.File,
    currentUser: any,
  ): Promise<User> {
    // Check if user exists
    const user = await this.findOne(id);

    // Check if user can only update their own profile (unless admin)
    if (currentUser.id !== id && !currentUser.isAdmin) {
      throw new ForbiddenException('You can only update your own profile picture');
    }

    if (!file) {
      throw new ConflictException('No file provided');
    }

    // Delete old profile picture if it exists
    if (user.profilePicture) {
      try {
        await this.s3Service.deleteFile(user.profilePicture);
      } catch (error) {
        console.error('Error deleting old profile picture from S3:', error);
        // Continue with upload even if deletion fails
      }
    }

    // Upload new profile picture to S3
    const uploadResult = await this.s3Service.uploadFile(file, `users/${id}`);

    // Update user with new profile picture URL
    user.profilePicture = uploadResult.url;
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    console.log('=== DEBUG validateUser ===');
    console.log('Email recherché:', email);
    console.log('Password fourni:', password ? '[MASQUÉ - longueur: ' + password.length + ']' : 'VIDE');
    
    const user = await this.findByEmail(email);
    console.log('Utilisateur trouvé:', user ? 'OUI' : 'NON');
    
    if (user) {
      console.log('Détails utilisateur:', {
        id: user.id,
        email: user.email,
        hasPassword: !!user.password,
        passwordHash: user.password ? user.password.substring(0, 20) + '...' : 'VIDE',
        isActive: user.isActive,
        verifiedEmail: user.verifiedEmail
      });
      
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('Résultat bcrypt.compare:', passwordMatch);
      
      if (passwordMatch) {
        console.log('Validation réussie - utilisateur retourné');
        console.log('=== FIN DEBUG validateUser ===');
        return user;
      } else {
        console.log('Validation échouée - mot de passe incorrect');
      }
    } else {
      console.log('Validation échouée - utilisateur non trouvé');
    }
    
    console.log('=== FIN DEBUG validateUser ===');
    return null;
  }

  // Admin-specific methods
  async findAllForAdmin(
    filters: AdminUserFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<User>> {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // Apply filters
    if (filters.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.status) {
      switch (filters.status) {
        case 'active':
          queryBuilder.andWhere('user.isActive = :isActive', { isActive: true });
          break;
        case 'inactive':
          queryBuilder.andWhere('user.isActive = :isActive', { isActive: false });
          break;
        case 'suspended':
          queryBuilder.andWhere('user.isSuspended = :isSuspended', { isSuspended: true });
          break;
      }
    }

    if (filters.verified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', {
        isVerified: filters.verified,
      });
    }

    if (filters.isAdmin !== undefined) {
      queryBuilder.andWhere('user.isAdmin = :isAdmin', {
        isAdmin: filters.isAdmin,
      });
    }

    if (filters.city) {
      queryBuilder.andWhere('user.city ILIKE :city', {
        city: `%${filters.city}%`,
      });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('user.createdAt >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('user.createdAt <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    // Apply sorting
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'DESC';
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (pagination.page - 1) * pagination.limit;
    queryBuilder.skip(skip).take(pagination.limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalUsers, activeUsers, verifiedUsers, adminUsers, newUsersThisMonth, newUsersToday] =
      await Promise.all([
        this.usersRepository.count(),
        this.usersRepository.count({ where: { isActive: true } }),
        this.usersRepository.count({ where: { isVerified: true } }),
        this.usersRepository.count({ where: { isAdmin: true } }),
        this.usersRepository.count({
          where: { createdAt: MoreThan(startOfMonth) },
        }),
        this.usersRepository.count({
          where: { createdAt: MoreThan(startOfDay) },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      adminUsers,
      newUsersThisMonth,
      newUsersToday,
    };
  }

  async findOneForAdmin(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['tools', 'bookingsAsRenter', 'reviewsGiven', 'reviewsReceived', 'country'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = true;
    user.isSuspended = false;
    return this.usersRepository.save(user);
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async suspendUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isSuspended = true;
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async verifyUserEmail(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.verifiedEmail = true;
    return this.usersRepository.save(user);
  }

  async verifyUserIdentity(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isVerified = true;
    return this.usersRepository.save(user);
  }

  async forcePasswordReset(id: string): Promise<{ temporaryPassword: string }> {
    const user = await this.findOne(id);
    const temporaryPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    
    user.password = hashedPassword;
    user.mustChangePassword = true;
    await this.usersRepository.save(user);

    return { temporaryPassword };
  }

  async getUserSessions(id: string): Promise<UserSession[]> {
    return this.userSessionRepository.find({
      where: { userId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async terminateUserSessions(id: string): Promise<void> {
    await this.userSessionRepository.delete({ userId: id });
  }

  async getUserActivities(id: string, limit: number = 50): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { userId: id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUserTransactions(
    id: string,
    page: number = 1,
    limit: number = 20,
    filters?: { type?: string; status?: string },
  ): Promise<PaginatedResult<Transaction>> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * limit;
    
    const whereConditions: any[] = [
      { senderId: id },
      { recipientId: id },
    ];

    // Apply filters if provided
    if (filters?.type || filters?.status) {
      const filteredConditions: any[] = [];
      for (const condition of whereConditions) {
        const newCondition = { ...condition };
        if (filters.type) {
          newCondition.type = filters.type;
        }
        if (filters.status) {
          newCondition.status = filters.status;
        }
        filteredConditions.push(newCondition);
      }
      whereConditions.splice(0, whereConditions.length, ...filteredConditions);
    }
    
    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: whereConditions,
      relations: ['sender', 'recipient', 'wallet', 'booking'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async bulkAction(
    userIds: string[],
    action: 'activate' | 'deactivate' | 'suspend' | 'verify' | 'delete',
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        switch (action) {
          case 'activate':
            await this.activateUser(userId);
            break;
          case 'deactivate':
            await this.deactivateUser(userId);
            break;
          case 'suspend':
            await this.suspendUser(userId);
            break;
          case 'verify':
            await this.verifyUserIdentity(userId);
            break;
          case 'delete':
            await this.remove(userId);
            break;
          default:
            throw new BadRequestException(`Invalid action: ${action}`);
        }
        success++;
      } catch (error) {
        failed++;
        errors.push(`User ${userId}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async exportUsers(filters: AdminUserFilters): Promise<User[]> {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // Apply the same filters as findAllForAdmin but without pagination
    if (filters.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.status) {
      switch (filters.status) {
        case 'active':
          queryBuilder.andWhere('user.isActive = :isActive', { isActive: true });
          break;
        case 'inactive':
          queryBuilder.andWhere('user.isActive = :isActive', { isActive: false });
          break;
        case 'suspended':
          queryBuilder.andWhere('user.isSuspended = :isSuspended', { isSuspended: true });
          break;
      }
    }

    if (filters.verified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', {
        isVerified: filters.verified,
      });
    }

    if (filters.isAdmin !== undefined) {
      queryBuilder.andWhere('user.isAdmin = :isAdmin', {
        isAdmin: filters.isAdmin,
      });
    }

    if (filters.city) {
      queryBuilder.andWhere('user.city ILIKE :city', {
        city: `%${filters.city}%`,
      });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('user.createdAt >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('user.createdAt <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async generateVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await this.usersRepository.update(userId, {
      verifyToken: token,
      verifyTokenExpires: expiresAt,
    });
    
    return token;
  }

  async generateVerificationCode(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await this.usersRepository.update(userId, {
      verifyCode: code,
      verifyCodeExpires: expiresAt,
    });
    
    return code;
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await this.usersRepository.update(userId, {
      resetPasswordToken: token,
      resetPasswordExpires: expiresAt,
    });
    
    return token;
  }

  async generatePasswordResetCode(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await this.usersRepository.update(userId, {
      resetPasswordCode: code,
      resetPasswordCodeExpires: expiresAt,
    });
    
    return code;
  }

  async clearVerificationTokens(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      verifyToken: undefined,
      verifyTokenExpires: undefined,
      verifyCode: undefined,
      verifyCodeExpires: undefined,
    });
  }

  async clearPasswordResetTokens(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      resetPasswordCode: undefined,
      resetPasswordCodeExpires: undefined,
    });
  }
}
