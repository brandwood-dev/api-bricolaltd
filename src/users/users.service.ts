import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, MoreThan, LessThan, Between } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { S3Service } from '../common/services/s3.service';
import { UserSession } from './entities/user-session.entity';
import { UserActivity } from './entities/user-activity.entity';
import { UserPreference } from './entities/user-preference.entity';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Bookmark } from '../bookmarks/entities/bookmark.entity';
import { Document } from '../documents/entities/document.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { DisputeStatus } from '../disputes/enums/dispute-status.enum';
import { Review } from '../reviews/entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { Tool } from '../tools/entities/tool.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Email } from '../emails/entities/email.entity';
import { SecurityLog } from '../admin/entities/security-log.entity';
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
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    @InjectRepository(AccountDeletionRequest)
    private accountDeletionRequestRepository: Repository<AccountDeletionRequest>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(Bookmark)
    private bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Email)
    private emailRepository: Repository<Email>,
    @InjectRepository(SecurityLog)
    private securityLogRepository: Repository<SecurityLog>,
    private readonly s3Service: S3Service,
  ) {
    this.logger = new Logger(UsersService.name);
  }

  private readonly logger: Logger;

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

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.findOne(id);

    // Only allow specific fields: firstName, lastName, password, phoneNumber, profilePicture, countryId, address
    const allowedUpdates: Partial<User> = {};

    if (updateProfileDto.firstName !== undefined) {
      allowedUpdates.firstName = updateProfileDto.firstName;
    }

    if (updateProfileDto.lastName !== undefined) {
      allowedUpdates.lastName = updateProfileDto.lastName;
    }

    if (updateProfileDto.phoneNumber !== undefined) {
      allowedUpdates.phoneNumber = updateProfileDto.phoneNumber;
    }

    if (updateProfileDto.profilePicture !== undefined) {
      allowedUpdates.profilePicture = updateProfileDto.profilePicture;
    }

    if (updateProfileDto.countryId !== undefined) {
      allowedUpdates.countryId = updateProfileDto.countryId;
    }

    if (updateProfileDto.address !== undefined) {
      allowedUpdates.address = updateProfileDto.address;
    }

    // Hash password if provided (same hash method as register)
    if (updateProfileDto.password) {
      allowedUpdates.password = await bcrypt.hash(updateProfileDto.password, 10);
    }

    Object.assign(user, allowedUpdates);
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

  async uploadProfilePhoto(id: string, file: Express.Multer.File): Promise<{ data: { url: string }; message: string }> {
    console.log('=== DEBUG uploadProfilePhoto ===');
    console.log('User ID:', id);
    console.log('File received:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      buffer: file?.buffer ? `Buffer(${file.buffer.length} bytes)` : 'No buffer'
    });

    if (!file) {
      console.error('No file provided');
      throw new ConflictException('No file provided');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.error('Invalid file type:', file.mimetype);
      throw new ConflictException('Invalid file type. Only JPEG, PNG and WebP are allowed.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('File size too large:', file.size);
      throw new ConflictException('File size too large. Maximum size is 5MB.');
    }

    try {
      console.log('Attempting S3 upload...');
      // Upload to S3 bucket 'bricolaltd-assets/profiles'
      const uploadResult = await this.s3Service.uploadFile(file, 'profiles');
      console.log('S3 upload successful:', uploadResult);
      
      // Get user and update profile picture URL in database
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      
      // Update user's profile picture URL
      user.profilePicture = uploadResult.url;
      await this.usersRepository.save(user);
      console.log('User profile picture updated in database:', uploadResult.url);
      
      const response = {
        data: {
          url: uploadResult.url,
        },
        message: 'Profile photo uploaded successfully',
      };
      console.log('Returning response:', response);
      console.log('=== END DEBUG uploadProfilePhoto ===');
      
      return response;
    } catch (error) {
      console.error('=== ERROR uploadProfilePhoto ===');
      console.error('Error uploading profile photo to S3:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('=== END ERROR uploadProfilePhoto ===');
      throw new ConflictException('Failed to upload profile photo');
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async deleteUserAccount(userId: string): Promise<{ message: string }> {
    console.log('=== DEBUG deleteUserAccount ===');
    console.log('User ID:', userId);

    // Find the user
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      // Delete all related records in the correct order to avoid foreign key constraints
      console.log('Starting cascade deletion for user:', userId);

      // 1. Delete user sessions
      await this.userSessionRepository.delete({ userId });
      console.log('✓ Deleted user sessions');

      // 2. Delete user activities
      await this.userActivityRepository.delete({ userId });
      console.log('✓ Deleted user activities');

      // 3. Delete account deletion requests
      await this.accountDeletionRequestRepository.delete({ userId });
      console.log('✓ Deleted account deletion requests');

      // 4. Delete notifications
      await this.notificationRepository.delete({ userId });
      console.log('✓ Deleted notifications');

      // 5. Delete bookmarks
      await this.bookmarkRepository.delete({ userId });
      console.log('✓ Deleted bookmarks');

      // 6. Delete documents
      await this.documentRepository.delete({ userId });
      console.log('✓ Deleted documents');

      // 7. Delete disputes (both as initiator and respondent)
      await this.disputeRepository.delete({ initiatorId: userId });
      await this.disputeRepository.delete({ respondentId: userId });
      console.log('✓ Deleted disputes');

      // 8. Delete reviews (both given and received)
      await this.reviewRepository.delete({ reviewerId: userId });
      await this.reviewRepository.delete({ revieweeId: userId });
      console.log('✓ Deleted reviews');

      // 9. Delete payment_transactions FIRST (they reference transactions)
      console.log('Starting payment_transactions deletion...');
      
      // Get all transactions related to the user to delete their payment_transactions
      const userTransactions = await this.transactionRepository.find({
        where: [
          { senderId: userId },
          { recipientId: userId }
        ]
      });
      
      console.log(`Found ${userTransactions.length} transactions for user`);
      
      // Delete payment_transactions for user's direct transactions
      for (const transaction of userTransactions) {
        const paymentTransactions = await this.paymentTransactionRepository.delete({ transactionId: transaction.id });
        console.log(`✓ Deleted ${paymentTransactions.affected || 0} payment_transactions for transaction ${transaction.id}`);
      }
      
      // Get user's bookings and tools to find related transactions
      const userBookingsAsRenter = await this.bookingRepository.find({ where: { renterId: userId } });
      const userTools = await this.toolRepository.find({ where: { ownerId: userId } });
      
      // Delete payment_transactions for booking transactions (as renter)
      for (const booking of userBookingsAsRenter) {
        const bookingTransactions = await this.transactionRepository.find({ where: { bookingId: booking.id } });
        for (const transaction of bookingTransactions) {
          const paymentTransactions = await this.paymentTransactionRepository.delete({ transactionId: transaction.id });
          console.log(`✓ Deleted ${paymentTransactions.affected || 0} payment_transactions for booking transaction ${transaction.id}`);
        }
      }
      
      // Delete payment_transactions for tool booking transactions (as owner)
      for (const tool of userTools) {
        const toolBookings = await this.bookingRepository.find({ where: { toolId: tool.id } });
        for (const booking of toolBookings) {
          const bookingTransactions = await this.transactionRepository.find({ where: { bookingId: booking.id } });
          for (const transaction of bookingTransactions) {
            const paymentTransactions = await this.paymentTransactionRepository.delete({ transactionId: transaction.id });
            console.log(`✓ Deleted ${paymentTransactions.affected || 0} payment_transactions for tool booking transaction ${transaction.id}`);
          }
        }
      }
      
      console.log('✓ All payment_transactions deleted successfully');
      
      // 10. Delete transactions (now safe after payment_transactions are deleted)
      console.log('Starting transaction deletion...');
      
      // Delete transactions sent/received by user
      const sentTransactions = await this.transactionRepository.delete({ senderId: userId });
      console.log(`✓ Deleted ${sentTransactions.affected || 0} transactions sent by user`);
      
      const receivedTransactions = await this.transactionRepository.delete({ recipientId: userId });
      console.log(`✓ Deleted ${receivedTransactions.affected || 0} transactions received by user`);
      
      // Delete transactions linked to user's bookings (as renter)
      console.log(`Found ${userBookingsAsRenter.length} bookings where user is renter`);
      for (const booking of userBookingsAsRenter) {
        const bookingTransactions = await this.transactionRepository.delete({ bookingId: booking.id });
        console.log(`✓ Deleted ${bookingTransactions.affected || 0} transactions for booking ${booking.id}`);
      }
      
      // Delete transactions linked to bookings of user's tools (as owner)
      console.log(`Found ${userTools.length} tools owned by user`);
      for (const tool of userTools) {
        const toolBookings = await this.bookingRepository.find({ where: { toolId: tool.id } });
        console.log(`Found ${toolBookings.length} bookings for tool ${tool.id}`);
        for (const booking of toolBookings) {
          const toolBookingTransactions = await this.transactionRepository.delete({ bookingId: booking.id });
          console.log(`✓ Deleted ${toolBookingTransactions.affected || 0} transactions for tool booking ${booking.id}`);
        }
      }
      
      console.log('✓ All transactions deleted successfully');

      // 11. Delete bookings (now safe after transactions are deleted)
      // Delete bookings as renter
      const renterBookings = await this.bookingRepository.delete({ renterId: userId });
      console.log(`✓ Deleted ${renterBookings.affected || 0} bookings where user is renter`);
      
      // Delete bookings for user's tools (as owner)
      for (const tool of userTools) {
        const ownerBookings = await this.bookingRepository.delete({ toolId: tool.id });
        console.log(`✓ Deleted ${ownerBookings.affected || 0} bookings for tool ${tool.id}`);
      }
      console.log('✓ All bookings deleted successfully');

      // 12. Delete tools owned by user
      await this.toolRepository.delete({ ownerId: userId });
      console.log('✓ Deleted tools');

      // 13. Delete user preferences
      await this.userPreferenceRepository.delete({ userId });
      console.log('✓ Deleted user preferences');

      // 14. Delete emails (where user is sender or admin)
      console.log('Starting email deletion...');
      const emailsAsUser = await this.emailRepository.delete({ userId });
      console.log(`✓ Deleted ${emailsAsUser.affected || 0} emails where user is sender`);
      
      const emailsAsAdmin = await this.emailRepository.delete({ adminId: userId });
      console.log(`✓ Deleted ${emailsAsAdmin.affected || 0} emails where user is admin`);
      console.log('✓ All emails deleted successfully');

      // 15. Delete security logs
      console.log('Starting security logs deletion...');
      const securityLogs = await this.securityLogRepository.delete({ userId });
      console.log(`✓ Deleted ${securityLogs.affected || 0} security logs`);
      console.log('✓ All security logs deleted successfully');

      // 16. Delete wallet
      await this.walletRepository.delete({ userId });
      console.log('✓ Deleted wallet');

      // 17. Finally delete the user
      await this.usersRepository.delete(userId);
      console.log('✓ Deleted user record');

      console.log('Account deleted successfully for user:', userId);
      console.log('=== END DEBUG deleteUserAccount ===');

      return { message: 'Account deleted successfully' };
    } catch (error) {
      console.error('Error during cascade deletion:', error);
      throw new Error(`Failed to delete user account: ${error.message}`);
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

  async validateAccountDeletion(userId: string, currentUser: any): Promise<any> {
    // Check if user can only validate their own account (unless admin)
    if (currentUser.id !== userId && !currentUser.isAdmin) {
      throw new ForbiddenException('You can only validate your own account deletion');
    }

    // Check if user exists
    const user = await this.findOne(userId);

    // Initialize validation result
    const validationResult = {
      canDelete: true,
      blockingIssues: {
        pendingBookings: 0,
        confirmedReservations: 0,
        ongoingDisputes: 0,
        unreturnedTools: 0
      },
      details: {
        pendingBookings: [] as any[],
        confirmedReservations: [] as any[],
        ongoingDisputes: [] as any[],
        unreturnedTools: [] as any[]
      }
    };

    try {
      // Check for pending/confirmed bookings as renter
      const userBookings = await this.usersRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.bookingsAsRenter', 'booking')
        .leftJoinAndSelect('booking.tool', 'tool')
        .where('user.id = :userId', { userId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ['PENDING', 'ACCEPTED', 'ONGOING'],
        })
        .getOne();

      if (userBookings && userBookings.bookingsAsRenter && userBookings.bookingsAsRenter.length > 0) {
        validationResult.blockingIssues.pendingBookings = userBookings.bookingsAsRenter.length;
        validationResult.details.pendingBookings = userBookings.bookingsAsRenter;
        validationResult.canDelete = false;
      }

      // Check for confirmed reservations as tool owner
      const ownerBookings = await this.usersRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.tools', 'tool')
        .leftJoinAndSelect('tool.bookings', 'booking')
        .leftJoinAndSelect('booking.renter', 'renter')
        .where('user.id = :userId', { userId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ['PENDING', 'ACCEPTED', 'ONGOING'],
        })
        .getOne();

      if (ownerBookings && ownerBookings.tools && ownerBookings.tools.length > 0) {
        const confirmedBookings = ownerBookings.tools.flatMap(tool => tool.bookings || []);
        if (confirmedBookings.length > 0) {
          validationResult.blockingIssues.confirmedReservations = confirmedBookings.length;
          validationResult.details.confirmedReservations = confirmedBookings;
          validationResult.canDelete = false;
        }
      }

      // Check for ongoing disputes where user is initiator or respondent
      try {
        const ongoingDisputes = await this.disputeRepository.count({
          where: [
            { initiator: { id: userId }, status: DisputeStatus.PENDING },
            { respondent: { id: userId }, status: DisputeStatus.PENDING }
          ]
        });
        validationResult.blockingIssues.ongoingDisputes = ongoingDisputes;
        
        if (ongoingDisputes > 0) {
          validationResult.canDelete = false;
          this.logger.warn(`User ${userId} has ${ongoingDisputes} ongoing disputes`);
        }
      } catch (error) {
        this.logger.error(`Error checking ongoing disputes for user ${userId}:`, error);
        validationResult.blockingIssues.ongoingDisputes = 0;
      }

      // Check for unreturned tools (bookings where user is renter and hasn't returned tool)
      try {
        const unreturnedTools = await this.bookingRepository.count({
          where: {
            renter: { id: userId },
            status: BookingStatus.ONGOING,
            renterHasReturned: false
          }
        });
        validationResult.blockingIssues.unreturnedTools = unreturnedTools;
        
        if (unreturnedTools > 0) {
          validationResult.canDelete = false;
          this.logger.warn(`User ${userId} has ${unreturnedTools} unreturned tools`);
        }
      } catch (error) {
        this.logger.error(`Error checking unreturned tools for user ${userId}:`, error);
        validationResult.blockingIssues.unreturnedTools = 0;
      }

    } catch (error) {
      console.error('Error validating account deletion:', error);
      // In case of error, be conservative and don't allow deletion
      validationResult.canDelete = false;
    }

    return {
      data: validationResult,
      message: 'Account deletion validation completed'
    };
  }
}
