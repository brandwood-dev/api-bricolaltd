import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './entities/bookmark.entity';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { ToolsService } from '../tools/tools.service';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private bookmarksRepository: Repository<Bookmark>,
    private readonly toolsService: ToolsService,
  ) {}

  async findByUser(userId: string): Promise<Bookmark[]> {
    console.log('📚 BookmarksService.findByUser - Recherche des favoris pour userId:', userId);
    
    const bookmarks = await this.bookmarksRepository.find({
      where: { userId },
      relations: {
        tool: {
          photos: true,
          category: true,
          subcategory: true,
          owner: true,
        },
      },
      order: {
        createdAt: 'DESC',
        tool: {
          photos: {
            isPrimary: 'DESC',
            createdAt: 'ASC',
          },
        },
      },
    });
    
    console.log('📚 BookmarksService.findByUser - Favoris trouvés:', bookmarks.length, 'pour userId:', userId);
    console.log('📚 BookmarksService.findByUser - Détails des favoris:', bookmarks.map(b => ({ id: b.id, userId: b.userId, toolId: b.toolId, createdAt: b.createdAt })));
    
    // Calculer les ratings et reviewCount pour chaque outil
    for (const bookmark of bookmarks) {
      if (bookmark.tool) {
        const ratingData = await this.toolsService.calculateToolRating(bookmark.tool.id);
        Object.assign(bookmark.tool, ratingData);
      }
    }
    
    return bookmarks;
  }

  async removeByUserAndTool(userId: string, toolId: string): Promise<void> {
    console.log('🗑️ BookmarksService.removeByUserAndTool - Suppression favori userId:', userId, 'toolId:', toolId);
    
    const bookmark = await this.bookmarksRepository.findOne({
      where: {
        userId,
        toolId,
      },
    });

    if (!bookmark) {
      console.log('❌ BookmarksService.removeByUserAndTool - Favori non trouvé pour userId:', userId, 'toolId:', toolId);
      throw new NotFoundException(`Bookmark not found`);
    }

    console.log('🗑️ BookmarksService.removeByUserAndTool - Favori trouvé, suppression en cours:', bookmark.id);
    await this.bookmarksRepository.remove(bookmark);
    console.log('✅ BookmarksService.removeByUserAndTool - Favori supprimé avec succès:', bookmark.id);
  }

  async create(createBookmarkDto: CreateBookmarkDto): Promise<Bookmark> {
    const { userId, toolId } = createBookmarkDto;
    console.log('➕ BookmarksService.create - Création nouveau favori userId:', userId, 'toolId:', toolId);
    console.log('➕ BookmarksService.create - DTO reçu:', createBookmarkDto);
    
    // Vérifier si le favori existe déjà
    const existingBookmark = await this.bookmarksRepository.findOne({
      where: { userId, toolId }
    });
    
    if (existingBookmark) {
      console.log('⚠️ BookmarksService.create - Favori existe déjà:', existingBookmark.id);
      return existingBookmark;
    }
    
    const bookmark = this.bookmarksRepository.create({
      userId,
      toolId,
    });
    
    console.log('➕ BookmarksService.create - Entité bookmark créée:', bookmark);
    
    const savedBookmark = await this.bookmarksRepository.save(bookmark);
    console.log('✅ BookmarksService.create - Favori sauvegardé avec succès:', savedBookmark.id, 'userId:', savedBookmark.userId, 'toolId:', savedBookmark.toolId);
    
    return savedBookmark;
  }
}
