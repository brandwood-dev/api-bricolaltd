import { DataSource } from 'typeorm';
import { Dispute } from '../disputes/entities/dispute.entity';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { DisputeStatus } from '../disputes/enums/dispute-status.enum';
import { faker } from '@faker-js/faker';

export async function seedDisputes(dataSource: DataSource) {
  console.log('⚖️ Seeding disputes...');
  
  const disputeRepository = dataSource.getRepository(Dispute);
  const userRepository = dataSource.getRepository(User);
  const bookingRepository = dataSource.getRepository(Booking);
  
  const users = await userRepository.find({ where: { isAdmin: false } });
  const bookings = await bookingRepository.find({ take: 3 });
  const admins = await userRepository.find({ where: { isAdmin: true } });
  
  if (users.length === 0 || bookings.length === 0) {
    console.log('⚠️ No users or bookings found, skipping disputes seeding');
    return;
  }
  
  const disputeStatuses = Object.values(DisputeStatus);
  const disputeReasons = [
    'Tool Damage Dispute', 'Tool Not Returned', 'Quality Issue', 'Payment Dispute',
    'Service Not Provided', 'Tool Malfunction', 'Late Return Fee', 'Cleaning Fee Dispute',
    'Booking Cancellation', 'Overcharge Dispute', 'Tool Missing Parts', 'Delivery Issue'
  ];

  // Generate 50 realistic disputes
  for (let i = 0; i < 50; i++) {
    const status = faker.helpers.arrayElement(disputeStatuses);
    const disputeData = {
      reason: faker.helpers.arrayElement(disputeReasons),
      status,
      description: faker.lorem.sentences(faker.number.int({ min: 2, max: 4 })),
      refundAmount: faker.number.float({ min: 10, max: 500, fractionDigits: 2 }),
      resolutionNotes: status === DisputeStatus.RESOLVED ? faker.lorem.sentence() : undefined,
    };
    const initiator = users[i % users.length];
    const respondent = users[(i + 1) % users.length];
    const booking = bookings[i % bookings.length];
    const moderator = admins.length > 0 ? admins[0] : undefined;
    
    const existingDispute = await disputeRepository.findOne({
      where: {
        initiatorId: initiator.id,
        respondentId: respondent.id,
        bookingId: booking.id,
      },
    });
    
    if (!existingDispute) {
      const dispute = disputeRepository.create({
        reason: disputeData.reason,
        description: disputeData.description,
        status: disputeData.status,
        refundAmount: disputeData.refundAmount,
        resolutionNotes: disputeData.resolutionNotes,
        initiatorId: initiator.id,
        respondentId: respondent.id,
        toolId: booking.toolId,
        bookingId: booking.id,
        moderatorId: moderator?.id,
        resolvedAt: disputeData.status === DisputeStatus.RESOLVED ? new Date() : undefined,
      });
      await disputeRepository.save(dispute);
    }
  }
  
  console.log('✅ Disputes seeded successfully');
}