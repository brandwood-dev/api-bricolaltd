import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { ReviewApp } from '../reviews/entities/review-app.entity';
import { User } from '../users/entities/user.entity';

export async function seedReviewApp(dataSource: DataSource) {
  console.log('⭐ Seeding app reviews...');
  
  const reviewAppRepository = dataSource.getRepository(ReviewApp);
  const userRepository = dataSource.getRepository(User);
  
  const users = await userRepository.find({ where: { isAdmin: false }, take: 10 });
  
  if (users.length === 0) {
    console.log('⚠️ No users found, skipping app reviews seeding');
    return;
  }
  
  const positiveComments = [
    'Application fantastique! Interface très intuitive et facile à utiliser.',
    'Parfait pour trouver des outils près de chez moi. Service client excellent!',
    'Interface claire et processus de réservation simple. Recommandé!',
    'Révolutionnaire! Fini les achats d\'outils pour une utilisation ponctuelle.',
    'Excellente idée, très pratique pour les bricoleurs occasionnels.',
    'App géniale, économique et écologique!'
  ];
  
  const neutralComments = [
    'Très bonne app pour louer des outils. Quelques améliorations possibles sur la recherche.',
    'App correcte mais parfois lente. Le concept est génial cependant.',
    'Bonne application dans l\'ensemble, quelques bugs mineurs.',
    'Interface acceptable, fonctionnalités utiles.'
  ];
  
  const negativeComments = [
    'Application souvent en panne, très frustrant.',
    'Interface confuse, difficile de trouver ce qu\'on cherche.',
    'Trop de bugs, pas assez stable.',
    'Service client peu réactif, déçu de l\'expérience.'
  ];
  
  // Generate 30 realistic app reviews
  for (let i = 0; i < 30; i++) {
    const reviewer = faker.helpers.arrayElement(users);
    const rating = faker.number.int({ min: 1, max: 5 });
    
    let comment: string;
    if (rating >= 4) {
      comment = faker.helpers.arrayElement(positiveComments);
    } else if (rating === 3) {
      comment = faker.helpers.arrayElement(neutralComments);
    } else {
      comment = faker.helpers.arrayElement(negativeComments);
    }
    
    const existingReview = await reviewAppRepository.findOne({
      where: {
        reviewerId: reviewer.id,
      },
    });
    
    if (!existingReview) {
      const review = reviewAppRepository.create({
        rating,
        comment,
        reviewer,
        reviewerId: reviewer.id,
        createdAt: faker.date.recent({ days: 180 }),
      });
      await reviewAppRepository.save(review);
    }
  }
  
  console.log('✅ App reviews seeded successfully');
}