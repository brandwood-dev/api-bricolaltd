import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { UserSession } from '../users/entities/user-session.entity';
import { SecurityLog, SecurityEventType, SecuritySeverity } from './entities/security-log.entity';
import { BlockedIp, BlockReason } from './entities/blocked-ip.entity';
import { User } from '../users/entities/user.entity';

export interface SecurityLogFilters {
  eventType?: SecurityEventType;
  severity?: SecuritySeverity;
  userId?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  isResolved?: boolean;
}

export interface BlockIpDto {
  ipAddress: string;
  reason: BlockReason;
  description?: string;
  blockedBy?: string;
  expiresAt?: Date;
}

@Injectable()
export class AdminSecurityService {
  constructor(
    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,
    @InjectRepository(SecurityLog)
    private readonly securityLogRepository: Repository<SecurityLog>,
    @InjectRepository(BlockedIp)
    private readonly blockedIpRepository: Repository<BlockedIp>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // User Session Management
  async getAllSessions(): Promise<UserSession[]> {
    return this.userSessionRepository.find({
      relations: ['user'],
      where: { isActive: true },
      order: { lastActivityAt: 'DESC' },
    });
  }

  async getActiveSessionsCount(): Promise<number> {
    return this.userSessionRepository.count({
      where: { 
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return this.userSessionRepository.find({
      where: { userId, isActive: true },
      relations: ['user'],
      order: { lastActivityAt: 'DESC' },
    });
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = await this.userSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.isActive = false;
    await this.userSessionRepository.save(session);

    // Log the session termination
    await this.logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.LOGOUT,
      severity: SecuritySeverity.LOW,
      description: `Session terminated by admin`,
      ipAddress: session.ipAddress || undefined,
      sessionId: session.id,
    });
  }

  async terminateAllUserSessions(userId: string): Promise<void> {
    await this.userSessionRepository.update(
      { userId, isActive: true },
      { isActive: false }
    );

    await this.logSecurityEvent({
      userId,
      eventType: SecurityEventType.LOGOUT,
      severity: SecuritySeverity.MEDIUM,
      description: `All user sessions terminated by admin`,
    });
  }

  // Security Logs
  async getSecurityLogs(filters: SecurityLogFilters = {}, page = 1, limit = 50): Promise<{
    logs: SecurityLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.securityLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (filters.eventType) {
      queryBuilder.andWhere('log.eventType = :eventType', { eventType: filters.eventType });
    }

    if (filters.severity) {
      queryBuilder.andWhere('log.severity = :severity', { severity: filters.severity });
    }

    if (filters.userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId: filters.userId });
    }

    if (filters.ipAddress) {
      queryBuilder.andWhere('log.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
    }

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters.isResolved !== undefined) {
      queryBuilder.andWhere('log.isResolved = :isResolved', { isResolved: filters.isResolved });
    }

    const total = await queryBuilder.getCount();
    const logs = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async logSecurityEvent(eventData: {
    userId?: string;
    eventType: SecurityEventType;
    severity: SecuritySeverity;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    deviceType?: string;
    location?: string;
    resource?: string;
    method?: string;
    statusCode?: number;
    metadata?: string;
    sessionId?: string;
  }): Promise<SecurityLog> {
    const securityLog = this.securityLogRepository.create(eventData);
    return this.securityLogRepository.save(securityLog);
  }

  async resolveSecurityIncident(logId: string, resolvedBy: string, notes?: string): Promise<SecurityLog> {
    const log = await this.securityLogRepository.findOne({ where: { id: logId } });
    
    if (!log) {
      throw new NotFoundException('Security log not found');
    }

    log.isResolved = true;
    log.resolvedBy = resolvedBy;
    log.resolvedAt = new Date();
    if (notes) {
      log.notes = notes;
    }

    return this.securityLogRepository.save(log);
  }

  // IP Blocking
  async getBlockedIps(): Promise<BlockedIp[]> {
    return this.blockedIpRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async blockIp(blockData: BlockIpDto): Promise<BlockedIp> {
    const existingBlock = await this.blockedIpRepository.findOne({
      where: { ipAddress: blockData.ipAddress, isActive: true },
    });

    if (existingBlock) {
      throw new Error(`IP ${blockData.ipAddress} is already blocked`);
    }

    const blockedIp = this.blockedIpRepository.create(blockData);
    const saved = await this.blockedIpRepository.save(blockedIp);

    // Log the IP blocking event
    await this.logSecurityEvent({
      eventType: SecurityEventType.ADMIN_ACTION,
      severity: SecuritySeverity.MEDIUM,
      description: `IP ${blockData.ipAddress} blocked for reason: ${blockData.reason}`,
      ipAddress: blockData.ipAddress,
      metadata: JSON.stringify({ action: 'block_ip', reason: blockData.reason }),
    });

    return saved;
  }

  async unblockIp(ipAddress: string): Promise<void> {
    const blockedIp = await this.blockedIpRepository.findOne({
      where: { ipAddress, isActive: true },
    });

    if (!blockedIp) {
      throw new NotFoundException(`IP ${ipAddress} is not currently blocked`);
    }

    blockedIp.isActive = false;
    await this.blockedIpRepository.save(blockedIp);

    // Log the IP unblocking event
    await this.logSecurityEvent({
      eventType: SecurityEventType.ADMIN_ACTION,
      severity: SecuritySeverity.LOW,
      description: `IP ${ipAddress} unblocked`,
      ipAddress,
      metadata: JSON.stringify({ action: 'unblock_ip' }),
    });
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const blockedIp = await this.blockedIpRepository.findOne({
      where: { 
        ipAddress, 
        isActive: true,
      },
    });

    if (!blockedIp) {
      return false;
    }

    // Check if the block has expired
    if (blockedIp.expiresAt && blockedIp.expiresAt < new Date()) {
      blockedIp.isActive = false;
      await this.blockedIpRepository.save(blockedIp);
      return false;
    }

    // Update attempt count
    blockedIp.attemptCount += 1;
    blockedIp.lastAttemptAt = new Date();
    await this.blockedIpRepository.save(blockedIp);

    return true;
  }

  // Analytics
  async getSecurityAnalytics(days = 30): Promise<{
    totalLogs: number;
    criticalIncidents: number;
    resolvedIncidents: number;
    blockedIps: number;
    activeSessions: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalLogs, criticalIncidents, resolvedIncidents, blockedIps, activeSessions] = await Promise.all([
      this.securityLogRepository.count({
        where: { createdAt: MoreThan(startDate) },
      }),
      this.securityLogRepository.count({
        where: { 
          severity: SecuritySeverity.CRITICAL,
          createdAt: MoreThan(startDate),
        },
      }),
      this.securityLogRepository.count({
        where: { 
          isResolved: true,
          createdAt: MoreThan(startDate),
        },
      }),
      this.blockedIpRepository.count({ where: { isActive: true } }),
      this.getActiveSessionsCount(),
    ]);

    // Get events by type
    const eventsByTypeQuery = await this.securityLogRepository
      .createQueryBuilder('log')
      .select('log.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt > :startDate', { startDate })
      .groupBy('log.eventType')
      .getRawMany();

    const eventsByType = eventsByTypeQuery.reduce((acc, item) => {
      acc[item.eventType] = parseInt(item.count);
      return acc;
    }, {});

    // Get events by severity
    const eventsBySeverityQuery = await this.securityLogRepository
      .createQueryBuilder('log')
      .select('log.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt > :startDate', { startDate })
      .groupBy('log.severity')
      .getRawMany();

    const eventsBySeverity = eventsBySeverityQuery.reduce((acc, item) => {
      acc[item.severity] = parseInt(item.count);
      return acc;
    }, {});

    return {
      totalLogs,
      criticalIncidents,
      resolvedIncidents,
      blockedIps,
      activeSessions,
      eventsByType,
      eventsBySeverity,
    };
  }

  async getActiveSessions(page = 1, limit = 50): Promise<{
    sessions: UserSession[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [sessions, total] = await this.userSessionRepository.findAndCount({
      relations: ['user'],
      where: { isActive: true },
      order: { lastActivityAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async terminateUserSessions(userId: string): Promise<void> {
    const sessions = await this.userSessionRepository.find({
      where: { userId, isActive: true },
    });

    for (const session of sessions) {
      session.isActive = false;
      session.endedAt = new Date();
      await this.userSessionRepository.save(session);
    }

    // Log security event for session termination
    await this.logSecurityEvent({
      userId,
      eventType: SecurityEventType.SESSION_TERMINATED,
      severity: SecuritySeverity.MEDIUM,
      description: `All user sessions terminated for user ${userId}`,
      metadata: JSON.stringify({ sessionCount: sessions.length }),
    });
  }

  async getAdminActivities(adminId?: string, page = 1, limit = 50): Promise<{
    activities: SecurityLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const whereCondition: any = {
      eventType: SecurityEventType.ADMIN_ACTION,
    };

    if (adminId) {
      whereCondition.userId = adminId;
    }

    const [activities, total] = await this.securityLogRepository.findAndCount({
      where: whereCondition,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      activities,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFailedLogins(page = 1, limit = 50): Promise<{
    failedLogins: SecurityLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [failedLogins, total] = await this.securityLogRepository.findAndCount({
      where: { eventType: SecurityEventType.LOGIN_FAILED },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      failedLogins,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async blockIpAddress(ipAddress: string, reason: string): Promise<BlockedIp> {
    return this.blockIp({
      ipAddress,
      reason: reason as BlockReason,
      description: `IP blocked: ${reason}`,
    });
  }

  async unblockIpAddress(ipAddress: string): Promise<void> {
    await this.unblockIp(ipAddress);
  }

  async getSecurityOverview(): Promise<{
    totalLogs: number;
    criticalIncidents: number;
    resolvedIncidents: number;
    blockedIps: number;
    activeSessions: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
  }> {
    return this.getSecurityAnalytics();
  }
}