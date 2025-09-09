import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentType } from './enums/document-type.enum';

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentsService {
  private readonly uploadsFolder = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsFolder)) {
      fs.mkdirSync(this.uploadsFolder, { recursive: true });
    }
  }

  async create(
    createDocumentDto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(this.uploadsFolder, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const document = this.documentsRepository.create({
      ...createDocumentDto,
      type: createDocumentDto.type as DocumentType, // ✅ cast to enum
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: `uploads/${fileName}`,
    });

    return this.documentsRepository.save(document);
  }

  async findAll(): Promise<Document[]> {
    return this.documentsRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async findByUserId(userId: string): Promise<Document[]> {
    return this.documentsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<Document> {
    const document = await this.findOne(id);

    // If a new file is provided, update the file
    if (file) {
      // Delete old file if it exists
      const oldFilePath = path.join(this.uploadsFolder, document.fileName);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      // Save new file
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadsFolder, fileName);

      fs.writeFileSync(filePath, file.buffer);

      // Update document properties
      document.fileName = fileName;
      document.originalName = file.originalname;
      document.mimeType = file.mimetype;
      document.size = file.size;
      document.path = `uploads/${fileName}`;
    }

    // Update other properties
    if (updateDocumentDto.type) {
      document.type = updateDocumentDto.type as DocumentType;
    }

    if (updateDocumentDto.description) {
      document.description = updateDocumentDto.description;
    }

    return this.documentsRepository.save(document);
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);

    // Delete file from disk
    const filePath = path.join(this.uploadsFolder, document.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.documentsRepository.remove(document);
  }
}
