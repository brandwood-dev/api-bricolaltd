import { DataSource } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { PaymentMethod } from '../transactions/enums/payment-method.enum';
import { faker } from '@faker-js/faker';

export async function seedTransactions(dataSource: DataSource) {
  console.log('💰 Seeding transactions...');

  const transactionRepository = dataSource.getRepository(Transaction);
  const userRepository = dataSource.getRepository(User);
  const walletRepository = dataSource.getRepository(Wallet);
  const bookingRepository = dataSource.getRepository(Booking);

  const users = await userRepository.find({ where: { isAdmin: false } });
  const wallets = await walletRepository.find();
  const bookings = await bookingRepository.find();

  if (users.length < 2 || wallets.length === 0) {
    console.log(
      '⚠️ Insufficient users or wallets found, skipping transactions seeding',
    );
    return;
  }

  const transactionsData: any[] = [];

  for (let i = 0; i < 100; i++) {
    const type = faker.helpers.weightedArrayElement([
      { weight: 40, value: TransactionType.PAYMENT },
      { weight: 25, value: TransactionType.DEPOSIT },
      { weight: 15, value: TransactionType.WITHDRAWAL },
      { weight: 10, value: TransactionType.REFUND },
      { weight: 5, value: TransactionType.DISPUTE },
    ]);

    const status = faker.helpers.weightedArrayElement([
      { weight: 70, value: TransactionStatus.COMPLETED },
      { weight: 15, value: TransactionStatus.PENDING },
      { weight: 10, value: TransactionStatus.CONFIRMED },
      { weight: 5, value: TransactionStatus.FAILED },
    ]);

    const paymentMethod = faker.helpers.arrayElement(
      Object.values(PaymentMethod),
    );

    let amount: number;
    let description: string;
    let feeAmount: number;

    switch (type) {
      case TransactionType.PAYMENT:
        amount = faker.number.float({ min: 10, max: 200, fractionDigits: 2 });
        description = faker.helpers.arrayElement([
          'Paiement pour location de perceuse',
          'Paiement pour location de tondeuse',
          'Paiement pour location de scie',
          "Paiement pour location d'échelle",
          "Paiement pour location d'aspirateur",
          'Paiement pour location de ponceuse',
          'Paiement pour location de taille-haie',
        ]);
        feeAmount = parseFloat((amount * 0.05).toFixed(2)); // 5% fee
        break;

      case TransactionType.DEPOSIT:
        amount = faker.number.float({ min: 20, max: 500, fractionDigits: 2 });
        description = 'Dépôt sur le portefeuille';
        feeAmount = 0;
        break;

      case TransactionType.WITHDRAWAL:
        amount = faker.number.float({ min: 10, max: 300, fractionDigits: 2 });
        description = 'Retrait du portefeuille';
        feeAmount = parseFloat((amount * 0.02).toFixed(2)); // 2% fee
        break;

      case TransactionType.REFUND:
        amount = faker.number.float({ min: 5, max: 150, fractionDigits: 2 });
        description = faker.helpers.arrayElement([
          'Remboursement annulation',
          'Remboursement partiel',
          'Remboursement complet',
          'Remboursement dommages',
        ]);
        feeAmount = 0;
        break;

      case TransactionType.DISPUTE:
        amount = faker.number.float({ min: 1, max: 20, fractionDigits: 2 });
        description = faker.helpers.arrayElement([
          'Frais de litige',
          'Frais de résolution',
          'Frais de traitement',
        ]);
        feeAmount = 0;
        break;

      default:
        amount = faker.number.float({ min: 10, max: 100, fractionDigits: 2 });
        description = 'Transaction générique';
        feeAmount = 0;
    }

    const transaction = {
      amount,
      type,
      status,
      paymentMethod,
      description,
      feeAmount,
      createdAt: faker.date.between({
        from: new Date('2024-01-01'),
        to: new Date(),
      }),
    };

    transactionsData.push(transaction);
  }

  for (let i = 0; i < transactionsData.length; i++) {
    const transactionData = transactionsData[i];
    const sender = users[i % users.length];
    const recipient = users[(i + 1) % users.length];
    const wallet = wallets.find((w) => w.userId === sender.id) || wallets[0];
    const booking = bookings[i % bookings.length];

    const transaction = transactionRepository.create({
      ...transactionData,
      sender,
      senderId: sender.id,
      recipient,
      recipientId: recipient.id,
      wallet,
      walletId: wallet.id,
      booking: i < bookings.length ? booking : undefined,
      bookingId: i < bookings.length ? booking.id : undefined,
      processedAt:
        transactionData.status === TransactionStatus.COMPLETED
          ? new Date()
          : undefined,
    });

    await transactionRepository.save(transaction);
  }

  console.log('✅ Transactions seeded successfully');
}
