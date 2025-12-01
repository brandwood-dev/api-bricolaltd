import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Like,
  In,
  MoreThan,
  LessThan,
  Between,
  Not,
} from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { S3Service } from '../common/services/s3.service';
import { Country } from './entities/country.entity';
import { Currency } from './entities/currency.entity';
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
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { Tool } from '../tools/entities/tool.entity';
import { ToolStatus } from '../tools/enums/tool-status.enum';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletsService } from '../wallets/wallets.service';
import { Email } from '../emails/entities/email.entity';
import { SecurityLog } from '../admin/entities/security-log.entity';
import { SendGridService } from '../emails/sendgrid.service';
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
  country?: string;
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
  private readonly logger: Logger;
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
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
    @InjectRepository(ReviewTool)
    private reviewToolRepository: Repository<ReviewTool>,
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
    private readonly walletsService: WalletsService,
    private readonly sendGridService: SendGridService,
  ) {
    this.logger = new Logger(UsersService.name);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Determine default currency based on country
    let defaultCurrencyCode = createUserDto.defaultCurrencyCode || 'GBP'; // Default fallback

    if (createUserDto.countryId && !createUserDto.defaultCurrencyCode) {
      defaultCurrencyCode = await this.getDefaultCurrencyByCountry(
        createUserDto.countryId,
      );
    }

    // Validate that the currency exists in the system
    await this.validateCurrencyExists(defaultCurrencyCode);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      defaultCurrencyCode,
    });

    const savedUser = await this.usersRepository.save(user);

    // Créer automatiquement un wallet pour le nouvel utilisateur
    try {
      this.logger.log(
        `Création d'un wallet pour le nouvel utilisateur: ${savedUser.id}`,
      );

      // Utiliser le WalletsService pour créer le wallet
      await this.walletsService.create({
        userId: savedUser.id,
        balance: 0,
      });

      this.logger.log(
        `✅ Wallet créé avec succès pour l'utilisateur ${savedUser.id}`,
      );
    } catch (walletError) {
      this.logger.error(
        `❌ Erreur lors de la création du wallet pour l'utilisateur ${savedUser.id}:`,
        walletError,
      );
      // Ne pas échouer l'inscription si la création du wallet échoue
      // Logguer l'erreur mais continuer le processus
    }

    // Créer automatiquement les préférences utilisateur (alignées avec le seed)
    try {
      this.logger.log(
        `Création des préférences utilisateur pour: ${savedUser.id}`,
      );
      const preferenceCurrency = 'GBP';
      const preferences = this.userPreferenceRepository.create({
        userId: savedUser.id,
        language: 'fr',
        theme: 'light',
        currency: preferenceCurrency,
        distanceUnit: 'km',
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: true,
        showOnlineStatus: true,
        searchRadiusKm: 50,
      });
      await this.userPreferenceRepository.save(preferences);
      this.logger.log(`✅ Préférences créées avec succès pour ${savedUser.id}`);
    } catch (prefError) {
      this.logger.error(
        `❌ Erreur lors de la création des préférences pour l'utilisateur ${savedUser.id}:`,
        prefError,
      );
      // Ne pas échouer l'inscription si la création des préférences échoue
    }

    return savedUser;
  }

  /**
   * Get default currency code based on country ID
   * @param countryId - The country ID to get currency for
   * @returns Promise<string> - The currency code or default 'GBP'
   */
  private async getDefaultCurrencyByCountry(
    countryId: string,
  ): Promise<string> {
    try {
      const country = await this.countryRepository.findOne({
        where: { id: countryId },
      });

      if (country && country.currency) {
        this.logger.log(
          `Found currency ${country.currency} for country ${country.name} (${countryId})`,
        );
        return country.currency;
      } else {
        this.logger.warn(
          `Country not found or no currency set for ID: ${countryId}`,
        );
        return 'GBP'; // Default fallback
      }
    } catch (error) {
      this.logger.error(
        `Error fetching country currency for ID ${countryId}: ${error.message}`,
      );
      return 'GBP'; // Default fallback on error
    }
  }

  /**
   * Validate that a currency exists and is active in the system
   * @param currencyCode - The currency code to validate
   * @throws BadRequestException if currency doesn't exist or is inactive
   */
  private async validateCurrencyExists(currencyCode: string): Promise<void> {
    try {
      const currency = await this.currencyRepository.findOne({
        where: { code: currencyCode },
      });

      if (!currency) {
        this.logger.error(`Currency not found: ${currencyCode}`);
        throw new BadRequestException(
          `Currency '${currencyCode}' is not supported`,
        );
      }

      if (!currency.isActive) {
        this.logger.error(`Currency is inactive: ${currencyCode}`);
        throw new BadRequestException(
          `Currency '${currencyCode}' is currently inactive`,
        );
      }

      this.logger.log(
        `Currency validation successful: ${currencyCode} (${currency.name})`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // Re-throw validation errors
      }

      this.logger.error(
        `Error validating currency ${currencyCode}: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to validate currency '${currencyCode}'`,
      );
    }
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
      relations: [
        'tools',
        'bookingsAsRenter',
        'reviewsGiven',
        'reviewsReceived',
        'country',
      ],
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

  async updateProfile(
    id: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
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

    if (updateProfileDto.phone_prefix !== undefined) {
      allowedUpdates.phone_prefix = updateProfileDto.phone_prefix;
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
      allowedUpdates.password = await bcrypt.hash(
        updateProfileDto.password,
        10,
      );
    }

    Object.assign(user, allowedUpdates);
    await this.usersRepository.save(user);

    // Return user with relations loaded
    return this.findOneWithRelations(id);
  }

  async updateWithHashedPassword(
    id: string,
    hashedPassword: string,
  ): Promise<User> {
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
      throw new ForbiddenException(
        'You can only update your own profile picture',
      );
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

  async uploadProfilePhoto(
    id: string,
    file: Express.Multer.File,
  ): Promise<{ data: { url: string }; message: string }> {
    console.log('=== DEBUG uploadProfilePhoto ===');
    console.log('User ID:', id);
    console.log('File received:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      buffer: file?.buffer
        ? `Buffer(${file.buffer.length} bytes)`
        : 'No buffer',
    });

    if (!file) {
      console.error('No file provided');
      throw new ConflictException('No file provided');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.error('Invalid file type:', file.mimetype);
      throw new ConflictException(
        'Invalid file type. Only JPEG, PNG and WebP are allowed.',
      );
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
      console.log(
        'User profile picture updated in database:',
        uploadResult.url,
      );

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
        where: [{ senderId: userId }, { recipientId: userId }],
      });

      console.log(`Found ${userTransactions.length} transactions for user`);

      // Delete payment_transactions for user's direct transactions
      for (const transaction of userTransactions) {
        const paymentTransactions =
          await this.paymentTransactionRepository.delete({
            transactionId: transaction.id,
          });
        console.log(
          `✓ Deleted ${paymentTransactions.affected || 0} payment_transactions for transaction ${transaction.id}`,
        );
      }

      // Get user's bookings and tools to find related transactions
      const userBookingsAsRenter = await this.bookingRepository.find({
        where: { renterId: userId },
      });
      const userTools = await this.toolRepository.find({
        where: { ownerId: userId },
      });

      // Delete payment_transactions for booking transactions (as renter)
      for (const booking of userBookingsAsRenter) {
        const bookingTransactions = await this.transactionRepository.find({
          where: { bookingId: booking.id },
        });
        for (const transaction of bookingTransactions) {
          const paymentTransactions =
            await this.paymentTransactionRepository.delete({
              transactionId: transaction.id,
            });
          console.log(
            `✓ Deleted ${paymentTransactions.affected || 0} payment_transactions for booking transaction ${transaction.id}`,
          );
        }
      }

      // Delete payment_transactions for tool booking transactions (as owner)
      for (const tool of userTools) {
        const toolBookings = await this.bookingRepository.find({
          where: { toolId: tool.id },
        });
        for (const booking of toolBookings) {
          const bookingTransactions = await this.transactionRepository.find({
            where: { bookingId: booking.id },
          });
          for (const transaction of bookingTransactions) {
            const paymentTransactions =
              await this.paymentTransactionRepository.delete({
                transactionId: transaction.id,
              });
            console.log(
              `✓ Deleted ${paymentTransactions.affected || 0} payment_transactions for tool booking transaction ${transaction.id}`,
            );
          }
        }
      }

      console.log('✓ All payment_transactions deleted successfully');

      // 10. Delete transactions (now safe after payment_transactions are deleted)
      console.log('Starting transaction deletion...');

      // Delete transactions sent/received by user
      const sentTransactions = await this.transactionRepository.delete({
        senderId: userId,
      });
      console.log(
        `✓ Deleted ${sentTransactions.affected || 0} transactions sent by user`,
      );

      const receivedTransactions = await this.transactionRepository.delete({
        recipientId: userId,
      });
      console.log(
        `✓ Deleted ${receivedTransactions.affected || 0} transactions received by user`,
      );

      // Delete transactions linked to user's bookings (as renter)
      console.log(
        `Found ${userBookingsAsRenter.length} bookings where user is renter`,
      );
      for (const booking of userBookingsAsRenter) {
        const bookingTransactions = await this.transactionRepository.delete({
          bookingId: booking.id,
        });
        console.log(
          `✓ Deleted ${bookingTransactions.affected || 0} transactions for booking ${booking.id}`,
        );
      }

      // Delete transactions linked to bookings of user's tools (as owner)
      console.log(`Found ${userTools.length} tools owned by user`);
      for (const tool of userTools) {
        const toolBookings = await this.bookingRepository.find({
          where: { toolId: tool.id },
        });
        console.log(
          `Found ${toolBookings.length} bookings for tool ${tool.id}`,
        );
        for (const booking of toolBookings) {
          const toolBookingTransactions =
            await this.transactionRepository.delete({ bookingId: booking.id });
          console.log(
            `✓ Deleted ${toolBookingTransactions.affected || 0} transactions for tool booking ${booking.id}`,
          );
        }
      }

      console.log('✓ All transactions deleted successfully');

      // 11. Delete bookings (now safe after transactions are deleted)
      // Delete bookings as renter
      const renterBookings = await this.bookingRepository.delete({
        renterId: userId,
      });
      console.log(
        `✓ Deleted ${renterBookings.affected || 0} bookings where user is renter`,
      );

      // Delete bookings for user's tools (as owner)
      for (const tool of userTools) {
        const ownerBookings = await this.bookingRepository.delete({
          toolId: tool.id,
        });
        console.log(
          `✓ Deleted ${ownerBookings.affected || 0} bookings for tool ${tool.id}`,
        );
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
      console.log(
        `✓ Deleted ${emailsAsUser.affected || 0} emails where user is sender`,
      );

      const emailsAsAdmin = await this.emailRepository.delete({
        adminId: userId,
      });
      console.log(
        `✓ Deleted ${emailsAsAdmin.affected || 0} emails where user is admin`,
      );
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
      // Try to send account deletion email (non-blocking)
      try {
        // Retrieve minimal info for email
        const userEmail = user.email;
        // Get user preference for language if available
        let language: 'fr' | 'en' | 'ar' = 'fr';
        try {
          const pref = await this.userPreferenceRepository.findOne({
            where: { userId },
          });
          if (
            pref &&
            (['fr', 'en', 'ar'] as const).includes(pref.language as any)
          ) {
            language = pref.language as any;
          }
        } catch (e) {
          // ignore preference fetch errors
        }
        // Send email without blocking the response
        this.sendGridService
          .sendAccountDeletionEmail(userEmail, language, userId)
          .then((ok) => {
            if (!ok) {
              this.logger.warn(
                `Account deletion email not sent to ${userEmail}`,
              );
            }
          })
          .catch((e) =>
            this.logger.warn(
              `Failed to send account deletion email: ${e?.message || e}`,
            ),
          );
      } catch (e) {
        this.logger.warn(`Post-deletion email flow failed: ${e?.message || e}`);
      }

      return { message: 'Account deleted successfully' };
    } catch (error) {
      console.error('Error during cascade deletion:', error);
      throw new Error(`Failed to delete user account: ${error.message}`);
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    console.log('=== DEBUG validateUser ===');
    console.log('Email recherché:', email);
    console.log(
      'Password fourni:',
      password ? '[MASQUÉ - longueur: ' + password.length + ']' : 'VIDE',
    );

    const user = await this.findByEmail(email);
    console.log('Utilisateur trouvé:', user ? 'OUI' : 'NON');

    if (user) {
      console.log('Détails utilisateur:', {
        id: user.id,
        email: user.email,
        hasPassword: !!user.password,
        passwordHash: user.password
          ? user.password.substring(0, 20) + '...'
          : 'VIDE',
        isActive: user.isActive,
        verifiedEmail: user.verifiedEmail,
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
    console.log(
      '🔍 findAllForAdmin called with filters:',
      JSON.stringify(filters, null, 2),
    );
    console.log(
      '🔍 findAllForAdmin called with pagination:',
      JSON.stringify(pagination, null, 2),
    );

    try {
      const queryBuilder = this.usersRepository.createQueryBuilder('user');
      console.log('🔍 QueryBuilder created successfully');

      // Apply filters
      if (filters.search && filters.search.trim()) {
        // Escape special characters to prevent SQL injection and errors
        const searchTerm = filters.search.trim().replace(/[%_\\]/g, '\\$&');
        console.log('🔍 Applying search filter with term:', searchTerm);
        queryBuilder.andWhere(
          '(LOWER(user.first_name) LIKE LOWER(:search) OR LOWER(user.last_name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
          { search: `%${searchTerm}%` },
        );
      }

      if (filters.status) {
        switch (filters.status) {
          case 'active':
            queryBuilder.andWhere('user.isActive = :isActive', {
              isActive: true,
            });
            break;
          case 'inactive':
            queryBuilder.andWhere('user.isActive = :isActive', {
              isActive: false,
            });
            break;
          case 'suspended':
            queryBuilder.andWhere('user.isSuspended IS NOT NULL');
            break;
        }
      }

      if (filters.verified !== undefined) {
        queryBuilder.andWhere('user.verifiedEmail = :verifiedEmail', {
          verifiedEmail: filters.verified,
        });
      }

      if (filters.isAdmin !== undefined) {
        queryBuilder.andWhere('user.isAdmin = :isAdmin', {
          isAdmin: filters.isAdmin,
        });
      }

      if (filters.city) {
        queryBuilder.andWhere('LOWER(user.city) LIKE LOWER(:city)', {
          city: `%${filters.city}%`,
        });
      }

      // Country filter: accept ISO alpha-2 (user.countryId) or full name
      if (filters.country) {
        const value = filters.country.trim();
        if (/^[A-Za-z]{2}$/.test(value)) {
          queryBuilder.andWhere('user.countryId = :countryId', {
            countryId: value.toUpperCase(),
          });
        } else {
          queryBuilder
            .leftJoin('user.country', 'country')
            .andWhere('LOWER(country.name) LIKE LOWER(:countryName)', {
              countryName: `%${value}%`,
            });
        }
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

      // Apply sorting with validation and proper column mapping
      const allowedSortFields = [
        'createdAt',
        'firstName',
        'lastName',
        'email',
        'isActive',
        'verifiedEmail',
      ];
      const sortBy =
        pagination.sortBy && allowedSortFields.includes(pagination.sortBy)
          ? pagination.sortBy
          : 'createdAt';
      const sortOrder =
        pagination.sortOrder && ['ASC', 'DESC'].includes(pagination.sortOrder)
          ? pagination.sortOrder
          : 'DESC';

      // Map frontend field names to database column names
      const columnMapping: Record<string, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        verifiedEmail: 'verified_email',
        isActive: 'is_active',
      };

      const dbColumnName = columnMapping[sortBy] || sortBy;

      console.log('🔍 Applying sort:', { sortBy, dbColumnName, sortOrder });
      queryBuilder.orderBy(`user.${dbColumnName}`, sortOrder);

      // Apply pagination
      const skip = (pagination.page - 1) * pagination.limit;
      queryBuilder.skip(skip).take(pagination.limit);

      // Log the final SQL query
      console.log('🔍 Final SQL query:', queryBuilder.getSql());
      console.log('🔍 Query parameters:', queryBuilder.getParameters());

      const [data, total] = await queryBuilder.getManyAndCount();

      console.log(
        '🔍 Query results - total:',
        total,
        'data length:',
        data.length,
      );
      if (data.length > 0) {
        console.log('🔍 First result sample:', {
          id: data[0].id,
          firstName: data[0].firstName,
          lastName: data[0].lastName,
          email: data[0].email,
        });
      }

      return {
        data,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error) {
      console.error('🚨 Error in findAllForAdmin:', error);
      console.error('🚨 Error stack:', error.stack);
      throw error;
    }
  }

  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      adminUsers,
      newUsersThisMonth,
      newUsersToday,
    ] = await Promise.all([
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

  async getUserPersonalStats(userId: string) {
    try {
      // Récupérer les outils actifs de l'utilisateur
      const activeAds = await this.toolRepository.count({
        where: {
          ownerId: userId,
          toolStatus: ToolStatus.PUBLISHED,
        },
      });

      // Récupérer les locations réalisées (bookings complétés pour les outils de l'utilisateur)
      const completedRentals = await this.bookingRepository
        .createQueryBuilder('booking')
        .innerJoin('booking.tool', 'tool')
        .where('tool.ownerId = :userId', { userId })
        .andWhere('booking.status = :status', {
          status: BookingStatus.COMPLETED,
        })
        .getCount();

      // Utiliser les données du wallet pour les gains totaux (cohérence avec le composant Wallet)
      let totalEarnings = 0;
      try {
        const walletStats = await this.walletsService.calculateStats(userId);
        totalEarnings = walletStats.cumulativeBalance;
      } catch (error) {
        console.log('Erreur lors du calcul des statistiques wallet:', error);
        // Fallback vers l'ancien calcul si le wallet n'est pas disponible
        const earningsResult = await this.bookingRepository
          .createQueryBuilder('booking')
          .innerJoin('booking.tool', 'tool')
          .select('SUM(booking.totalPrice)', 'totalEarnings')
          .where('tool.ownerId = :userId', { userId })
          .andWhere('booking.status = :status', {
            status: BookingStatus.COMPLETED,
          })
          .getRawOne();
        totalEarnings = parseFloat(earningsResult?.totalEarnings || '0');
      }

      // Calculer la note moyenne des reviews reçues pour les outils de l'utilisateur
      // Utiliser la table reviews_tools avec reviewee_id = userId
      const ratingResult = await this.reviewToolRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'averageRating')
        .where('review.reviewee_id = :userId', { userId })
        .getRawOne();

      const averageRating = parseFloat(ratingResult?.averageRating || '0');
this.logger.log(`🔄 averageRating user:  (-------------------->: ${averageRating})`);
      return {
        data: {
          totalEarnings: Math.round(totalEarnings * 100) / 100, // Arrondir à 2 décimales
          activeAds,
          completedRentals,
          averageRating: Math.round(averageRating * 100) / 100, // Arrondir à 2 décimales
        },
        message: 'User statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error retrieving user personal stats:', error);
      throw new BadRequestException('Failed to retrieve user statistics');
    }
  }

  async findOneForAdmin(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: [
        'tools',
        'tools.bookings',
        'bookingsAsRenter',
        'reviewsGiven',
        'reviewsReceived',
        'country',
        'wallet',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Calculer les statistiques
    const toolsCount = user.tools ? user.tools.length : 0;
    const reservationsCount = user.bookingsAsRenter
      ? user.bookingsAsRenter.length
      : 0;

    // Calculer le nombre de locations reçues (bookings pour les outils de l'utilisateur)
    let rentalsCount = 0;
    if (user.tools) {
      rentalsCount = user.tools.reduce((total, tool) => {
        return total + (tool.bookings ? tool.bookings.length : 0);
      }, 0);
    }

    // Calculer la note moyenne des reviews reçues
    let averageRating = 0;
    if (user.reviewsReceived && user.reviewsReceived.length > 0) {
      const totalRating = user.reviewsReceived.reduce(
        (sum, review) => sum + review.rating,
        0,
      );
      averageRating = totalRating / user.reviewsReceived.length;
    }

    // Calculer les statistiques du wallet
    let totalEarnings = 0;
    let availableBalance = 0;

    if (user.wallet) {
      // Utiliser le service wallet pour calculer les statistiques
      try {
        const walletStats = await this.walletsService.calculateStats(id);
        totalEarnings = walletStats.cumulativeBalance;
        availableBalance = walletStats.availableBalance;
      } catch (error) {
        console.log('Erreur lors du calcul des statistiques wallet:', error);
      }
    }

    // Ajouter les statistiques à l'objet user
    (user as any).toolsCount = toolsCount;
    (user as any).reservationsCount = reservationsCount;
    (user as any).rentalsCount = rentalsCount;
    (user as any).averageRating = Math.round(averageRating * 100) / 100; // Arrondir à 2 décimales
    (user as any).totalEarnings = totalEarnings;
    (user as any).availableBalance = availableBalance;

    return user;
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.findOne(id);

    this.logger.log(`🔄 Activating user: ${user.email} (currently suspended: ${user.isSuspended})`);

    // Activate the user
    user.isActive = true;
    user.isSuspended = null;
    const activatedUser = await this.usersRepository.save(user);

    this.logger.log(`✅ User activated successfully: ${user.email}`);

    // Send reactivation email
    try {
      this.logger.log(`📧 Preparing reactivation email for: ${user.email}`);
      const reactivationHtml = this.getReactivationEmailTemplate(
        user.firstName || 'Utilisateur',
      );
      this.logger.log(`📧 Reactivation HTML generated, length: ${reactivationHtml.length} characters`);
      
      const emailSent = await this.sendGridService.sendEmail({
        to: user.email,
        subject: 'Your Bricola-ltd Account Has Been Reactivated',
        html: reactivationHtml,
      });

      if (emailSent) {
        this.logger.log(
          `✅ Reactivation email sent successfully to: ${user.email}`,
        );
      } else {
        this.logger.error(
          `❌ Failed to send reactivation email to: ${user.email}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error sending reactivation email to: ${user.email}`,
        error,
      );
      // Don't throw error to avoid rolling back user activation
    }

    return activatedUser;
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async suspendUser(id: string, reason: string): Promise<User> {
    const user = await this.findOne(id);
    user.isSuspended = reason;
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async suspendUserWithEmail(id: string, reason: string): Promise<User> {
    const user = await this.findOne(id);

    // Debug logging
    this.logger.log(`Suspending user ${user.email} with reason: "${reason}"`);

    // Suspend the user
    user.isSuspended = reason;
    user.isActive = false;
    const suspendedUser = await this.usersRepository.save(user);

    // Get email template based on reason
    const emailTemplate = this.getEmailTemplateForReason(reason, {
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Debug logging for template selection
    this.logger.log(
      `Selected email template for reason "${reason}": Subject = "${emailTemplate.subject}"`,
    );

    // Send suspension email
    try {
      this.logger.log(`Attempting to send suspension email to: ${user.email}`);
      this.logger.log(`Email subject: ${emailTemplate.subject}`);
      this.logger.log(`Email HTML length: ${emailTemplate.html.length} characters`);
      
      const emailSent = await this.sendGridService.sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });

      if (emailSent) {
        this.logger.log(`✅ Suspension email sent successfully to: ${user.email}`);
      } else {
        this.logger.error(`❌ Failed to send suspension email to: ${user.email}`);
      }
    } catch (error) {
      this.logger.error('❌ Error sending suspension email:', error);
      this.logger.error('Error details:', error.message);
      if (error.response) {
        this.logger.error('SendGrid response error:', error.response.body);
      }
      // Don't throw error to avoid rolling back user suspension
    }

    return suspendedUser;
  }

  private getEmailTemplateForReason(
    reason: string,
    user: { firstName: string; lastName: string },
  ): { subject: string; html: string } {
    // Debug logging
    this.logger.log(`Getting email template for reason: "${reason}"`);

    const templates = {
      'Fraud or Attempted Fraud': {
        subject: 'Account Suspension – Fraud or Attempted Fraud',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e74c3c; margin: 0; font-size: 24px;">🚨 Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Following the analysis of your activity on our platform, we detected fraud or an attempted fraud.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                In accordance with our Terms of Use, your account has been immediately and temporarily suspended pending further verification.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                If you believe this is an error, you may contact our support team to provide explanations or supporting documents.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      'Violation of Terms of Use': {
        subject: 'Account Suspension – Violation of Terms of Use',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e67e22; margin: 0; font-size: 24px;">⚠️ Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your account has been suspended due to a violation of our Terms of Use.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                This decision was taken following repeated instances of behaviors or actions contrary to our rules.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We invite you to review our Terms of Use available on our website and to contact us for any clarification.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      'Inappropriate Behavior': {
        subject: 'Account Suspension – Inappropriate Behavior',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e74c3c; margin: 0; font-size: 24px;">🚫 Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We have received reports of inappropriate behavior linked to your account (insults, threats, offensive remarks, etc.).
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                To maintain a safe and respectful environment for all users, we have suspended your account.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                You may request a review of your case by contacting our support team.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      'Non-Compliant or Dangerous Tool': {
        subject: 'Account Suspension – Non-Compliant or Dangerous Tool',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e74c3c; margin: 0; font-size: 24px;">⚠️ Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We have identified that a tool listed on your account does not comply with our safety standards or poses a potential danger to users.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                For the safety of our community, we have suspended your account until this issue is resolved.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Please review our tool listing guidelines and contact our support team to discuss the compliance of your tools.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      'Multiple Accounts Prohibited': {
        subject: 'Account Suspension – Multiple Accounts',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e67e22; margin: 0; font-size: 24px;">🚫 Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We have detected that you are operating multiple accounts, which violates our Terms of Service.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Each user is allowed only one account to ensure fairness and transparency on our platform.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your account has been suspended. Please contact our support team to resolve this issue.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      'Suspicion of Fraudulent Activity': {
        subject: 'Account Suspension – Suspicion of Fraud',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #f39c12; margin: 0; font-size: 24px;">🚫 Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Our security systems have detected suspicious activity on your account that may indicate fraudulent behavior.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                As a precautionary measure, we have temporarily suspended your account pending investigation.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                If you are a legitimate user, we apologize for any inconvenience. Please contact our support team to verify your identity and resolve this matter.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      "User's Voluntary Request": {
        subject: 'Account Suspension – Voluntary Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3498db; margin: 0; font-size: 24px;">✅ Account Suspension Confirmed</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We confirm that your account has been suspended as per your voluntary request.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your account will remain suspended until you contact us to request reactivation.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                All your data is securely preserved and will be available upon reactivation.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Request Reactivation</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
      'Abusive Reviews or Comments': {
        subject: 'Account Suspension – Abusive Reviews or Comments',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e74c3c; margin: 0; font-size: 24px;">🚫 Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We have identified abusive reviews or comments posted from your account that violate our community guidelines.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                To maintain a respectful environment for all users, we have suspended your account.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We encourage constructive feedback but do not tolerate abusive, defamatory, or inappropriate content.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Sincerely,<br>
                The BRICOLA-LTD Team
              </p>
            </div>
          </div>
        `,
      },
    };

    // Debug logging
    const availableTemplates = Object.keys(templates);
    this.logger.log(
      `Available templates: ${JSON.stringify(availableTemplates)}`,
    );

    const selectedTemplate = templates[reason];
    if (selectedTemplate) {
      this.logger.log(`Found matching template for reason: "${reason}"`);
      return selectedTemplate;
    } else {
      this.logger.warn(
        `No matching template found for reason: "${reason}", using default template`,
      );
      return {
        subject: 'Account Suspension',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #e74c3c; margin: 0; font-size: 24px;">🚫 Account Suspension</h1>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${user.firstName} ${user.lastName},</p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We are writing to inform you that your BRICOLA-LTD account has been suspended.
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                 Reason for suspension: ${reason}
               </p>
               
               <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                 Please contact our support team for more information about this suspension.
               </p>
               
               <div style="text-align: center; margin: 30px 0;">
                 <a href="mailto:contact@bricolaltd.com" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Contact Support</a>
               </div>
               
               <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                 Sincerely,<br>
                 The BRICOLA-LTD Team
               </p>
             </div>
           </div>
         `,
      };
    }
  }

  private getReactivationEmailTemplate(firstName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ed8021; margin: 0; font-size: 24px;">🎉 Account Reactivated</h1>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello ${firstName},</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Great news! Your BRICOLA-LTD account has been successfully reactivated.
          </p>
          
          <div style="background-color: #f0fff4; border-left: 4px solid #ed8021; padding: 15px; margin: 20px 0;">
            <p style="color: #ed8021; font-weight: bold; margin: 0;">✅ Your account is now active</p>
            <p style="color: #ed8021; margin: 5px 0 0 0;">You can once again access all our services</p>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            You can now log in and enjoy all BRICOLA-LTD services:
          </p>
          
          <ul style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px; padding-left: 20px;">
            <li>Post and browse listings</li>
            <li>Contact other users</li>
            <li>Manage your profile</li>
            <li>Access your transaction history</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.bricolaltd.com/login" style="background-color: #ed8021; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Log in now</a>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your patience and welcome back to BRICOLA-LTD!
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
            Sincerely,<br>
            The BRICOLA-LTD Team
          </p>
        </div>
      </div>
    `;
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

  async getUserActivities(
    id: string,
    limit: number = 50,
  ): Promise<UserActivity[]> {
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

    const whereConditions: any[] = [{ recipientId: id }];

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

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: whereConditions,
        relations: ['sender', 'recipient', 'wallet', 'booking'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      },
    );

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
            await this.suspendUser(userId, 'Bulk suspension');
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
    if (filters.search && filters.search.trim()) {
      // Escape special characters to prevent SQL injection and errors
      const searchTerm = filters.search.trim().replace(/[%_\\]/g, '\\$&');
      queryBuilder.andWhere(
        '(LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${searchTerm}%` },
      );
    }

    if (filters.status) {
      switch (filters.status) {
        case 'active':
          queryBuilder.andWhere('user.isActive = :isActive', {
            isActive: true,
          });
          break;
        case 'inactive':
          queryBuilder.andWhere('user.isActive = :isActive', {
            isActive: false,
          });
          break;
        case 'suspended':
          queryBuilder.andWhere('user.isSuspended IS NOT NULL');
          break;
      }
    }

    if (filters.verified !== undefined) {
      queryBuilder.andWhere('user.verifiedEmail = :verifiedEmail', {
        verifiedEmail: filters.verified,
      });
    }

    if (filters.isAdmin !== undefined) {
      queryBuilder.andWhere('user.isAdmin = :isAdmin', {
        isAdmin: filters.isAdmin,
      });
    }

    if (filters.city) {
      queryBuilder.andWhere('LOWER(user.city) LIKE LOWER(:city)', {
        city: `%${filters.city}%`,
      });
    }

    // Country filter: accept ISO alpha-2 (user.countryId) or full name
    if (filters.country) {
      const value = filters.country.trim();
      if (/^[A-Za-z]{2}$/.test(value)) {
        queryBuilder.andWhere('user.countryId = :countryId', {
          countryId: value.toUpperCase(),
        });
      } else {
        queryBuilder
          .leftJoin('user.country', 'country')
          .andWhere('LOWER(country.name) LIKE LOWER(:countryName)', {
            countryName: `%${value}%`,
          });
      }
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

  async exportUsersCSV(filters: AdminUserFilters): Promise<string> {
    const users = await this.exportUsers(filters);

    // Define CSV headers in French
    const headers = [
      'ID',
      'Email',
      'Prénom',
      'Nom',
      'Téléphone',
      'Pays',
      'Adresse',
      'Statut',
      'Date de création',
    ];

    // Convert users data to CSV rows
    const csvRows = users.map((user) => [
      user.id,
      user.email,
      user.firstName || '',
      user.lastName || '',
      user.phoneNumber || '',
      user.country?.name || '',
      user.address || '',
      user.isActive ? 'Actif' : 'Inactif',
      user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('fr-FR')
        : '',
    ]);

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSVValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSVValue).join(','),
      ...csvRows.map((row) => row.map(escapeCSVValue).join(',')),
    ].join('\n');

    return csvContent;
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

  async validateAccountDeletion(
    userId: string,
    currentUser: any,
  ): Promise<any> {
    // Check if user can only validate their own account (unless admin)
    if (currentUser.id !== userId && !currentUser.isAdmin) {
      throw new ForbiddenException(
        'You can only validate your own account deletion',
      );
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
        unreturnedTools: 0,
      },
      details: {
        pendingBookings: [] as any[],
        confirmedReservations: [] as any[],
        ongoingDisputes: [] as any[],
        unreturnedTools: [] as any[],
      },
    };

    try {
      const ts = new Date().toISOString();
      this.logger.log(
        `[DELETION_VALIDATION] ts=${ts} user=${userId} msg=Starting validation`,
      );
      // Normalize/legacy booking statuses to check
      const bookingStatuses = ['PENDING', 'ACCEPTED', 'ONGOING', 'CONFIRMED']; // include legacy 'CONFIRMED'
      this.logger.log(
        `[DELETION_VALIDATION] ts=${ts} user=${userId} bookingStatuses=${JSON.stringify(bookingStatuses)}`,
      );

      // Check for pending/accepted/ongoing bookings as renter (use relation id for reliability)
      const renterBookings = await this.bookingRepository.find({
        where: { renter: { id: userId }, status: In(bookingStatuses) },
        relations: ['tool'],
      });
      this.logger.log(
        `[DELETION_VALIDATION] ts=${ts} user=${userId} renterBookings.count=${renterBookings.length}`,
      );
      if (renterBookings.length > 0) {
        validationResult.blockingIssues.pendingBookings = renterBookings.length;
        validationResult.details.pendingBookings = renterBookings;
        this.logger.log(
          `[DELETION_VALIDATION] ts=${ts} user=${userId} pendingBookings.set=${renterBookings.length}`,
        );
        validationResult.canDelete = false;
      }

      // Check for reservations for user's tools as owner (use relation id for reliability)
      const toolsOwned = await this.toolRepository.find({
        where: { owner: { id: userId } },
      });
      const toolIds = toolsOwned.map((t) => t.id);
      this.logger.log(
        `[DELETION_VALIDATION] ts=${ts} user=${userId} toolsOwned.count=${toolIds.length}`,
      );
      if (toolIds.length > 0) {
        const ownerReservations = await this.bookingRepository.find({
          where: { tool: { id: In(toolIds) }, status: In(bookingStatuses) },
          relations: ['renter', 'tool'],
        });
        this.logger.log(
          `[DELETION_VALIDATION] ts=${ts} user=${userId} ownerReservations.count=${ownerReservations.length}`,
        );
        if (ownerReservations.length > 0) {
          validationResult.blockingIssues.confirmedReservations =
            ownerReservations.length;
          validationResult.details.confirmedReservations = ownerReservations;
          this.logger.log(
            `[DELETION_VALIDATION] ts=${ts} user=${userId} confirmedReservations.set=${ownerReservations.length}`,
          );
          validationResult.canDelete = false;
        }
      }

      // Check for ongoing disputes where user is initiator or respondent
      try {
        const ongoingDisputes = await this.disputeRepository.count({
          where: [
            { initiator: { id: userId }, status: DisputeStatus.PENDING },
            { respondent: { id: userId }, status: DisputeStatus.PENDING },
          ],
        });
        validationResult.blockingIssues.ongoingDisputes = ongoingDisputes;
        this.logger.log(
          `[DELETION_VALIDATION] ts=${ts} user=${userId} ongoingDisputes.count=${ongoingDisputes}`,
        );

        if (ongoingDisputes > 0) {
          validationResult.canDelete = false;
          this.logger.warn(
            `[DELETION_VALIDATION] ts=${ts} user=${userId} msg=Has ongoing disputes count=${ongoingDisputes}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[DELETION_VALIDATION] ts=${ts} user=${userId} msg=Error checking ongoing disputes err=${error?.message || error}`,
        );
        validationResult.blockingIssues.ongoingDisputes = 0;
      }

      // Check for unreturned tools (bookings where user is renter and hasn't returned tool)
      try {
        const unreturnedTools = await this.bookingRepository.count({
          where: {
            renter: { id: userId },
            status: BookingStatus.ONGOING,
            renterHasReturned: false,
          },
        });
        validationResult.blockingIssues.unreturnedTools = unreturnedTools;

        if (unreturnedTools > 0) {
          validationResult.canDelete = false;
          this.logger.warn(
            `[DELETION_VALIDATION] ts=${ts} user=${userId} msg=Has unreturned tools count=${unreturnedTools}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[DELETION_VALIDATION] ts=${ts} user=${userId} msg=Error checking unreturned tools err=${error?.message || error}`,
        );
        validationResult.blockingIssues.unreturnedTools = 0;
      }
    } catch (error) {
      const tsErr = new Date().toISOString();
      this.logger.error(
        `[DELETION_VALIDATION] ts=${tsErr} user=${userId} msg=Error validating account deletion err=${error?.message || error}`,
      );
      // In case of error, be conservative and don't allow deletion
      validationResult.canDelete = false;
    }

    // Log final validation result before returning
    const tsFinal = new Date().toISOString();
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.canDelete=${validationResult.canDelete}`,
    );
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.blockingIssues=${JSON.stringify(validationResult.blockingIssues)}`,
    );
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.details.pendingBookings=${validationResult.details.pendingBookings.length}`,
    );
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.details.confirmedReservations=${validationResult.details.confirmedReservations.length}`,
    );
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.details.ongoingDisputes=${validationResult.details.ongoingDisputes.length}`,
    );
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.details.unreturnedTools=${validationResult.details.unreturnedTools.length}`,
    );
    this.logger.log(
      `[DELETION_VALIDATION] ts=${tsFinal} user=${userId} final.validationResult=${JSON.stringify(validationResult)}`,
    );

    return validationResult;
  }
}
