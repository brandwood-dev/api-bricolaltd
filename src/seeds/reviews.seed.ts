import { DataSource } from 'typeorm';
import { Review } from '../reviews/entities/review.entity';
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { faker } from '@faker-js/faker';

export async function seedReviews(dataSource: DataSource) {
  console.log('⭐ Seeding reviews...');
  
  const reviewRepository = dataSource.getRepository(Review);
  const reviewToolRepository = dataSource.getRepository(ReviewTool);
  const userRepository = dataSource.getRepository(User);
  const toolRepository = dataSource.getRepository(Tool);
  const bookingRepository = dataSource.getRepository(Booking);
  
  const users = await userRepository.find({ where: { isAdmin: false } });
  const tools = await toolRepository.find({ 
    relations: ['owner']
  });
  const bookings = await bookingRepository.find();
  
  if (users.length === 0 || tools.length === 0) {
    console.log('⚠️ No users or tools found, skipping reviews seeding');
    return;
  }
  
  // Generate realistic user reviews
  const reviewsData: any[] = [];
  for (let i = 0; i < 50; i++) {
    const rating = faker.helpers.weightedArrayElement([
      { weight: 40, value: 5 },
      { weight: 30, value: 4 },
      { weight: 20, value: 3 },
      { weight: 7, value: 2 },
      { weight: 3, value: 1 }
    ]);
    
    const positiveComments = [
      'Excellent service, très professionnel!',
      'Propriétaire très sympa et arrangeant',
      'Communication parfaite, je recommande',
      'Très satisfait de l\'échange',
      'Personne de confiance, transaction fluide',
      'Rapide et efficace, parfait!',
      'Très bon contact, à recommander'
    ];
    
    const neutralComments = [
      'Transaction correcte dans l\'ensemble',
      'Rien à redire, service standard',
      'Correct mais sans plus',
      'Échange normal, pas de problème particulier'
    ];
    
    const negativeComments = [
      'Communication difficile',
      'Quelques problèmes de coordination',
      'Pourrait être plus réactif',
      'Service décevant'
    ];
    
    let comment: string;
    if (rating >= 4) {
      comment = faker.helpers.arrayElement(positiveComments);
    } else if (rating === 3) {
      comment = faker.helpers.arrayElement(neutralComments);
    } else {
      comment = faker.helpers.arrayElement(negativeComments);
    }
    
    reviewsData.push({ rating, comment });
  }

  // Generate realistic tool reviews
  const toolReviewsData: any[] = [];
  for (let i = 0; i < 200; i++) {
    const rating = faker.helpers.weightedArrayElement([
      { weight: 45, value: 5 },
      { weight: 30, value: 4 },
      { weight: 15, value: 3 },
      { weight: 7, value: 2 },
      { weight: 3, value: 1 }
    ]);
    
    const qualityRating = faker.number.int({ min: Math.max(1, rating - 1), max: Math.min(5, rating + 1) });
    const conditionRating = faker.number.int({ min: Math.max(1, rating - 1), max: Math.min(5, rating + 1) });
    const valueRating = faker.number.int({ min: Math.max(1, rating - 1), max: Math.min(5, rating + 1) });
    
    const excellentComments = [
      'Outil de qualité professionnelle, très satisfait!',
      'Parfait état, fonctionne comme neuf',
      'Excellent outil, très bien entretenu',
      'Qualité au rendez-vous, je recommande',
      'Outil performant, idéal pour mes travaux',
      'Très bon matériel, propriétaire sérieux'
    ];
    
    const goodComments = [
      'Bon rapport qualité-prix, outil fiable',
      'Outil correct, quelques traces d\'usure normales',
      'Fonctionne bien, conforme à la description',
      'Bon outil pour le prix demandé',
      'Satisfait de la location'
    ];
    
    const averageComments = [
      'Correct mais pourrait être mieux entretenu',
      'Outil fonctionnel mais vieillissant',
      'Fait le travail demandé',
      'Acceptable pour un usage ponctuel'
    ];
    
    const poorComments = [
      'Outil en mauvais état',
      'Problèmes de fonctionnement',
      'Décevant par rapport aux attentes',
      'Nécessite des réparations'
    ];
    
    let comment: string;
    if (rating === 5) {
      comment = faker.helpers.arrayElement(excellentComments);
    } else if (rating === 4) {
      comment = faker.helpers.arrayElement(goodComments);
    } else if (rating === 3) {
      comment = faker.helpers.arrayElement(averageComments);
    } else {
      comment = faker.helpers.arrayElement(poorComments);
    }
    
    toolReviewsData.push({
      rating,
      comment,
      qualityRating,
      conditionRating,
      valueRating
    });
  }
  
  // Seed general reviews
  for (let i = 0; i < reviewsData.length; i++) {
    const reviewData = reviewsData[i];
    const reviewer = users[i % users.length];
    const reviewee = users[(i + 1) % users.length];
    const booking = bookings[i % bookings.length];
    
    const existingReview = await reviewRepository.findOne({
      where: {
        reviewerId: reviewer.id,
        revieweeId: reviewee.id,
        bookingId: booking?.id,
      },
    });
    
    if (!existingReview) {
      const review = reviewRepository.create({
        ...reviewData,
        reviewer,
        reviewerId: reviewer.id,
        reviewee,
        revieweeId: reviewee.id,
        booking: booking || undefined,
        bookingId: booking?.id || undefined,
      });
      await reviewRepository.save(review);
    }
  }
  
  // Seed tool reviews
  for (let i = 0; i < toolReviewsData.length; i++) {
    const reviewData = toolReviewsData[i];
    const reviewer = users[i % users.length];
    const tool = tools[i % tools.length];
    const booking = bookings[i % bookings.length];
  
    const existingReview = await reviewToolRepository.findOne({
      where: {
        reviewerId: reviewer.id,
        toolId: tool.id,
      },
    });
  
    if (!existingReview) {
      const review = reviewToolRepository.create({
        ...reviewData,
        reviewer,
        reviewerId: reviewer.id,
        reviewee: tool.owner,
        revieweeId: tool.ownerId,
        tool,
        toolId: tool.id,
        booking: booking || undefined,
        bookingId: booking?.id || undefined,
      });
      await reviewToolRepository.save(review);
    }
  }
  
  console.log('✅ Reviews seeded successfully');
}