import { DataSource } from 'typeorm';
import { Bookmark } from '../bookmarks/entities/bookmark.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { faker } from '@faker-js/faker';

export async function seedBookmarks(dataSource: DataSource) {
  console.log('🔖 Seeding bookmarks...');

  const bookmarkRepository = dataSource.getRepository(Bookmark);
  const userRepository = dataSource.getRepository(User);
  const toolRepository = dataSource.getRepository(Tool);

  const users = await userRepository.find({ where: { isAdmin: false } });
  const tools = await toolRepository.find();

  if (users.length === 0 || tools.length === 0) {
    console.log('⚠️ No users or tools found, skipping bookmarks seeding');
    return;
  }

  // Generate 200 realistic bookmarks
  for (let i = 0; i < 200; i++) {
    const user = faker.helpers.arrayElement(users);
    const tool = faker.helpers.arrayElement(tools);

    // Don't let users bookmark their own tools
    if (tool.ownerId === user.id) {
      continue;
    }

    const existingBookmark = await bookmarkRepository.findOne({
      where: {
        userId: user.id,
        toolId: tool.id,
      },
    });

    if (!existingBookmark) {
      const bookmark = bookmarkRepository.create({
        user,
        userId: user.id,
        tool,
        toolId: tool.id,
        createdAt: faker.date.recent({ days: 90 }),
      });
      await bookmarkRepository.save(bookmark);
    }
  }

  console.log('✅ Bookmarks seeded successfully');
}
