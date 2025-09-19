import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';

export async function seedCategories(dataSource: DataSource) {
  console.log('🏷️ Seeding categories and subcategories...');
  
  const categoryRepository = dataSource.getRepository(Category);
  const subcategoryRepository = dataSource.getRepository(Subcategory);
  
  const categoriesData = [
    {
      name: 'gardening',
      displayName: 'gardening',
      description: "Outils pour l'entretien du jardin",
      subcategories: [
        {
          name: 'lawn-mowers',
          displayName: 'Tondeuses',
          description: 'Tondeuses à gazon électriques et thermiques',
        },
        {
          name: 'hedge-trimmers',
          displayName: 'Taille-haies',
          description: 'Outils de taille pour haies et arbustes',
        },
        {
          name: 'pruning-tools',
          displayName: 'Outils de taille',
          description: 'Sécateurs, cisailles et élagueurs',
        },
        {
          name: 'watering',
          displayName: 'Arrosage',
          description: "Systèmes d'arrosage et tuyaux",
        },
        {
          name: 'garden-hand-tools',
          displayName: 'Outils manuels',
          description: 'Pelles, râteaux, binettes et autres outils manuels',
        },
      ],
    },
    {
      name: 'diy',
      displayName: 'diy',
      description: 'Outils pour travaux de bricolage',
      subcategories: [
        {
          name: 'power-tools',
          displayName: 'Outils électroportatifs',
          description: 'Perceuses, visseuses et autres outils électriques',
        },
        {
          name: 'hand-tools',
          displayName: 'Outils manuels',
          description: 'Marteaux, tournevis, clés et pinces',
        },
        {
          name: 'measuring-tools',
          displayName: 'Outils de mesure',
          description: 'Mètres, niveaux et autres instruments de mesure',
        },
        {
          name: 'painting',
          displayName: 'Peinture',
          description: 'Rouleaux, pinceaux et matériel de peinture',
        },
      ],
    },
    {
      name: 'cleaning',
      displayName: 'cleaning',
      description: 'Équipement de nettoyage et entretien',
      subcategories: [
        {
          name: 'vacuum-cleaners',
          displayName: 'Aspirateurs',
          description: 'Aspirateurs traîneaux et balais',
        },
        {
          name: 'pressure-washers',
          displayName: 'Nettoyeurs haute pression',
          description: 'Nettoyeurs haute pression et accessoires',
        },
        {
          name: 'floor-care',
          displayName: 'Entretien des sols',
          description: 'Balais vapeur et nettoyeurs de sols',
        },
        {
          name: 'cleaning-supplies',
          displayName: 'Produits de nettoyage',
          description: "Détergents et produits d'entretien",
        },
      ],
    },
    {
      name: 'events',
      displayName: 'events',
      description: 'Matériel pour événements et réceptions',
      subcategories: [
        {
          name: 'party-equipment',
          displayName: 'Équipement de fête',
          description: 'Tables, chaises et matériel de réception',
        },
        {
          name: 'sound-lighting',
          displayName: 'Son et lumière',
          description: 'Systèmes audio et éclairage',
        },
        {
          name: 'event-decoration',
          displayName: 'Décoration',
          description: 'Articles de décoration pour événements',
        },
        {
          name: 'catering-equipment',
          displayName: 'Matériel de restauration',
          description: 'Équipement pour le service et la cuisine',
        },
      ],
    },
  ];

  for (const categoryData of categoriesData) {
    let category = await categoryRepository.findOne({ where: { name: categoryData.name } });
    
    if (!category) {
      category = categoryRepository.create({
        name: categoryData.name,
        displayName: categoryData.displayName,
        description: categoryData.description,
      });
      category = await categoryRepository.save(category);
    }

    for (const subcategoryData of categoryData.subcategories) {
      const existingSubcategory = await subcategoryRepository.findOne({ 
        where: { name: subcategoryData.name, categoryId: category.id } 
      });
      
      if (!existingSubcategory) {
        const subcategory = subcategoryRepository.create({
          name: subcategoryData.name,
          displayName: subcategoryData.displayName,
          description: subcategoryData.description,
          category,
          categoryId: category.id,
        });
        await subcategoryRepository.save(subcategory);
      }
    }
  }
  
  console.log('✅ Categories and subcategories seeded successfully');
}