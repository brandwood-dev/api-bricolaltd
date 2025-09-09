import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Country } from '../users/entities/country.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

export async function seedUsers(dataSource: DataSource) {
  console.log('👥 Seeding users...');
  
  try {
    const userRepository = dataSource.getRepository(User);
    const countryRepository = dataSource.getRepository(Country);
    const userPreferenceRepository = dataSource.getRepository(UserPreference);
    const walletRepository = dataSource.getRepository(Wallet);
    
    const france = await countryRepository.findOne({ where: { code: 'FR' } });
    const belgium = await countryRepository.findOne({ where: { code: 'BE' } });
    
    if (!france) {
      console.error('❌ France country not found in database. Make sure countries are seeded first.');
      throw new Error('Required country (FR) not found');
    }
    
    if (!belgium) {
      console.error('❌ Belgium country not found in database. Make sure countries are seeded first.');
      throw new Error('Required country (BE) not found');
    }
    
    console.log(`✓ Found countries: France (${france.id}), Belgium (${belgium.id})`);
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create admin user
    const adminUser = {
      email: 'admin@bricola.fr',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Bricola',
      phoneNumber: '+33123456789',
      isAdmin: true,
      verifiedEmail: true,
      countryId: france.id,
      address: '123 Rue de la Paix',
      city: 'Paris',
      postalCode: '75001',
    };

    // Generate realistic users with Faker
    const usersData = [adminUser];
    const countries = [france, belgium];
    
    // Generate 50 realistic users
    for (let i = 0; i < 50; i++) {
      const country = faker.helpers.arrayElement(countries);
      const isFromFrance = country.id === france.id;
      
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName, provider: isFromFrance ? 'email.fr' : 'email.be' }).toLowerCase();
      
      const user = {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber: isFromFrance ? 
          `+33${faker.string.numeric(9)}` : 
          `+32${faker.string.numeric(9)}`,
        verifiedEmail: faker.datatype.boolean(0.8), // 80% verified
        countryId: country.id,
        address: faker.location.streetAddress(),
        city: isFromFrance ? 
          faker.helpers.arrayElement(['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille']) :
          faker.helpers.arrayElement(['Bruxelles', 'Anvers', 'Gand', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Louvain']),
        postalCode: isFromFrance ? 
          faker.location.zipCode('#####') : 
          faker.location.zipCode('####'),
        bio: faker.helpers.maybe(() => {
          const bios = [
            'Bricoleur passionné depuis plusieurs années',
            'Amateur de jardinage et décoration',
            'Professionnel du bâtiment',
            'Passionné de rénovation',
            'Artisan expérimenté',
            'Étudiant en architecture',
            'Propriétaire de plusieurs outils',
            'Spécialiste en électricité',
            'Expert en plomberie',
            'Menuisier amateur',
            'Paysagiste professionnel',
            'Mécanicien automobile'
          ];
          return faker.helpers.arrayElement(bios);
        }, { probability: 0.7 }), // 70% chance of having a bio
        isAdmin: false,
      };
      
      usersData.push(user);
    }

    let seedCount = 0;
    for (const userData of usersData) {
      const existingUser = await userRepository.findOne({ where: { email: userData.email } });
      
      if (!existingUser) {
        console.log(`Creating user: ${userData.email} with country ID: ${userData.countryId}`);
        const user = userRepository.create(userData);
        const savedUser = await userRepository.save(user);
        seedCount++;
        
        // Create user preferences
        const preferences = userPreferenceRepository.create({
          userId: savedUser.id,
          language: 'fr',
          currency: 'EUR',
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
        });
        await userPreferenceRepository.save(preferences);
        
        // Create wallet
        const wallet = walletRepository.create({
          userId: savedUser.id,
          balance: 0,
        });
        await walletRepository.save(wallet);
        
        console.log(`✓ Seeded user: ${userData.email}`);
      } else {
        console.log(`- User already exists: ${userData.email}`);
      }
    }
    
    console.log(`✅ Users seeded successfully (${seedCount} new users added)`);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
}