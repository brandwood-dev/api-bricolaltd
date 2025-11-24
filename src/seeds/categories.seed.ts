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
          name: 'soil-maintenance',
          displayName: 'Soil Maintenance',
          description: 'Outils pour l`entretien du sol',
        },
        {
          name: 'plant-care',
          displayName: 'Plant Care',
          description: 'Outils pour l`entretien des plantes',
        },
        {
          name: 'pruning-and-cutting',
          displayName: 'Pruning and Cutting',
          description: 'Outils de taille pour haies et arbustes',
        },
        {
          name: 'cleaning-and-collection',
          displayName: 'Cleaning and Collection',
          description: 'Systèmes de nettoyage et de ramassage',
        },
        {
          name: 'watering-and-irrigation',
          displayName: 'Watering and Irrigation',
          description: 'Outils pour arrosage et irrigation',
        },
      ],
    },
    {
      name: 'diy',
      displayName: 'diy',
      description: 'Outils pour travaux de bricolage',
      subcategories: [
        {
          name: 'construction',
          displayName: 'Construction',
          description: 'Outils pour travaux de bricolage',
        },
        {
          name: 'electricity',
          displayName: 'Outils électroportatifs',
          description: 'Perceuses, visseuses et autres outils électriques',
        },
        {
          name: 'screws-and-bolts',
          displayName: 'Screws and Bolts',
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
          name: 'indoor-cleaning',
          displayName: 'Indoor Cleaning',
          description: 'Outils pour nettoyage intérieur',
        },
        {
          name: 'outdoor-cleaning',
          displayName: 'Outdoor Cleaning',
          description: 'Outils pour nettoyage extérieur',
        },
        {
          name: 'waste-and-dust-management',
          displayName: 'Waste and Dust Management',
          description: 'Outils pour gestion des déchets et poussière',
        },
      ],
    },
    {
      name: 'events',
      displayName: 'events',
      description: 'Matériel pour événements et réceptions',
      subcategories: [
        {
          name: 'sound',
          displayName: 'Sound',
          description: 'Outils audio pour événements',
        },
        {
          name: 'lighting',
          displayName: 'Lighting',
          description: 'Outils pour éclairage et contrôle de la lumière',
        },
        {
          name: 'cooking',
          displayName: 'Cooking',
          description: 'Outils pour la cuisine et le service',
        },
        {
          name: 'entertainment-games',
          displayName: 'Entertainment & Games',
          description: 'Outils pour animation et jeux',
        },
        {
          name: 'decoration',
          displayName: 'Decoration',
          description: 'Articles de décoration pour événements',
        },
        {
          name: 'furniture',
          displayName: 'Furniture',
          description: 'Outils pour mobilier et décoration',
        },
        {
          name: 'structure',
          displayName: 'Structure',
          description: 'Outils pour structure et construction',
        },
      ],
    },
  ];

  for (const categoryData of categoriesData) {
    let category = await categoryRepository.findOne({
      where: { name: categoryData.name },
    });

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
        where: { name: subcategoryData.name, categoryId: category.id },
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
