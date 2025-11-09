import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Between } from 'typeorm';
import { Tool } from '../tools/entities/tool.entity';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../categories/entities/subcategory.entity';
import { User } from '../users/entities/user.entity';
import { ToolStatus } from '../tools/enums/tool-status.enum';
import { ModerationStatus } from '../tools/enums/moderation-status.enum';
import { UpdateToolStatusDto } from './dto/update-tool-status.dto';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationPriority } from './dto/admin-notifications.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/enums/notification-type';
import { SendGridService } from '../emails/sendgrid.service';
import { ToolRejectionEmailService } from '../tools/services/tool-rejection-email.service';
import { CreateToolDto } from '../tools/dto/create-tool.dto';
import { ToolCondition } from '../tools/enums/tool-condition.enum';
import { EmailsService } from '../emails/emails.service';

export interface AdminToolFilters {
  search?: string;
  status?: string;
  categoryId?: string;
  subcategoryId?: string;
  ownerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class AdminToolsService {
  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Subcategory)
    private subcategoryRepository: Repository<Subcategory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly adminNotificationsService: AdminNotificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly sendGridService: SendGridService,
    private readonly toolRejectionEmailService: ToolRejectionEmailService,
    private readonly emailsService: EmailsService,
  ) {}

  async findAllForAdmin(
    filters: AdminToolFilters,
    pagination: PaginationOptions,
  ) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.createFilteredQuery(filters);

    queryBuilder
      .leftJoinAndSelect('tool.category', 'category')
      .leftJoinAndSelect('tool.subcategory', 'subcategory')
      .leftJoinAndSelect('tool.owner', 'owner')
      .leftJoinAndSelect('tool.photos', 'photos')
      .select([
        'tool.id',
        'tool.title',
        'tool.description',
        'tool.brand',
        'tool.model',
        'tool.condition',
        'tool.basePrice',
        'tool.depositAmount',
        'tool.imageUrl',
        'tool.toolStatus',
        'tool.availabilityStatus',
        'tool.moderationStatus',
        'tool.createdAt',
        'tool.updatedAt',
        'tool.publishedAt',
        'category.id',
        'category.name',
        'subcategory.id',
        'subcategory.name',
        'owner.id',
        'owner.firstName',
        'owner.lastName',
        'owner.email',
        'photos.id',
        'photos.url',
        'photos.isPrimary',
        'photos.createdAt',
      ])
      .addOrderBy('photos.isPrimary', 'DESC')
      .addOrderBy('photos.createdAt', 'ASC')
      .orderBy('tool.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [tools, total] = await queryBuilder.getManyAndCount();

    return {
      data: tools,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForAdmin(id: string): Promise<Tool> {
    const tool = await this.toolRepository.findOne({
      where: { id },
      relations: [
        'category',
        'subcategory',
        'owner',
        'bookings',
        'bookings.renter',
        'photos',
      ],
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    return tool;
  }

  async getToolStats() {
    const [
      total,
      published,
      underReview,
      archived,
      draft,
      moderationPending,
      moderationConfirmed,
      moderationRejected,
    ] = await Promise.all([
      this.toolRepository.count(),
      this.toolRepository.count({
        where: { toolStatus: ToolStatus.PUBLISHED },
      }),
      this.toolRepository.count({
        where: { toolStatus: ToolStatus.UNDER_REVIEW },
      }),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.ARCHIVED } }),
      this.toolRepository.count({ where: { toolStatus: ToolStatus.DRAFT } }),
      this.toolRepository.count({
        where: { moderationStatus: ModerationStatus.PENDING },
      }),
      this.toolRepository.count({
        where: { moderationStatus: ModerationStatus.CONFIRMED },
      }),
      this.toolRepository.count({
        where: { moderationStatus: ModerationStatus.REJECTED },
      }),
    ]);

    return {
      total,
      published,
      underReview,
      archived,
      draft,
      moderationPending,
      moderationConfirmed,
      moderationRejected,
    };
  }

  async approveTool(id: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);

    if (tool.toolStatus === ToolStatus.PUBLISHED) {
      throw new BadRequestException('Tool is already approved');
    }

    tool.toolStatus = ToolStatus.PUBLISHED;
    tool.publishedAt = new Date();
    tool.moderationStatus = ModerationStatus.CONFIRMED;

    const saved = await this.toolRepository.save(tool);
    // Notify admins of moderation approval
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil approuvé',
        `L'outil "${saved.title}" a été approuvé.`,
        saved.owner?.id,
        saved.owner
          ? `${saved.owner.firstName} ${saved.owner.lastName}`
          : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return saved;
  }

  async rejectTool(id: string, reason: string): Promise<Tool> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const tool = await this.findOneForAdmin(id);

    if (tool.moderationStatus === ModerationStatus.REJECTED) {
      throw new BadRequestException('Tool is already rejected');
    }

    tool.toolStatus = ToolStatus.DRAFT;
    tool.moderationStatus = ModerationStatus.REJECTED;
    tool.rejectionReason = reason.trim();

    const saved = await this.toolRepository.save(tool);
    // Notify admins of moderation rejection
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil rejeté',
        `L'outil "${saved.title}" a été rejeté. Raison: ${saved.rejectionReason}.`,
        saved.owner?.id,
        saved.owner
          ? `${saved.owner.firstName} ${saved.owner.lastName}`
          : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}

    // Notify tool owner (in-app + websocket + email)
    try {
      const ownerId = saved.owner?.id;
      const ownerEmail = saved.owner?.email;
      const ownerName = saved.owner ? `${saved.owner.firstName} ${saved.owner.lastName}` : undefined;

      if (ownerId) {
        // In-app notification
        const userNotification = await this.notificationsService.createSystemNotification(
          ownerId,
          NotificationType.TOOL_REJECTED,
          'Outil rejeté',
          `Votre outil "${saved.title}" a été rejeté. Raison: ${saved.rejectionReason}.`,
          saved.id,
          'tool',
          `/tools/${saved.id}`,
        );

        // WebSocket push to user
        await this.notificationsGateway.sendNotificationToUser(ownerId, userNotification);
      }

      // Email notification (if email present)
      if (ownerEmail) {
        const template = this.toolRejectionEmailService.getRejectionEmailTemplate(
          saved.rejectionReason || '',
          saved.owner?.firstName,
          saved.title,
          process.env.FRONTEND_URL,
        );

        await this.sendGridService.sendEmail({
          to: ownerEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
          userId: ownerId,
        });
      }
    } catch {}
    return saved;
  }

  // Test routine to create a tool, run rejections for 6 templates, and verify notifications/emails
  async runRejectionTemplatesTest(ownerEmail: string, ownerId?: string) {
    const results: any[] = [];
    // Ensure owner exists
    let owner = ownerId ? await this.userRepository.findOne({ where: { id: ownerId } }) : await this.userRepository.findOne({ where: { email: ownerEmail } });
    if (!owner) {
      throw new NotFoundException('Owner user not found for provided email');
    }

    // Prepare minimal valid tool DTO; pick first category/subcategory
    const category = await this.categoryRepository.findOne({});
    const subcategory = await this.subcategoryRepository.findOne({});
    if (!category || !subcategory) {
      throw new NotFoundException('Category/Subcategory not found to create test tool');
    }

    const reasons = [
      'Incomplete Information',
      'Non-Compliant Price',
      'Poor Quality Photos',
      'Insufficient Description',
      'Inappropriate Content',
      'False or Misleading Information',
    ];

    for (const reason of reasons) {
      // create a fresh tool for each rejection
      const createDto: CreateToolDto = {
        title: `Test Tool ${reason} ${Date.now()}`,
        description: 'Test description',
        basePrice: 10,
        depositAmount: 50,
        condition: ToolCondition.GOOD,
        pickupAddress: '123 Test St',
        categoryId: category.id,
        subcategoryId: subcategory.id,
        ownerId: owner.id,
      } as any;
      const tool = await this.toolRepository.save(this.toolRepository.create(createDto));

      const rejected = await this.rejectTool(tool.id, reason);
      const inAppNotification = await this.notificationsService.findByUserId(owner.id, 1, 10);
      const lastWsNotification = this.notificationsGateway.getLastNotificationForUser(owner.id);
      const template = this.toolRejectionEmailService.getRejectionEmailTemplate(reason, owner.firstName, rejected.title, process.env.FRONTEND_URL);
      // verify persisted email log for owner
      const emailsForUser = await this.emailsService.findByUser(owner.id);
      const latestEmail = emailsForUser[0];
      const emailMatchesTemplate = latestEmail ? latestEmail.subject === template.subject : false;

      results.push({
        reason,
        emailSubject: template.subject,
        emailLogged: !!latestEmail,
        emailMatchesTemplate,
        linkUsesFrontendUrl: (template.html.includes((process.env.FRONTEND_URL || 'http://localhost:3000') + '/tools')),
        inAppCount: inAppNotification.total,
        lastWsNotification: lastWsNotification ? { title: lastWsNotification?.title, message: lastWsNotification?.message } : null,
      });
    }

    return {
      data: results,
      message: 'Rejection templates test completed',
    };
  }

  async updateToolStatus(
    id: string,
    updateDto: UpdateToolStatusDto,
  ): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);

    if (updateDto.status) {
      tool.toolStatus = updateDto.status;

      if (updateDto.status === ToolStatus.PUBLISHED) {
        tool.publishedAt = new Date();
        tool.moderationStatus = ModerationStatus.CONFIRMED;
      }
    }

    const saved = await this.toolRepository.save(tool);
    // Notify admins of status update
    try {
      await this.adminNotificationsService.createUserNotification(
        "Statut de l'outil mis à jour",
        `Le statut de l'outil "${saved.title}" a été mis à jour à ${saved.toolStatus}.`,
        saved.owner?.id,
        saved.owner
          ? `${saved.owner.firstName} ${saved.owner.lastName}`
          : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return saved;
  }

  async deleteTool(id: string): Promise<{ message: string }> {
    const tool = await this.findOneForAdmin(id);

    // Check if tool has active bookings
    const activeBookings = await this.toolRepository
      .createQueryBuilder('tool')
      .leftJoin('tool.bookings', 'booking')
      .where('tool.id = :id', { id })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['confirmed', 'in_progress'],
      })
      .getCount();

    if (activeBookings > 0) {
      throw new BadRequestException('Cannot delete tool with active bookings');
    }

    await this.toolRepository.remove(tool);
    // Notify admins of deletion
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil supprimé',
        `L'outil "${tool.title}" a été supprimé par un administrateur.`,
        tool.owner?.id,
        tool.owner
          ? `${tool.owner.firstName} ${tool.owner.lastName}`
          : undefined,
        NotificationPriority.HIGH,
      );
    } catch {}
    return { message: 'Tool deleted successfully' };
  }

  async archiveTool(id: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);

    if (tool.toolStatus === ToolStatus.ARCHIVED) {
      throw new BadRequestException('Tool is already archived');
    }

    tool.toolStatus = ToolStatus.ARCHIVED;
    tool.moderationStatus = ModerationStatus.CONFIRMED;

    const saved = await this.toolRepository.save(tool);
    // Notify admins of archiving
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil archivé',
        `L'outil "${saved.title}" a été archivé.`,
        saved.owner?.id,
        saved.owner
          ? `${saved.owner.firstName} ${saved.owner.lastName}`
          : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return saved;
  }

  async restoreTool(id: string): Promise<Tool> {
    const tool = await this.findOneForAdmin(id);

    if (tool.toolStatus !== ToolStatus.ARCHIVED) {
      throw new BadRequestException('Only archived tools can be restored');
    }

    tool.toolStatus = ToolStatus.PUBLISHED;
    tool.moderationStatus = ModerationStatus.CONFIRMED;
    tool.publishedAt = new Date();

    const saved = await this.toolRepository.save(tool);
    // Notify admins of restoration
    try {
      await this.adminNotificationsService.createUserNotification(
        'Outil restauré',
        `L'outil "${saved.title}" a été restauré et republié.`,
        saved.owner?.id,
        saved.owner
          ? `${saved.owner.firstName} ${saved.owner.lastName}`
          : undefined,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return saved;
  }

  private createFilteredQuery(
    filters: AdminToolFilters,
  ): SelectQueryBuilder<Tool> {
    const queryBuilder = this.toolRepository.createQueryBuilder('tool');

    if (filters.search) {
      queryBuilder.andWhere(
        '(LOWER(tool.title) LIKE LOWER(:search) OR LOWER(tool.description) LIKE LOWER(:search) OR LOWER(tool.brand) LIKE LOWER(:search))',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.status) {
      queryBuilder.andWhere('tool.toolStatus = :status', {
        status: filters.status,
      });
    }

    if (filters.categoryId) {
      queryBuilder.andWhere('tool.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.subcategoryId) {
      queryBuilder.andWhere('tool.subcategoryId = :subcategoryId', {
        subcategoryId: filters.subcategoryId,
      });
    }

    if (filters.ownerId) {
      queryBuilder.andWhere('tool.ownerId = :ownerId', {
        ownerId: filters.ownerId,
      });
    }

    if (filters.dateFrom && filters.dateTo) {
      queryBuilder.andWhere('tool.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    } else if (filters.dateFrom) {
      queryBuilder.andWhere('tool.createdAt >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    } else if (filters.dateTo) {
      queryBuilder.andWhere('tool.createdAt <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    return queryBuilder;
  }
}
