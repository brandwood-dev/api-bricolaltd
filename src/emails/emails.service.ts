import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './entities/email.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';

@Injectable()
export class EmailsService {
  constructor(
    @InjectRepository(Email)
    private emailsRepository: Repository<Email>,
  ) {}

  async create(createEmailDto: CreateEmailDto): Promise<Email> {
    const email = this.emailsRepository.create(createEmailDto);
    email.sentAt = new Date();
    return this.emailsRepository.save(email);
  }

  async findAll(): Promise<Email[]> {
    return this.emailsRepository.find({
      order: { sentAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Email> {
    const email = await this.emailsRepository.findOne({ where: { id } });
    if (!email) {
      throw new NotFoundException(`Email with ID ${id} not found`);
    }
    return email;
  }

  async findByUser(userId: string): Promise<Email[]> {
    return this.emailsRepository.find({
      where: { userId },
      order: { sentAt: 'DESC' },
    });
  }

  async update(id: string, updateEmailDto: UpdateEmailDto): Promise<Email> {
    const email = await this.findOne(id);
    Object.assign(email, updateEmailDto);
    return this.emailsRepository.save(email);
  }

  async remove(id: string): Promise<void> {
    const result = await this.emailsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Email with ID ${id} not found`);
    }
  }

  // Additional methods for email functionality
  
  async markAsRead(id: string): Promise<Email> {
    const email = await this.findOne(id);
    email.isRead = true;
    return this.emailsRepository.save(email);
  }

  async markAsUnread(id: string): Promise<Email> {
    const email = await this.findOne(id);
    email.isRead = false;
    return this.emailsRepository.save(email);
  }

  async findUnreadByUser(userId: string): Promise<Email[]> {
    return this.emailsRepository.find({
      where: { userId, isRead: false },
      order: { sentAt: 'DESC' },
    });
  }
}