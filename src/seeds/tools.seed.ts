/* eslint-disable prettier/prettier */
import { DataSource } from 'typeorm';
import { Tool } from '../tools/entities/tool.entity';
import { ToolPhoto } from '../tools/entities/tool-photo.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';
import { ToolCondition } from '../tools/enums/tool-condition.enum';
import { ToolStatus } from '../tools/enums/tool-status.enum';
import { AvailabilityStatus } from '../tools/enums/availability-status.enum';
import { faker } from '@faker-js/faker';

export async function seedTools(dataSource: DataSource) {
  console.log('🔧 Seeding tools...');
  
  const toolRepository = dataSource.getRepository(Tool);
  const toolPhotoRepository = dataSource.getRepository(ToolPhoto);
  const userRepository = dataSource.getRepository(User);
  const categoryRepository = dataSource.getRepository(Category);
  // const subcategoryRepository = dataSource.getRepository(Subcategory);
  
  const users = await userRepository.find({ where: { isAdmin: false } });
  const categories = await categoryRepository.find({ relations: ['subcategories'] });
 
  // Define tool templates for realistic generation
  const toolTemplates = [
    // DIY tools
    {
      category: 'diy',
      subcategory: 'construction',
      brands: ['Bosch', 'Makita', 'DeWalt', 'Ryobi', 'Black & Decker'],
      types: ['Perceuse sans fil', 'Perceuse filaire', 'Perceuse à percussion'],
      priceRange: [10, 25],
    },
    {
      category: 'diy',
      subcategory: 'electricity',
      brands: ['Makita', 'Bosch', 'DeWalt', 'Festool'],
      types: ['Scie circulaire', 'Scie sauteuse', 'Scie à onglet'],
      priceRange: [15, 35],
    },
    {
      category: 'diy',
      subcategory: 'screws-and-bolts',
      brands: ['Bosch', 'Makita', 'Festool', 'Ryobi'],
      types: ['Ponceuse orbitale', 'Ponceuse excentrique', 'Ponceuse à bande'],
      priceRange: [12, 28],
    },
    {
      category: 'diy',
      subcategory: 'painting',
      brands: ['Stanley', 'Facom', 'Bahco', 'Gedore'],
      types: ['Marteau', 'Tournevis', 'Clé à molette'],
      priceRange: [5, 15],
    },

    // Gardening tools
    {
      category: 'gardening',
      subcategory: 'soil-maintenance',
      brands: ['Ryobi', 'Honda', 'Husqvarna', 'Bosch'],
      types: ['Tondeuse électrique', 'Tondeuse thermique', 'Tondeuse robot'],
      priceRange: [20, 45],
    },
    {
      category: 'gardening',
      subcategory: 'garden-tools',
      brands: ['Black & Decker', 'Bosch', 'Stihl', 'Husqvarna'],
      types: [
        'Taille-haie électrique',
        'Taille-haie thermique',
        'Taille-haie sur perche',
      ],
      priceRange: [10, 25],
    },
    {
      category: 'gardening',
      subcategory: 'pruning-and-cutting',
      brands: ['Fiskars', 'Spear & Jackson', 'Gardena', 'Wolf'],
      types: ['Pelle', 'Râteau', 'Binette'],
      priceRange: [8, 20],
    },

    // Cleaning equipment
    {
      category: 'cleaning',
      subcategory: 'waste-and-dust-management',
      brands: ['Karcher', 'Nilfisk', 'Bosch', 'Dyson'],
      types: [
        'Aspirateur eau/poussière',
        'Aspirateur traîneau',
        'Aspirateur industriel',
      ],
      priceRange: [15, 40],
    },
    {
      category: 'cleaning',
      subcategory: 'indoor-cleaning',
      brands: ['Karcher', 'Nilfisk', 'Bosch', 'Lavor'],
      types: [
        'Nettoyeur haute pression',
        'Nettoyeur compact',
        'Nettoyeur professionnel',
      ],
      priceRange: [18, 35],
    },

    // Event equipment
    {
      category: 'events',
      subcategory: 'decoration',
      brands: ['Lifetime', 'Bolero', 'Vango', 'Coleman'],
      types: ['Table pliante', 'Chaise empilable', 'Parasol'],
      priceRange: [5, 25],
    },
    {
      category: 'events',
      subcategory: 'furniture',
      brands: ['JBL', 'Bose', 'Yamaha', 'Pioneer'],
      types: ['Enceinte portable', 'Micro sans fil', 'Éclairage LED'],
      priceRange: [15, 50],
    },
  ];

  const toolsData: any[] = [];
  
  // Generate 100 realistic tools
  for (let i = 0; i < 100; i++) {
    const template = faker.helpers.arrayElement(toolTemplates);
    const brand = faker.helpers.arrayElement(template.brands);
    const type = faker.helpers.arrayElement(template.types);
    const condition = faker.helpers.arrayElement(Object.values(ToolCondition));
    const dailyRate = faker.number.float({ min: template.priceRange[0], max: template.priceRange[1], fractionDigits: 1 });
    
    // Generate realistic descriptions
    const features = [
      'Excellent état de fonctionnement',
      'Livré avec accessoires',
      'Très peu utilisé',
      'Entretien régulier effectué',
      'Manuel d\'utilisation inclus',
      'Garantie constructeur restante',
      'Idéal pour bricoleurs',
      'Professionnel ou amateur',
      'Facile à utiliser',
      'Compact et léger'
    ];
    
    const selectedFeatures = faker.helpers.arrayElements(features, { min: 2, max: 4 });
    const description = `${type} ${brand} de qualité. ${selectedFeatures.join(', ')}.`;
    
    const model = faker.helpers.arrayElement(['Pro', 'Expert', 'Premium', 'Standard', 'Compact']);
    
    const tool = {
      name: `${type} ${brand} ${model}`,
      description,
      brand,
      model,
      year: faker.number.int({ min: 2015, max: 2024 }),
      dailyRate,
      condition,
      categoryName: template.category,
      subcategoryName: template.subcategory,
      photos: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, (_, index) => 
        `https://picsum.photos/800/600?random=${i * 10 + index}&tool`
      ),
    };
    
    toolsData.push(tool);
  }

  for (let i = 0; i < toolsData.length; i++) {
    const toolData = toolsData[i];
    const owner = users[i % users.length];
    
    const category = categories.find(c => c.name === toolData.categoryName);
    const subcategory = category?.subcategories?.find(s => s.name === toolData.subcategoryName);
    
    if (!category || !subcategory) {
      console.log(`Skipping tool: category '${toolData.categoryName}' or subcategory '${toolData.subcategoryName}' not found`);
      continue;
    }
    
    const existingTool = await toolRepository.findOne({ 
      where: { title: toolData.name, ownerId: owner.id } 
    });
    
    if (!existingTool) {
      const tool = toolRepository.create({
        title: toolData.name,
        description: toolData.description,
        brand: toolData.brand,
        model: toolData.model,
        year: toolData.year,
        condition: toolData.condition,
        pickupAddress: owner.address || '123 Rue de la Paix, 75001 Paris, France',
        latitude: 48.8566 + (Math.random() - 0.5) * 0.1, // Random around Paris
        longitude: 2.3522 + (Math.random() - 0.5) * 0.1,
        ownerInstructions: 'Outil en bon état, manipulation avec précaution.',
        basePrice: toolData.dailyRate,
        depositAmount: toolData.dailyRate * 2, // Set deposit as 2x daily rate
        imageUrl: toolData.photos[0], // Set first photo as main image
        toolStatus: ToolStatus.PUBLISHED,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        ownerId: owner.id,
        publishedAt: new Date(),
      });
      
      const savedTool = await toolRepository.save(tool);
      
      // Add photos
      for (let j = 0; j < toolData.photos.length; j++) {
        const photo = toolPhotoRepository.create({
          url: toolData.photos[j],
          filename: `tool-${savedTool.id}-photo-${j + 1}.jpg`,
          isPrimary: j === 0,
          toolId: savedTool.id,
        });
        await toolPhotoRepository.save(photo);
      }
    }
  }
  
  console.log('✅ Tools seeded successfully');
}