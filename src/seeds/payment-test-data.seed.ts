import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Category } from '../categories/entities/category.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { PaymentMethod } from '../transactions/enums/payment-method.enum';
import { ToolCondition } from '../tools/enums/tool-condition.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import * as bcrypt from 'bcrypt';

export interface TestUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'owner' | 'admin';
  balance: number;
  stripeCustomerId?: string;
  stripeAccountId?: string;
}

export interface TestTransactionData {
  amount: number;
  currency: string;
  status: TransactionStatus;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  externalReference?: string;
  metadata?: Record<string, any>;
}

export interface TestBookingData {
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  depositAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

@Injectable()
export class PaymentTestDataSeeder {
  private readonly logger = new Logger(PaymentTestDataSeeder.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  /**
   * Create comprehensive test data for payment testing
   */
  async createPaymentTestData(): Promise<{
    users: User[];
    transactions: Transaction[];
    bookings: Booking[];
    wallets: Wallet[];
  }> {
    this.logger.log('🌱 Creating payment test data...');

    try {
      // Create test users
      const testUsers = await this.createTestUsers();

      // Create test tools and categories
      const testTools = await this.createTestTools(testUsers);

      // Create test bookings
      const testBookings = await this.createTestBookings(testUsers, testTools);

      // Create test transactions
      const testTransactions = await this.createTestTransactions(
        testUsers,
        testBookings,
      );

      // Create test wallets
      const testWallets = await this.createTestWallets(
        testUsers,
        testTransactions,
      );

      this.logger.log('✅ Payment test data created successfully');

      return {
        users: testUsers,
        transactions: testTransactions,
        bookings: testBookings,
        wallets: testWallets,
      };
    } catch (error) {
      this.logger.error('❌ Failed to create payment test data:', error);
      throw error;
    }
  }

  /**
   * Create test users with different roles and configurations
   */
  private async createTestUsers(): Promise<User[]> {
    const testUserConfigs: TestUserData[] = [
      // Admin user
      {
        email: 'admin@bricola.fr',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'Bricola',
        role: 'admin',
        balance: 10000,
        stripeCustomerId: 'cus_test_admin',
      },
      // Regular users
      {
        email: 'test.user@example.com',
        password: 'TestUser123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        balance: 500,
        stripeCustomerId: 'cus_test_user1',
      },
      {
        email: 'test.user2@example.com',
        password: 'TestUser456!',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'user',
        balance: 750,
        stripeCustomerId: 'cus_test_user2',
      },
      // Tool owners
      {
        email: 'tool.owner@example.com',
        password: 'Owner123!',
        firstName: 'Bob',
        lastName: 'Builder',
        role: 'owner',
        balance: 2000,
        stripeCustomerId: 'cus_test_owner1',
        stripeAccountId: 'acct_test_owner1',
      },
      {
        email: 'tool.owner2@example.com',
        password: 'Owner456!',
        firstName: 'Alice',
        lastName: 'Craftsman',
        role: 'owner',
        balance: 3500,
        stripeCustomerId: 'cus_test_owner2',
        stripeAccountId: 'acct_test_owner2',
      },
      // Test users for specific scenarios
      {
        email: 'high.roller@example.com',
        password: 'HighRoller789!',
        firstName: 'Rich',
        lastName: 'Spender',
        role: 'user',
        balance: 10000,
        stripeCustomerId: 'cus_test_high_roller',
      },
      {
        email: 'budget.user@example.com',
        password: 'Budget123!',
        firstName: 'Frugal',
        lastName: 'Buyer',
        role: 'user',
        balance: 50,
        stripeCustomerId: 'cus_test_budget',
      },
    ];

    const users: User[] = [];

    for (const config of testUserConfigs) {
      const hashedPassword = await bcrypt.hash(config.password, 10);

      const user = this.userRepository.create({
        email: config.email,
        password: hashedPassword,
        firstName: config.firstName,
        lastName: config.lastName,
        isAdmin: config.role === 'admin',
        isVerified: true,
        phoneNumber: '+33612345678',
        address: '123 Test Street, Test City, 12345',
        city: 'Paris',
        postalCode: '75001',
        countryId: 'FR',
      });

      const savedUser = await this.userRepository.save(user);
      users.push(savedUser);
    }

    this.logger.log(`✅ Created ${users.length} test users`);
    return users;
  }

  /**
   * Create test tools and categories
   */
  private async createTestTools(users: User[]): Promise<Tool[]> {
    const categories = [
      {
        name: 'Power Tools',
        description: 'Electric and battery-powered tools',
      },
      { name: 'Hand Tools', description: 'Manual tools and equipment' },
      {
        name: 'Garden Tools',
        description: 'Tools for gardening and landscaping',
      },
      {
        name: 'Construction',
        description: 'Heavy-duty construction equipment',
      },
    ];

    const createdCategories: Category[] = [];
    for (const catData of categories) {
      const category = this.categoryRepository.create(catData);
      const savedCategory = await this.categoryRepository.save(category);
      createdCategories.push(savedCategory);
    }

    const toolOwners = users.filter((user) => !user.isAdmin);
    const tools = [
      {
        title: 'Premium Drill Set',
        description: 'Professional 18V cordless drill with accessories',
        category: createdCategories[0],
        owner: toolOwners[0],
        pricePerDay: 25,
        depositAmount: 100,
        isAvailable: true,
        location: 'Paris, 75001',
        condition: ToolCondition.LIKE_NEW,
        images: ['drill1.jpg', 'drill2.jpg'],
      },
      {
        title: 'Garden Lawn Mower',
        description: 'Electric lawn mower with grass collection',
        category: createdCategories[2],
        owner: toolOwners[0],
        pricePerDay: 35,
        depositAmount: 150,
        isAvailable: true,
        location: 'Paris, 75002',
        condition: ToolCondition.GOOD,
        images: ['mower1.jpg'],
      },
      {
        title: 'Hammer Drill',
        description: 'Heavy-duty hammer drill for concrete',
        category: createdCategories[0],
        owner: toolOwners[1],
        pricePerDay: 40,
        depositAmount: 200,
        isAvailable: true,
        location: 'Lyon, 69001',
        condition: ToolCondition.LIKE_NEW,
        images: ['hammer_drill1.jpg'],
      },
      {
        title: 'Tool Set Complete',
        description: 'Complete hand tool set in case',
        category: createdCategories[1],
        owner: toolOwners[1],
        pricePerDay: 20,
        depositAmount: 80,
        isAvailable: true,
        location: 'Lyon, 69002',
        condition: ToolCondition.GOOD,
        images: ['tool_set1.jpg'],
      },
    ];

    const createdTools: Tool[] = [];
    for (const toolData of tools) {
      const tool = this.toolRepository.create(toolData);

      const savedTool = await this.toolRepository.save(tool);
      createdTools.push(savedTool);
    }

    this.logger.log(`✅ Created ${createdTools.length} test tools`);
    return createdTools;
  }

  /**
   * Create test bookings with different statuses
   */
  private async createTestBookings(
    users: User[],
    tools: Tool[],
  ): Promise<Booking[]> {
    const regularUsers = users.filter((user) => !user.isAdmin);
    const bookings: Booking[] = [];

    const bookingConfigs = [
      // Confirmed booking with payment
      {
        renter: regularUsers[0],
        tool: tools[0],
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 3 days rental
        totalPrice: 75, // 3 days * £25
        depositAmount: 100,
        paymentStatus: 'paid',
        status: BookingStatus.ACCEPTED,
      },
      // Pending booking
      {
        renter: regularUsers[1],
        tool: tools[1],
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
        totalPrice: 70, // 2 days * £35
        depositAmount: 150,
        paymentStatus: 'pending',
        status: BookingStatus.PENDING,
      },
      // Completed booking
      {
        renter: regularUsers[0],
        tool: tools[2],
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // completed
        totalPrice: 120, // 3 days * £40
        depositAmount: 200,
        paymentStatus: 'paid',
        status: BookingStatus.COMPLETED,
      },
      // Cancelled booking with refund
      {
        renter: regularUsers[1],
        tool: tools[3],
        startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
        totalPrice: 40, // 2 days * £20
        depositAmount: 80,
        paymentStatus: 'refunded',
        status: BookingStatus.CANCELLED,
      },
    ];

    for (const config of bookingConfigs) {
      const booking = this.bookingRepository.create(config);

      const savedBooking = await this.bookingRepository.save(booking);
      bookings.push(savedBooking);
    }

    this.logger.log(`✅ Created ${bookings.length} test bookings`);
    return bookings;
  }

  /**
   * Create test transactions with different statuses and types
   */
  private async createTestTransactions(
    users: User[],
    bookings: Booking[],
  ): Promise<Transaction[]> {
    const transactions: Transaction[] = [];

    const transactionConfigs: TestTransactionData[] = [
      // Successful payment
      {
        amount: 75,
        currency: 'gbp',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.PAYMENT,
        paymentMethod: PaymentMethod.CARD,
        externalReference: 'pi_test_success_001',
        metadata: {
          paymentIntentId: 'pi_test_success_001',
          last4: '4242',
          brand: 'visa',
          country: 'FR',
        },
      },
      // Pending payment
      {
        amount: 70,
        currency: 'gbp',
        status: TransactionStatus.PENDING,
        type: TransactionType.PAYMENT,
        paymentMethod: PaymentMethod.CARD,
        externalReference: 'pi_test_pending_001',
        metadata: {
          paymentIntentId: 'pi_test_pending_001',
          googlePayToken: 'gp_test_001',
        },
      },
      // Failed payment
      {
        amount: 120,
        currency: 'gbp',
        status: TransactionStatus.FAILED,
        type: TransactionType.PAYMENT,
        paymentMethod: PaymentMethod.CARD,
        externalReference: 'pi_test_failed_001',
        metadata: {
          paymentIntentId: 'pi_test_failed_001',
          errorCode: 'card_declined',
          declineCode: 'insufficient_funds',
        },
      },
      // Refund transaction
      {
        amount: -40,
        currency: 'gbp',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.REFUND,
        paymentMethod: PaymentMethod.CARD,
        externalReference: 're_test_refund_001',
        metadata: {
          refundReason: 'booking_cancelled',
          originalTransactionId: 'txn_original_001',
          refundId: 're_test_refund_001',
        },
      },
      // Withdrawal transaction
      {
        amount: 200,
        currency: 'gbp',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.WITHDRAWAL,
        paymentMethod: PaymentMethod.STRIPE,
        externalReference: 'tr_test_withdrawal_001',
        metadata: {
          withdrawalMethod: 'stripe_connect',
          stripeAccountId: 'acct_test_owner1',
          transferId: 'tr_test_withdrawal_001',
        },
      },
      // Deposit transaction
      {
        amount: 100,
        currency: 'gbp',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.DEPOSIT,
        paymentMethod: PaymentMethod.CARD,
        externalReference: 'pi_test_deposit_001',
        metadata: {
          depositType: 'tool_rental',
          bookingId: 'booking_001',
          paymentIntentId: 'pi_test_deposit_001',
        },
      },
    ];

    for (let i = 0; i < transactionConfigs.length && i < bookings.length; i++) {
      const config = transactionConfigs[i];
      const booking = bookings[i];
      const sender = users.find((u) => u.id === booking.renter.id);
      const recipient = users.find((u) => u.id === booking.tool.owner.id);

      const transaction = this.transactionRepository.create({
        ...config,
        sender,
        recipient,
        booking,
        description: this.generateTransactionDescription(config.type, booking),
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ), // Random date within last 30 days
      });

      const savedTransaction =
        await this.transactionRepository.save(transaction);
      transactions.push(savedTransaction);
    }

    this.logger.log(`✅ Created ${transactions.length} test transactions`);
    return transactions;
  }

