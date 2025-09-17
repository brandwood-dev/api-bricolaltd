import { DataSource } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { faker } from '@faker-js/faker';

export async function seedBookings(dataSource: DataSource) {
  console.log('📅 Seeding bookings...');
  
  const bookingRepository = dataSource.getRepository(Booking);
  const userRepository = dataSource.getRepository(User);
  const toolRepository = dataSource.getRepository(Tool);
  
  const users = await userRepository.find({ where: { isAdmin: false } });
  const tools = await toolRepository.find();
  
  if (users.length === 0 || tools.length === 0) {
    console.log('⚠️ No users or tools found, skipping bookings seeding');
    return;
  }
  
  const bookingsData: any[] = [];
  
  // Generate 200 realistic bookings
  for (let i = 0; i < 200; i++) {
    const startDate = faker.date.between({ 
      from: new Date('2024-01-01'), 
      to: new Date('2024-12-31') 
    });
    
    const duration = faker.number.int({ min: 1, max: 7 }); // 1 to 7 days
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration);
    
    const dailyRate = faker.number.float({ min: 8, max: 50, fractionDigits: 1 });
    const totalAmount = dailyRate * duration;
    
    const status = faker.helpers.weightedArrayElement([
      { weight: 30, value: BookingStatus.COMPLETED },
      { weight: 25, value: BookingStatus.ACCEPTED },
      { weight: 15, value: BookingStatus.PENDING },
      { weight: 10, value: BookingStatus.CANCELLED },
      { weight: 20, value: BookingStatus.ONGOING },
    ]);
    
    const noteTemplates = [
      'Besoin pour travaux de rénovation',
      'Parfait pour mon projet de jardinage',
      'Urgent pour finir les travaux',
      'Premier essai de location',
      'Très satisfait du service',
      'Outil en excellent état',
      'Livraison rapide et efficace',
      'Recommande vivement',
      'Projet de bricolage personnel',
      'Travaux d\'amélioration maison',
      'Réparation urgente',
      'Aménagement extérieur',
      'Rénovation salle de bain',
      'Construction terrasse',
      'Entretien jardin'
    ];
    
    const booking = {
      startDate,
      endDate,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status,
      notes: faker.helpers.maybe(() => faker.helpers.arrayElement(noteTemplates), { probability: 0.7 })
    };
    
    bookingsData.push(booking);
  }
  
  for (let i = 0; i < bookingsData.length; i++) {
    const bookingData = bookingsData[i];
    const renter = users[i % users.length];
    const tool = tools[i % tools.length];
    
    const existingBooking = await bookingRepository.findOne({
      where: {
        renterId: renter.id,
        toolId: tool.id,
        startDate: bookingData.startDate,
      },
    });
    
    if (!existingBooking) {
      const booking = bookingRepository.create({
        ...bookingData,
        renterId: renter.id,
        tool,
        toolId: tool.id,
        ownerId: tool.ownerId,
      });
      await bookingRepository.save(booking);
    }
  }
  
  console.log('✅ Bookings seeded successfully');
}