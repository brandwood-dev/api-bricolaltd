import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Category } from '../categories/entities/category.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Review } from '../reviews/entities/review.entity';
import { Bookmark } from '../bookmarks/entities/bookmark.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { Country } from '../users/entities/country.entity';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { ToolCondition } from '../tools/enums/tool-condition.enum';
import * as bcrypt from 'bcrypt';

export async function seedTestUser(dataSource: DataSource) {
  console.log('👤 Starting test user seeding...');
  
  try {
    const userRepository = dataSource.getRepository(User);
    const walletRepository = dataSource.getRepository(Wallet);
    const toolRepository = dataSource.getRepository(Tool);
    const categoryRepository = dataSource.getRepository(Category);
    const transactionRepository = dataSource.getRepository(Transaction);
    const bookingRepository = dataSource.getRepository(Booking);
    const reviewRepository = dataSource.getRepository(Review);
    const bookmarkRepository = dataSource.getRepository(Bookmark);
    const userPreferenceRepository = dataSource.getRepository(UserPreference);
    const countryRepository = dataSource.getRepository(Country);

    // Check if test user already exists
    const existingUser = await userRepository.findOne({ 
      where: { email: 'marie.dupont@example.com' } 
    });
    
    if (existingUser) {
      console.log('✅ Test user already exists');
      return existingUser;
    }

    // Get France country
    const france = await countryRepository.findOne({ where: { code: 'FR' } });
    if (!france) {
      throw new Error('France country not found. Please run countries seed first.');
    }

    // Create test user with all required attributes
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    const testUser = userRepository.create({
      email: 'marie.dupont@example.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Dupont',
      displayName: 'Marie D.',
      phoneNumber: '+33123456789',
      phonePrefix: '+33',
      address: '123 Rue de la Paix',
      city: 'Paris',
      postalCode: '75001',
      latitude: 48.8566,
      longitude: 2.3522,
      bio: 'Passionnée de bricolage et de jardinage. Je loue mes outils pour aider la communauté locale.',
      countryId: 'FR',
      isActive: true,
      verifiedEmail: true,
      isVerified: true,
      userType: 'individual',
      ratingAsOwner: 4.8,
      ratingAsRenter: 4.6,
      completedRentals: 25,
      cancelledRentals: 2
    });

    const savedUser = await userRepository.save(testUser);
    console.log('✅ Test user created:', savedUser.email);

    // Create wallet with funds
    const wallet = walletRepository.create({
      userId: savedUser.id,
      balance: 1250.75,
      isActive: true
    });
    const savedWallet = await walletRepository.save(wallet);
    console.log('💰 Wallet created with balance: €1250.75');

    // Create user preferences
    const preferences = userPreferenceRepository.create({
      userId: savedUser.id,
      language: 'fr',
      currency: 'EUR',
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false
    });
    await userPreferenceRepository.save(preferences);
    console.log('⚙️ User preferences created');

    // Get categories for tools
    const categories = await categoryRepository.find({ take: 5 });
    if (categories.length === 0) {
      throw new Error('No categories found. Please run categories seed first.');
    }

    // Create tools
    const tools = [
      {
        title: 'Perceuse Bosch Professional',
        description: 'Perceuse sans fil 18V avec 2 batteries et chargeur. Parfaite pour tous vos travaux de perçage.',
        brand: 'Bosch',
        model: 'GSR 18V-60 C',
        year: 2023,
        condition: ToolCondition.LIKE_NEW,
        pickupAddress: '1 Rue de Rivoli, 75001 Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        ownerInstructions: 'Utiliser avec précaution. Porter des lunettes de protection.',
        basePrice: 15.00,
        depositAmount: 50.00,
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500',
        categoryId: categories[0].id,
        ownerId: savedUser.id
      },
      {
        title: 'Scie Circulaire Makita',
        description: 'Scie circulaire 190mm avec guide laser. Idéale pour découpes précises.',
        brand: 'Makita',
        model: 'HS7601J',
        year: 2022,
        condition: ToolCondition.GOOD,
        pickupAddress: '1 Rue de Rivoli, 75001 Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        ownerInstructions: 'Toujours débrancher avant changement de lame.',
        basePrice: 20.00,
        depositAmount: 75.00,
        imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=500',
        categoryId: categories[1]?.id || categories[0].id,
        ownerId: savedUser.id
      },
      {
        title: 'Ponceuse Orbitale Festool',
        description: 'Ponceuse orbitale avec aspiration intégrée. Finition parfaite garantie.',
        brand: 'Festool',
        model: 'ETS 125 REQ',
        year: 2023,
        condition: ToolCondition.LIKE_NEW,
        pickupAddress: '1 Rue de Rivoli, 75001 Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        ownerInstructions: 'Vider le bac à poussière régulièrement.',
        basePrice: 12.00,
        depositAmount: 40.00,
        imageUrl: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=500',
        categoryId: categories[2]?.id || categories[0].id,
        ownerId: savedUser.id
      }
    ];

    const savedTools = await toolRepository.save(tools);
    console.log(`🔧 Created ${savedTools.length} tools`);

    // Create transactions
    const transactions = [
      {
        recipientId: savedUser.id,
        walletId: savedWallet.id,
        amount: 500.00,
        currency: 'EUR',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        description: 'Dépôt initial sur le portefeuille',
        createdAt: new Date('2024-01-15')
      },
      {
        recipientId: savedUser.id,
        walletId: savedWallet.id,
        amount: 750.75,
        currency: 'EUR',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        description: 'Rechargement du portefeuille',
        createdAt: new Date('2024-02-01')
      },
      {
        senderId: savedUser.id,
        walletId: savedWallet.id,
        amount: 45.00,
        currency: 'EUR',
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
        description: 'Paiement location perceuse (3 jours)',
        createdAt: new Date('2024-02-10')
      },
      {
        recipientId: savedUser.id,
        walletId: savedWallet.id,
        amount: 80.00,
        currency: 'EUR',
        type: TransactionType.RENTAL_INCOME,
        status: TransactionStatus.COMPLETED,
        description: 'Revenus location scie circulaire (1 semaine)',
        createdAt: new Date('2024-02-15')
      }
    ];

    const savedTransactions = await transactionRepository.save(transactions);
    console.log(`💳 Created ${savedTransactions.length} transactions`);

    // Create some bookings
    const bookings = [
      {
        toolId: savedTools[0].id,
        renterId: savedUser.id,
        ownerId: savedUser.id,
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-03'),
        totalPrice: 45.00,
        dailyPrice: 15.00,
        deposit: 50.00,
        status: BookingStatus.COMPLETED,
        pickupTime: '09:00',
        returnTime: '18:00',
        message: 'Besoin pour travaux de rénovation'
      },
      {
        toolId: savedTools[1].id,
        renterId: savedUser.id,
        ownerId: savedUser.id,
        startDate: new Date('2024-03-10'),
        endDate: new Date('2024-03-16'),
        totalPrice: 110.00,
        dailyPrice: 20.00,
        deposit: 75.00,
        status: BookingStatus.CONFIRMED,
        pickupTime: '10:00',
        returnTime: '17:00',
        message: 'Construction terrasse'
      }
    ];

    const savedBookings = await bookingRepository.save(bookings);
    console.log(`📅 Created ${savedBookings.length} bookings`);

    // Create reviews
    const reviews = [
      {
        toolId: savedTools[0].id,
        reviewerId: savedUser.id,
        revieweeId: savedUser.id,
        rating: 5,
        comment: 'Perceuse en excellent état, propriétaire très sympa!',
        type: 'tool_review'
      },
      {
        toolId: savedTools[1].id,
        reviewerId: savedUser.id,
        revieweeId: savedUser.id,
        rating: 4,
        comment: 'Bonne scie, quelques traces d\'usure mais fonctionne parfaitement.',
        type: 'tool_review'
      }
    ];

    const savedReviews = await reviewRepository.save(reviews);
    console.log(`⭐ Created ${savedReviews.length} reviews`);

    // Create bookmarks
    const bookmarks = [
      {
        userId: savedUser.id,
        toolId: savedTools[2].id
      }
    ];

    const savedBookmarks = await bookmarkRepository.save(bookmarks);
    console.log(`🔖 Created ${savedBookmarks.length} bookmarks`);

    console.log('\n🎉 Test user seeding completed successfully!');
    console.log('📧 Email: marie.dupont@example.com');
    console.log('🔑 Password: TestPassword123!');
    console.log('💰 Wallet Balance: €1250.75');
    console.log(`🔧 Tools: ${savedTools.length}`);
    console.log(`💳 Transactions: ${savedTransactions.length}`);
    console.log(`📅 Bookings: ${savedBookings.length}`);
    console.log(`⭐ Reviews: ${savedReviews.length}`);
    console.log(`🔖 Bookmarks: ${savedBookmarks.length}`);
    
    return savedUser;
    
  } catch (error) {
    console.error('❌ Error seeding test user:', error);
    throw error;
  }
}