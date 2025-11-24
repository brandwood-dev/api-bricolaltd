import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UserSession } from './entities/user-session.entity';
import { CreateUserSessionDto } from './dto/create-user-session.dto';
import { UpdateUserSessionDto } from './dto/update-user-session.dto';

@Injectable()
export class UserSessionService {
  constructor(
    @InjectRepository(UserSession)
    private userSessionRepository: Repository<UserSession>,
  ) {}

  async create(
    createUserSessionDto: CreateUserSessionDto,
  ): Promise<UserSession> {
    const userSession = this.userSessionRepository.create({
      ...createUserSessionDto,
      lastActivityAt: new Date(),
    });
    return this.userSessionRepository.save(userSession);
  }

  async findAllByUser(userId: string): Promise<UserSession[]> {
    return this.userSessionRepository.find({
      where: {
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
      order: { lastActivityAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<UserSession> {
    const session = await this.userSessionRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!session) {
      throw new NotFoundException(`User session with ID ${id} not found`);
    }
    return session;
  }

  async findByToken(token: string): Promise<UserSession | null> {
    return this.userSessionRepository.findOne({
      where: { token, isActive: true },
      relations: ['user'],
    });
  }

  async update(
    id: string,
    updateUserSessionDto: UpdateUserSessionDto,
  ): Promise<UserSession> {
    const session = await this.findOne(id);
    Object.assign(session, updateUserSessionDto);
    return this.userSessionRepository.save(session);
  }

  async updateActivity(id: string): Promise<UserSession> {
    const session = await this.findOne(id);
    session.lastActivityAt = new Date();
    return this.userSessionRepository.save(session);
  }

  async revokeSession(id: string, currentUserId: string): Promise<void> {
    const session = await this.findOne(id);

    // Users can only revoke their own sessions
    if (session.userId !== currentUserId) {
      throw new ForbiddenException('You can only revoke your own sessions');
    }

    session.isActive = false;
    await this.userSessionRepository.save(session);
  }

  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<void> {
    const query = this.userSessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ isActive: false })
      .where('userId = :userId', { userId });

    if (exceptSessionId) {
      query.andWhere('id != :exceptSessionId', { exceptSessionId });
    }

    await query.execute();
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.userSessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ isActive: false })
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }

  async getActiveSessionsCount(userId: string): Promise<number> {
    return this.userSessionRepository.count({
      where: {
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const session = await this.findOne(id);
    await this.userSessionRepository.remove(session);
  }
}
