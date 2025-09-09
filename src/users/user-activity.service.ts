import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivity } from './entities/user-activity.entity';
import { CreateUserActivityDto } from './dto/create-user-activity.dto';
import { UpdateUserActivityDto } from './dto/update-user-activity.dto';
import { ActivityType } from './enums/activity-type.enum';

@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivity)
    private userActivityRepository: Repository<UserActivity>,
  ) {}

  async create(createUserActivityDto: CreateUserActivityDto): Promise<UserActivity> {
    const activity = this.userActivityRepository.create(createUserActivityDto);
    return this.userActivityRepository.save(activity);
  }

  async findAll(): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<UserActivity> {
    const activity = await this.userActivityRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    
    if (!activity) {
      throw new NotFoundException(`User activity with ID ${id} not found`);
    }
    
    return activity;
  }

  async findByUserId(userId: string): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByActivityType(activityType: ActivityType): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { activityType },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateUserActivityDto: UpdateUserActivityDto): Promise<UserActivity> {
    const activity = await this.findOne(id);
    Object.assign(activity, updateUserActivityDto);
    return this.userActivityRepository.save(activity);
  }

  async remove(id: string): Promise<void> {
    const activity = await this.findOne(id);
    await this.userActivityRepository.remove(activity);
  }

  // Helper method to log user activities
  async logActivity(
    userId: string,
    activityType: ActivityType,
    description?: string,
    ipAddress?: string,
    userAgent?: string,
    relatedId?: string,
    relatedType?: string,
    metadata?: string
  ): Promise<UserActivity> {
    const createDto: CreateUserActivityDto = {
      userId,
      activityType,
      description,
      ipAddress,
      userAgent,
      relatedId,
      relatedType,
      metadata,
    };
    
    return this.create(createDto);
  }

  // Get activity statistics
  async getActivityStats(userId?: string): Promise<any> {
    const queryBuilder = this.userActivityRepository.createQueryBuilder('activity');
    
    if (userId) {
      queryBuilder.where('activity.userId = :userId', { userId });
    }
    
    const stats = await queryBuilder
      .select('activity.activityType', 'activityType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('activity.activityType')
      .getRawMany();
    
    return stats;
  }

  // Get recent activities
  async getRecentActivities(limit: number = 50, userId?: string): Promise<UserActivity[]> {
    const queryBuilder = this.userActivityRepository.createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit);
    
    if (userId) {
      queryBuilder.where('activity.userId = :userId', { userId });
    }
    
    return queryBuilder.getMany();
  }
}