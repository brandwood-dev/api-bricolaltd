import { DataSource } from 'typeorm';
import { News } from '../news/entities/news.entity';
import { User } from '../users/entities/user.entity';
import { faker } from '@faker-js/faker';

export async function seedNews(dataSource: DataSource) {
  console.log('📰 Seeding news...');
  
  const newsRepository = dataSource.getRepository(News);
  const userRepository = dataSource.getRepository(User);
  
  const admins = await userRepository.find({ where: { isAdmin: true } });
  
  if (admins.length === 0) {
    console.log('⚠️ No admin users found, skipping news seeding');
    return;
  }
  
  const newsCategories = [
    'Platform Updates', 'New Tools', 'Safety Tips', 'Partnerships',
    'User Stories', 'Maintenance Tips', 'Seasonal Tools', 'Community Events'
  ];
  
  const newsTitles = [
    'Welcome to Bricola - Tool Rental Platform',
    'New Garden Tools Available',
    'Safety Tips for Power Tools',
    'Mobile App Update',
    'Partnership with Local Hardware Stores',
    'Spring Cleaning Tool Collection',
    'Winter Tool Maintenance Guide',
    'Community Tool Sharing Success Stories',
    'New Electric Tool Categories',
    'Tool Safety Certification Program'
  ];

  // Generate 25 realistic news articles
  for (let i = 0; i < 25; i++) {
    const newsItem = {
      title: faker.helpers.arrayElement(newsTitles) + ` - ${faker.lorem.words(2)}`,
      content: faker.lorem.paragraphs(faker.number.int({ min: 2, max: 5 })),
      imageUrl: `https://bricola-bucket.s3.amazonaws.com/news/${faker.string.alphanumeric(8)}.jpg`,
      additionalImages: faker.datatype.boolean({ probability: 0.3 }) ? [
        `https://bricola-bucket.s3.amazonaws.com/news/${faker.string.alphanumeric(8)}_1.jpg`,
        `https://bricola-bucket.s3.amazonaws.com/news/${faker.string.alphanumeric(8)}_2.jpg`
      ] : undefined,
      isPublic: faker.datatype.boolean({ probability: 0.9 }),
      isFeatured: faker.datatype.boolean({ probability: 0.3 }),
      publishedAt: faker.datatype.boolean({ probability: 0.8 }) ? faker.date.recent({ days: 60 }) : undefined
    };
    const admin = admins[i % admins.length];
    
    const existingNews = await newsRepository.findOne({
      where: {
        title: newsItem.title,
      },
    });
    
    if (!existingNews) {
      const news = newsRepository.create({
        ...newsItem,
        admin,
        adminId: admin.id,
      });
      await newsRepository.save(news);
    }
  }
  
  console.log('✅ News seeded successfully');
}