  /**
   * Create test wallets with balances and transaction history
   */
  private async createTestWallets(
    users: User[],
    transactions: Transaction[],
  ): Promise<Wallet[]> {
    const wallets: Wallet[] = [];

    for (const user of users) {
      const userTransactions = transactions.filter(
        (t) => t.sender.id === user.id || t.recipient.id === user.id,
      );

      // Calculate balance from transactions
      const balance = userTransactions.reduce((total, transaction) => {
        if (transaction.sender.id === user.id) {
          return total - transaction.amount;
        } else {
          return total + transaction.amount;
        }
      }, 0);

      const wallet = this.walletRepository.create({
        user,
        balance: Math.max(0, balance), // Ensure non-negative balance
        isActive: true,
        pendingBalance: 0,
        reservedBalance: 0,
      });

      const savedWallet = await this.walletRepository.save(wallet);
      wallets.push(savedWallet);
    }

    this.logger.log(`✅ Created ${wallets.length} test wallets`);
    return wallets;
  }

  /**
   * Generate transaction description based on type and booking
   */
  private generateTransactionDescription(
    type: TransactionType,
    booking: Booking,
  ): string {
    switch (type) {
      case TransactionType.PAYMENT:
        return `Payment for ${booking.tool.title} rental`;
      case TransactionType.REFUND:
        return `Refund for cancelled booking of ${booking.tool.title}`;
      case TransactionType.WITHDRAWAL:
        return `Withdrawal to bank account`;
      case TransactionType.DEPOSIT:
        return `Deposit for ${booking.tool.title} rental`;
      default:
        return `Transaction for ${booking.tool.title}`;
    }
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(): Promise<void> {
    this.logger.log('🧹 Cleaning up payment test data...');

    try {
      // Delete in reverse order to respect foreign key constraints
      await this.transactionRepository.delete({
        description: Like('%test%'),
      });

      await this.bookingRepository.delete({
        tool: { title: Like('%test%') },
      });

      await this.toolRepository.delete({
        title: Like('%test%'),
      });

      await this.categoryRepository.delete({
        name: Like('%test%'),
      });

      await this.walletRepository.delete({
        user: { email: Like('%test%') },
      });

      await this.userRepository.delete({
        email: Like('%test%'),
      });

      this.logger.log('✅ Payment test data cleaned up successfully');
    } catch (error) {
      this.logger.error('❌ Failed to cleanup payment test data:', error);
      throw error;
    }
  }
}
