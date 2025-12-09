import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  Refund,
  RefundStatus,
  RefundReason,
} from '../refunds/entities/refund.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import * as bcrypt from 'bcrypt';

export async function seedRefundsData(dataSource: DataSource) {
  console.log('🔄 Seeding refund test data...');

  const userRepository = dataSource.getRepository(User);
  const toolRepository = dataSource.getRepository(Tool);
  const bookingRepository = dataSource.getRepository(Booking);
  const transactionRepository = dataSource.getRepository(Transaction);
  const refundRepository = dataSource.getRepository(Refund);
  const walletRepository = dataSource.getRepository(Wallet);

  // 1. Create or Get Test Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Renter
  let renter = await userRepository.findOne({
    where: { email: 'renter@test.com' },
  });
  if (!renter) {
    renter = userRepository.create({
      email: 'renter@test.com',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Dupont',
      phoneNumber: '+33612345678',
      verifiedEmail: true,
      countryId: '1', // Assuming ID 1 exists (France)
    });
    renter = await userRepository.save(renter);
    await walletRepository.save(
      walletRepository.create({ userId: renter.id, balance: 1000 }),
    );
  }

  // Owner
  let owner = await userRepository.findOne({
    where: { email: 'owner@test.com' },
  });
  if (!owner) {
    owner = userRepository.create({
      email: 'owner@test.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Martin',
      phoneNumber: '+33687654321',
      verifiedEmail: true,
      countryId: '1',
    });
    owner = await userRepository.save(owner);
    await walletRepository.save(
      walletRepository.create({ userId: owner.id, balance: 500 }),
    );
  }

  // 2. Create Tool
  let tool = await toolRepository.findOne({
    where: { title: 'Perceuse Test Refund' },
  });
  if (!tool) {
    const newTool = toolRepository.create({
      title: 'Perceuse Test Refund',
      description: 'Une perceuse pour tester les remboursements',
      pricePerDay: 20,
      ownerId: owner.id,
      categoryId: '2b908d69-5dcc-4447-98f6-38a4b4953d01',
      subcategoryId: '008d604f-4275-484b-9763-89a5d2f2bfc8',
      status: 'published',
    } as any); // cast to any to avoid strict type checks for now if types are complex

    // Save returns the entity, not an array when passed a single entity
    const saved = await toolRepository.save(newTool);
    tool = Array.isArray(saved) ? saved[0] : saved;
  }

  if (!tool) {
    console.error('Failed to create or find tool');
    return;
  }

  // 3. Create Refund Scenarios
  const scenarios = [
    {
      status: RefundStatus.PENDING,
      reason: RefundReason.CUSTOMER_REQUEST,
      amount: 20,
      bookingStatus: BookingStatus.COMPLETED,
      desc: 'Pending refund request',
    },
    {
      status: RefundStatus.PROCESSING,
      reason: RefundReason.TOOL_UNAVAILABLE,
      amount: 40,
      bookingStatus: BookingStatus.CANCELLED,
      desc: 'Processing refund',
    },
    {
      status: RefundStatus.CONFIRMED,
      reason: RefundReason.SERVICE_ISSUE,
      amount: 15,
      bookingStatus: BookingStatus.COMPLETED,
      desc: 'Confirmed refund waiting for payment',
    },
    {
      status: RefundStatus.COMPLETED,
      reason: RefundReason.BOOKING_CANCELLATION,
      amount: 60,
      bookingStatus: BookingStatus.CANCELLED,
      desc: 'Completed refund',
    },
    {
      status: RefundStatus.FAILED,
      reason: RefundReason.OTHER,
      amount: 10,
      bookingStatus: BookingStatus.COMPLETED,
      desc: 'Failed refund to retry',
      failureReason: 'Stripe API Error: Card expired',
    },
    {
      status: RefundStatus.REJECTED,
      reason: RefundReason.FRAUD,
      amount: 100,
      bookingStatus: BookingStatus.COMPLETED,
      desc: 'Rejected refund request',
    },
  ];

  for (const scenario of scenarios) {
    // Create Booking
    const booking = bookingRepository.create({
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000), // +1 day
      pickupHour: new Date(),
      totalPrice: 100, // Original price
      status: scenario.bookingStatus,
      toolId: tool.id,
      renterId: renter.id,
      ownerId: owner.id,
      paymentStatus: 'captured',
      paymentIntentId: `pi_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    });
    const savedBooking = await bookingRepository.save(booking);

    // Create Transaction
    const ownerWallet = await walletRepository.findOne({
      where: { userId: owner.id },
    });
    const transaction = transactionRepository.create({
      amount: 100,
      type: TransactionType.PAYMENT,
      status: TransactionStatus.COMPLETED,
      description: `Payment for booking ${savedBooking.id}`,
      senderId: renter.id,
      recipientId: owner.id,
      walletId: ownerWallet?.id,
      bookingId: savedBooking.id,
      externalReference: booking.paymentIntentId,
      paymentProvider: 'STRIPE',
      paymentMethod: 'CARD' as any,
    });
    const savedTransaction = await transactionRepository.save(transaction);

    // Create Refund
    const refund = refundRepository.create({
      refundId: `ref_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      transactionId: savedTransaction.id,
      bookingId: savedBooking.id,
      originalAmount: 100,
      refundAmount: scenario.amount,
      currency: 'gbp',
      status: scenario.status,
      reason: scenario.reason,
      reasonDetails: scenario.desc,
      failureReason: scenario.failureReason,
      createdAt: new Date(),
    });
    await refundRepository.save(refund);

    console.log(`✓ Created refund: ${scenario.status} - ${scenario.desc}`);
  }

  console.log('✅ Refund test data seeded successfully');
}
