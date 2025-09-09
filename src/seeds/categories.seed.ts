import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';

export async function seedCategories(dataSource: DataSource) {
  console.log('🏷️ Seeding categories and subcategories...');
  
  const categoryRepository = dataSource.getRepository(Category);
  const subcategoryRepository = dataSource.getRepository(Subcategory);
  
  const categoriesData = [
    {
      name: 'Outils de jardinage',
      displayName: 'Outils de jardinage',
      description: 'Outils pour l\'entretien du jardin',
      subcategories: [
        { name: 'Tondeuses', displayName: 'Tondeuses', description: 'Tondeuses à gazon électriques et thermiques' },
        { name: 'Taille-haies', displayName: 'Taille-haies', description: 'Outils de taille pour haies et arbustes' },
        { name: 'Bêches et pelles', displayName: 'Bêches et pelles', description: 'Outils de terrassement manuel' },
        { name: 'Arrosage', displayName: 'Arrosage', description: 'Systèmes d\'arrosage et tuyaux' },
      ]
    },
    {
      name: 'Outils de bricolage',
      displayName: 'Outils de bricolage',
      description: 'Outils pour travaux de bricolage',
      subcategories: [
        { name: 'Perceuses', displayName: 'Perceuses', description: 'Perceuses électriques et sans fil' },
        { name: 'Scies', displayName: 'Scies', description: 'Scies circulaires, sauteuses et à métaux' },
        { name: 'Ponceuses', displayName: 'Ponceuses', description: 'Ponceuses orbitales et à bande' },
        { name: 'Marteaux', displayName: 'Marteaux', description: 'Marteaux et masses diverses' },
      ]
    },
    {
      name: 'Électroménager',
      displayName: 'Électroménager',
      description: 'Appareils électroménagers',
      subcategories: [
        { name: 'Nettoyage', displayName: 'Nettoyage', description: 'Aspirateurs et nettoyeurs haute pression' },
        { name: 'Cuisine', displayName: 'Cuisine', description: 'Robots culinaires et appareils de cuisine' },
        { name: 'Entretien', displayName: 'Entretien', description: 'Fers à repasser et appareils d\'entretien' },
      ]
    },
    {
      name: 'Matériel de transport',
      displayName: 'Matériel de transport',
      description: 'Véhicules et matériel de transport',
      subcategories: [
        { name: 'Remorques', displayName: 'Remorques', description: 'Remorques pour voiture' },
        { name: 'Diables', displayName: 'Diables', description: 'Diables et sangles de transport' },
        { name: 'Échelles', displayName: 'Échelles', description: 'Échelles et escabeaux' },
      ]
    }
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