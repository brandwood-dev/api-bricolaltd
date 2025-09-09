import { DataSource } from 'typeorm';
import { UserSession } from '../users/entities/user-session.entity';
import { User } from '../users/entities/user.entity';
import { randomBytes } from 'crypto';
import { faker } from '@faker-js/faker';

export async function seedUserSessions(dataSource: DataSource) {
  console.log('🔐 Seeding user sessions...');
  
  const userSessionRepository = dataSource.getRepository(UserSession);
  const userRepository = dataSource.getRepository(User);
  
  const users = await userRepository.find({ where: { isAdmin: false } });
  
  if (users.length === 0) {
    console.log('⚠️ No users found, skipping user sessions seeding');
    return;
  }
  
  const deviceTypes = ['mobile', 'desktop', 'tablet'];
  const deviceNames = [
    'iPhone 14', 'iPhone 13', 'iPhone 12', 'Samsung Galaxy S23', 'Samsung Galaxy A54',
    'MacBook Pro', 'MacBook Air', 'iMac', 'Windows PC', 'Dell Laptop',
    'iPad Air', 'iPad Pro', 'Samsung Tab', 'Surface Pro', 'Lenovo Tab'
  ];
  const userAgents = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/109.0 Firefox/115.0'
  ];

  // Generate 150 realistic user sessions
  for (let i = 0; i < 150; i++) {
    const user = users[i % users.length];
    const deviceType = faker.helpers.arrayElement(deviceTypes);
    const deviceName = faker.helpers.arrayElement(deviceNames);
    const userAgent = faker.helpers.arrayElement(userAgents);
    const ipAddress = faker.internet.ip();
    
    const token = randomBytes(32).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    const lastActivityAt = new Date();
    lastActivityAt.setHours(lastActivityAt.getHours() - Math.floor(Math.random() * 24));
    
    const existingSession = await userSessionRepository.findOne({
      where: {
        userId: user.id,
        deviceType,
        deviceName,
      },
    });
    
    if (!existingSession) {
      const session = userSessionRepository.create({
        user,
        userId: user.id,
        token,
        refreshToken,
        ipAddress,
        userAgent,
        deviceType,
        deviceName,
        isActive: Math.random() > 0.2, // 80% active sessions
        expiresAt,
        lastActivityAt,
      });
      await userSessionRepository.save(session);
    }
  }
  
  console.log('✅ User sessions seeded successfully');
}