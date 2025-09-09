import { DataSource } from 'typeorm';
import { Email, EmailStatus } from '../emails/entities/email.entity';
import { User } from '../users/entities/user.entity';
import { faker } from '@faker-js/faker';

export async function seedEmails(dataSource: DataSource) {
  console.log('📧 Seeding emails...');
  
  const emailRepository = dataSource.getRepository(Email);
  const userRepository = dataSource.getRepository(User);
  
  const users = await userRepository.find({ where: { isAdmin: false } });
  const admins = await userRepository.find({ where: { isAdmin: true } });
  
  if (users.length === 0) {
    console.log('⚠️ No users found, skipping emails seeding');
    return;
  }
  
  const emailStatuses = Object.values(EmailStatus);
  const emailSubjects = [
    'Welcome to Bricola!', 'Bienvenue sur Bricola!',
    'Booking Confirmation', 'Confirmation de réservation',
    'Tool Return Reminder', 'Rappel de retour d\'outil',
    'New Message', 'Nouveau message',
    'Payment Confirmation', 'Confirmation de paiement',
    'Account Verification', 'Vérification de compte',
    'Password Reset', 'Réinitialisation du mot de passe',
    'Tool Available', 'Outil disponible',
    'Booking Cancelled', 'Réservation annulée',
    'Review Request', 'Demande d\'avis'
  ];

  // Generate 100 realistic emails
  for (let i = 0; i < 100; i++) {
    const user = users[i % users.length];
    const emailData = {
      to: user.email,
      subject: faker.helpers.arrayElement(emailSubjects),
      body: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
      status: faker.helpers.arrayElement(emailStatuses),
      sentAt: faker.datatype.boolean({ probability: 0.8 }) ? faker.date.recent({ days: 30 }) : undefined
    };
    const admin = admins.length > 0 ? admins[0] : undefined;
    
    const email = emailRepository.create({
      ...emailData,
      user,
      userId: user.id,
      admin,
      adminId: admin?.id,
    });
    
    await emailRepository.save(email);
  }
  
  console.log('✅ Emails seeded successfully');
}