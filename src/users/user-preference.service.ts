import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './entities/user-preference.entity';
import { CreateUserPreferenceDto } from './dto/create-user-preference.dto';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';

@Injectable()
export class UserPreferenceService {
  constructor(
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
  ) {}

  async create(createUserPreferenceDto: CreateUserPreferenceDto): Promise<UserPreference> {
    // Check if user already has preferences
    const existingPreference = await this.userPreferenceRepository.findOne({
      where: { userId: createUserPreferenceDto.userId },
    });

    if (existingPreference) {
      throw new ConflictException('User preferences already exist');
    }

    const preference = this.userPreferenceRepository.create(createUserPreferenceDto);
    return await this.userPreferenceRepository.save(preference);
  }

  async findAll(): Promise<UserPreference[]> {
    return await this.userPreferenceRepository.find({
      relations: ['user'],
    });
  }

  async findOne(id: string): Promise<UserPreference> {
    const preference = await this.userPreferenceRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!preference) {
      throw new NotFoundException(`User preference with ID ${id} not found`);
    }

    return preference;
  }

  async findByUserId(userId: string): Promise<UserPreference> {
    const preference = await this.userPreferenceRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!preference) {
      throw new NotFoundException(`User preferences for user ${userId} not found`);
    }

    return preference;
  }

  async update(id: string, updateUserPreferenceDto: UpdateUserPreferenceDto): Promise<UserPreference> {
    const preference = await this.findOne(id);
    
    Object.assign(preference, updateUserPreferenceDto);
    return await this.userPreferenceRepository.save(preference);
  }

  async updateByUserId(userId: string, updateUserPreferenceDto: UpdateUserPreferenceDto): Promise<UserPreference> {
    const preference = await this.findByUserId(userId);
    
    Object.assign(preference, updateUserPreferenceDto);
    return await this.userPreferenceRepository.save(preference);
  }

  async remove(id: string): Promise<void> {
    const preference = await this.findOne(id);
    await this.userPreferenceRepository.remove(preference);
  }

  async removeByUserId(userId: string): Promise<void> {
    const preference = await this.findByUserId(userId);
    await this.userPreferenceRepository.remove(preference);
  }

  async getNotificationSettings(userId: string): Promise<{
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
  }> {
    const preference = await this.findByUserId(userId);
    return {
      emailNotifications: preference.emailNotifications,
      pushNotifications: preference.pushNotifications,
      smsNotifications: preference.smsNotifications,
      marketingEmails: preference.marketingEmails,
    };
  }

  async updateNotificationSettings(userId: string, settings: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    marketingEmails?: boolean;
  }): Promise<UserPreference> {
    return await this.updateByUserId(userId, settings);
  }
}