import { DataSource } from 'typeorm';
import { PaymentProvider } from '../transactions/entities/payment-provider.entity';
import { PaymentMethod } from '../transactions/enums/payment-method.enum';

export async function seedPaymentProviders(dataSource: DataSource) {
  console.log('💳 Seeding payment providers...');

  const paymentProviderRepository = dataSource.getRepository(PaymentProvider);

  const providersData = [
    {
      name: 'stripe',
      displayName: 'Stripe',
      description: 'Secure online payment processing',
      isActive: true,
      supportedMethods: [PaymentMethod.CARD, PaymentMethod.STRIPE],
      logoUrl: 'https://stripe.com/img/v3/home/social.png',
      config: {
        currency: 'EUR',
        feePercentage: 2.9,
        fixedFee: 0.3,
      },
    },
    {
      name: 'paypal',
      displayName: 'PayPal',
      description: 'Global digital payment platform',
      isActive: true,
      supportedMethods: [PaymentMethod.PAYPAL],
      logoUrl:
        'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
      config: {
        currency: 'EUR',
        feePercentage: 3.4,
        fixedFee: 0.35,
      },
    },
    {
      name: 'bank_transfer',
      displayName: 'Bank Transfer',
      description: 'Direct bank transfer payments',
      isActive: true,
      supportedMethods: [PaymentMethod.BANK_TRANSFER],
      config: {
        currency: 'EUR',
        processingDays: 3,
      },
    },
  ];

  for (const providerData of providersData) {
    const existingProvider = await paymentProviderRepository.findOne({
      where: { name: providerData.name },
    });

    if (!existingProvider) {
      const provider = paymentProviderRepository.create(providerData);
      await paymentProviderRepository.save(provider);
    }
  }

  console.log('✅ Payment providers seeded successfully');
}
