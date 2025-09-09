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
    // Outils de bricolage
    { category: 'Outils de bricolage', subcategory: 'Perceuses', brands: ['Bosch', 'Makita', 'DeWalt', 'Ryobi', 'Black & Decker'], types: ['Perceuse sans fil', 'Perceuse filaire', 'Perceuse à percussion'], priceRange: [10, 25] },
    { category: 'Outils de bricolage', subcategory: 'Scies', brands: ['Makita', 'Bosch', 'DeWalt', 'Festool'], types: ['Scie circulaire', 'Scie sauteuse', 'Scie à onglet'], priceRange: [15, 35] },
    { category: 'Outils de bricolage', subcategory: 'Ponceuses', brands: ['Bosch', 'Makita', 'Festool', 'Ryobi'], types: ['Ponceuse orbitale', 'Ponceuse excentrique', 'Ponceuse à bande'], priceRange: [12, 28] },
    
    // Outils de jardinage
    { category: 'Outils de jardinage', subcategory: 'Tondeuses', brands: ['Ryobi', 'Honda', 'Husqvarna', 'Bosch'], types: ['Tondeuse électrique', 'Tondeuse thermique', 'Tondeuse robot'], priceRange: [20, 45] },
    { category: 'Outils de jardinage', subcategory: 'Taille-haies', brands: ['Black & Decker', 'Bosch', 'Stihl', 'Husqvarna'], types: ['Taille-haie électrique', 'Taille-haie thermique', 'Taille-haie sur perche'], priceRange: [10, 25] },
    { category: 'Outils de jardinage', subcategory: 'Souffleurs', brands: ['Stihl', 'Husqvarna', 'Ryobi', 'Black & Decker'], types: ['Souffleur électrique', 'Souffleur thermique', 'Aspirateur souffleur'], priceRange: [8, 20] },
    
    // Électroménager
    { category: 'Électroménager', subcategory: 'Nettoyage', brands: ['Karcher', 'Nilfisk', 'Bosch', 'Dyson'], types: ['Aspirateur eau/poussière', 'Nettoyeur haute pression', 'Aspirateur industriel'], priceRange: [15, 40] },
    { category: 'Électroménager', subcategory: 'Cuisine', brands: ['KitchenAid', 'Bosch', 'Moulinex', 'Kenwood'], types: ['Robot pâtissier', 'Blender professionnel', 'Machine à pain'], priceRange: [8, 25] },
    
    // Matériel de transport
    { category: 'Matériel de transport', subcategory: 'Échelles', brands: ['Hailo', 'Zarges', 'Centaure', 'Tubesca'], types: ['Échelle télescopique', 'Échelle coulissante', 'Escabeau'], priceRange: [18, 35] },
    { category: 'Matériel de transport', subcategory: 'Diables', brands: ['Wolfcraft', 'Stanley', 'Mannesmann', 'Silverline'], types: ['Diable pliant', 'Diable escalier', 'Diable tout terrain'], priceRange: [5, 15] },
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
    
    const tool = {
      name: `${type} ${brand} ${faker.helpers.arrayElement(['Pro', 'Expert', 'Premium', 'Standard', 'Compact'])}`,
      description,
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
    
    if (!category || !subcategory) continue;
    
    const existingTool = await toolRepository.findOne({ 
      where: { title: toolData.name, ownerId: owner.id } 
    });
    
    if (!existingTool) {
      const tool = toolRepository.create({
        title: toolData.name,
        description: toolData.description,
        basePrice: toolData.dailyRate,
        condition: toolData.condition,
        toolStatus: ToolStatus.PUBLISHED,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        owner,
        ownerId: owner.id,
        category,
        categoryId: category.id,
        subcategory,
        subcategoryId: subcategory.id,
        pickupAddress: owner.address || '123 Rue de la Paix, 75001 Paris, France',
        latitude: 48.8566 + (Math.random() - 0.5) * 0.1, // Random around Paris
        longitude: 2.3522 + (Math.random() - 0.5) * 0.1,
        depositAmount: toolData.dailyRate * 2, // Set deposit as 2x daily rate
      });
      
      const savedTool = await toolRepository.save(tool);
      
      // Add photos
      for (let j = 0; j < toolData.photos.length; j++) {
        const photo = toolPhotoRepository.create({
          url: toolData.photos[j],
          filename: `tool-${savedTool.id}-photo-${j + 1}.jpg`,
          isPrimary: j === 0,
          tool: savedTool,
          toolId: savedTool.id,
        });
        await toolPhotoRepository.save(photo);
      }
    }
  }
  
  console.log('✅ Tools seeded successfully');
}