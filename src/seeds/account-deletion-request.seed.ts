import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { AccountDeletionRequest } from '../users/entities/account-deletion-request.entity';
import { User } from '../users/entities/user.entity';
import { DeletionStatus } from '../users/enums/deletion-status.enum';

export async function seedAccountDeletionRequests(dataSource: DataSource) {
  console.log('🗑️ Seeding account deletion requests...');
  
  const deletionRequestRepository = dataSource.getRepository(AccountDeletionRequest);
  const userRepository = dataSource.getRepository(User);
  
  const users = await userRepository.find({ where: { isAdmin: false }, take: 10 });
  const admins = await userRepository.find({ where: { isAdmin: true } });
  
  if (users.length === 0) {
    console.log('⚠️ No users found, skipping account deletion requests seeding');
    return;
  }
  
  const deletionStatuses = [DeletionStatus.PENDING, DeletionStatus.DELETED, DeletionStatus.RESTORED];
  
  // Create 15 deletion requests with varied statuses and realistic data
  for (let i = 0; i < 15; i++) {
    const user = faker.helpers.arrayElement(users);
    const status = faker.helpers.arrayElement(deletionStatuses);
    const admin = admins.length > 0 ? faker.helpers.arrayElement(admins) : undefined;
    
    const existingRequest = await deletionRequestRepository.findOne({
      where: {
        userId: user.id,
      },
    });
    
    if (!existingRequest) {
      const requestedAt = faker.date.between({
        from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        to: new Date()
      });
      
      const reviewedAt = status !== DeletionStatus.PENDING 
        ? faker.date.between({ from: requestedAt, to: new Date() })
        : undefined;
      
      const deletionRequest = deletionRequestRepository.create({
        user,
        userId: user.id,
        status,
        requestedAt,
        reviewedByAdmin: status !== DeletionStatus.PENDING ? admin : undefined,
        reviewedByAdminId: status !== DeletionStatus.PENDING ? admin?.id : undefined,
        reviewedAt,
      });
      
      await deletionRequestRepository.save(deletionRequest);
    }
  }
  
  console.log('✅ Account deletion requests seeded successfully');
}