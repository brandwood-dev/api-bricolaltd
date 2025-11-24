import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { PaymentProvider } from '../transactions/entities/payment-provider.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentMethod } from '../transactions/enums/payment-method.enum';

export async function seedPaymentTransactions(dataSource: DataSource) {
  console.log('💰 Seeding payment transactions...');

  const paymentTransactionRepository =
    dataSource.getRepository(PaymentTransaction);
  const paymentProviderRepository = dataSource.getRepository(PaymentProvider);
  const transactionRepository = dataSource.getRepository(Transaction);

  const providers = await paymentProviderRepository.find();
  const transactions = await transactionRepository.find({ take: 100 });

  if (providers.length === 0 || transactions.length === 0) {
    console.log(
      '⚠️ No providers or transactions found, skipping payment transactions seeding',
    );
    return;
  }

  const paymentMethods = Object.values(PaymentMethod);
  const statuses = ['completed', 'pending', 'failed', 'cancelled'];
  const currencies = ['EUR', 'USD', 'GBP'];

  // Generate 80 realistic payment transactions
  for (let i = 0; i < Math.min(80, transactions.length); i++) {
    const transaction = transactions[i];
    const provider = faker.helpers.arrayElement(providers);
    const paymentMethod = faker.helpers.arrayElement(paymentMethods);
    const status = faker.helpers.arrayElement(statuses);
    const currency = faker.helpers.arrayElement(currencies);

    // Generate provider-specific transaction IDs
    let providerTransactionId: string;
    let providerStatus: string;

    switch (paymentMethod) {
      case PaymentMethod.CARD:
        providerTransactionId = `pi_${faker.string.alphanumeric(16)}`;
        providerStatus =
          status === 'completed'
            ? 'succeeded'
            : status === 'pending'
              ? 'processing'
              : 'failed';
        break;
      case PaymentMethod.PAYPAL:
        providerTransactionId = `PAYID-${faker.string.alphanumeric(10).toUpperCase()}`;
        providerStatus =
          status === 'completed'
            ? 'COMPLETED'
            : status === 'pending'
              ? 'PENDING'
              : 'FAILED';
        break;
      case PaymentMethod.BANK_TRANSFER:
        providerTransactionId = `TXN-${faker.string.alphanumeric(12).toUpperCase()}`;
        providerStatus = status;
        break;
      default:
        providerTransactionId = faker.string.alphanumeric(16);
        providerStatus = status;
    }

    const paymentTransaction = paymentTransactionRepository.create({
      amount: faker.number.float({ min: 10, max: 500, fractionDigits: 2 }),
      currency,
      status,
      paymentMethod,
      providerTransactionId,
      providerStatus,
      processedAt:
        status === 'completed' ? faker.date.recent({ days: 30 }) : undefined,
      transaction,
      transactionId: transaction.id,
      provider,
      providerId: provider.id,
    });

    await paymentTransactionRepository.save(paymentTransaction);
  }

  console.log('✅ Payment transactions seeded successfully');
}
