import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { WiseService } from './wise-enhanced.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';
import { Wallet } from './entities/wallet.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type';
import { NotificationsGateway } from '../notifications/notifications.gateway';

export interface WiseWebhookEvent {
  data?: {
    resource?: {
      id?: string | number;
      type?: string;
      status?: string;
      state?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  event_type?: string;
  event_time?: string;
  subscription_id?: string;
  [key: string]: any;
}

export enum WiseEventType {
  TRANSFER_STATUS_CHANGE = 'transfers#state-change',
  TRANSFER_PROBLEM = 'transfers#active-cases',
  BALANCE_CREDIT = 'balances#credit',
  BALANCE_DEBIT = 'balances#debit',
  RECIPIENT_CREATED = 'recipient#created',
  RECIPIENT_UPDATED = 'recipient#updated',
  QUOTE_EXPIRED = 'quote#expired',
}

@Injectable()
export class WiseWebhookService {
  private readonly logger = new Logger(WiseWebhookService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly wiseService: WiseService,
    private readonly adminNotificationsService: AdminNotificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Process incoming Wise webhook event
   */
  async processWebhook(
    event: WiseWebhookEvent,
  ): Promise<{ status: string; message: string }> {
    try {
      const eventType = event?.event_type || 'unknown';
      const resource = this.extractResource(event);
      const resourceId = this.extractTransferId(resource);
      const resourceStatus = this.extractTransferStatus(resource, event);

      this.logger.log(`Processing Wise webhook: ${eventType}`, {
        eventType,
        resourceId,
        resourceStatus,
      });

      if (!resource || !resourceId) {
        this.logger.warn('Invalid webhook payload - missing resource or ID');
        return { status: 'ignored', message: 'Missing resource or ID' };
      }

      // Handle different event types
      switch (eventType) {
        case WiseEventType.TRANSFER_STATUS_CHANGE:
          return await this.handleTransferStatusChange(resource, event);

        case WiseEventType.TRANSFER_PROBLEM:
          return await this.handleTransferProblem(resource, event);

        case WiseEventType.BALANCE_CREDIT:
          return await this.handleBalanceCredit(resource);

        case WiseEventType.BALANCE_DEBIT:
          return await this.handleBalanceDebit(resource);

        case WiseEventType.RECIPIENT_CREATED:
          return await this.handleRecipientCreated(resource);

        case WiseEventType.RECIPIENT_UPDATED:
          return await this.handleRecipientUpdated(resource);

        case WiseEventType.QUOTE_EXPIRED:
          return await this.handleQuoteExpired(resource);

        default:
          this.logger.log(`Unhandled Wise event type: ${eventType}`);
          return {
            status: 'ignored',
            message: `Unhandled event type: ${eventType}`,
          };
      }
    } catch (error) {
      this.logger.error('Failed to process Wise webhook:', error);

      // Create admin notification for webhook processing failure
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Webhook Processing Failed',
        message: `Failed to process Wise webhook: ${error.message}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.PAYMENT,
      });

      return { status: 'error', message: 'Webhook processing failed' };
    }
  }

  /**
   * Handle transfer status changes
   */
  private async handleTransferStatusChange(
    resource: any,
    event?: WiseWebhookEvent,
  ): Promise<{ status: string; message: string }> {
    const transferId = this.extractTransferId(resource);
    let status = this.extractTransferStatus(resource, event);

    if (transferId && !status) {
      try {
        const transfer = await this.wiseService.getTransfer(transferId);
        status = this.extractTransferStatus(transfer);
        this.logger.log(`Resolved Wise transfer status from API`, {
          transferId,
          resolvedStatus: status,
        });
      } catch (error) {
        this.logger.warn(`Failed to resolve Wise transfer status from API`, {
          transferId,
          error: error?.message || String(error),
        });
      }
    }

    if (!transferId || !status) {
      this.logger.warn(
        'Invalid transfer status change - missing required fields',
      );
      return { status: 'ignored', message: 'Missing transfer ID or status' };
    }

    // Find transaction by Wise transfer ID
    const transaction = await this.transactionRepository.findOne({
      where: [
        { externalReference: String(transferId) },
        { wizeTransferId: String(transferId) },
      ],
      relations: ['wallet', 'sender', 'recipient'],
    });

    if (!transaction) {
      this.logger.warn(
        `No transaction found for Wise transfer ID: ${transferId}`,
      );
      return { status: 'ignored', message: 'Transaction not found' };
    }

    this.logger.log(
      `Updating transaction ${transaction.id} with Wise status: ${status}`,
    );

    // Update transaction based on Wise status
    switch (status) {
      case 'incoming_payment_waiting':
      case 'processing':
        transaction.status = TransactionStatus.PROCESSING;
        break;

      case 'funds_converted':
        transaction.status = TransactionStatus.PROCESSING;
        break;

      case 'outgoing_payment_sent':
      case 'completed':
        await this.finalizeCompletedWithdrawal(transaction);
        break;

      case 'cancelled':
      case 'bounced_back':
      case 'funds_refunded':
        transaction.status = TransactionStatus.FAILED;
        break;

      default:
        this.logger.warn(`Unknown Wise transfer status: ${status}`);
        transaction.status = TransactionStatus.PROCESSING;
    }

    // Update Wise-specific fields
    transaction.wizeStatus = status;
    transaction.wizeResponse = resource;

    await this.transactionRepository.save(transaction);

    // Create admin notification for important status changes
    if (
      [
        'completed',
        'outgoing_payment_sent',
        'cancelled',
        'bounced_back',
        'funds_refunded',
      ].includes(
        status,
      )
    ) {
      await this.createTransferStatusNotification(transaction, status);
    }

    return {
      status: 'processed',
      message: `Transfer status updated to ${status}`,
    };
  }

  /**
   * Handle transfer problems (delays, compliance issues, etc.)
   */
  private async handleTransferProblem(
    resource: any,
    event?: WiseWebhookEvent,
  ): Promise<{ status: string; message: string }> {
    const transferId = this.extractTransferId(resource);
    const status =
      this.extractTransferStatus(resource, event) || 'active_cases';
    const activeCases = this.extractActiveCases(resource);

    this.logger.warn(`Transfer problem detected for ${transferId}:`, {
      status,
      activeCases,
    });

    const transaction = await this.transactionRepository.findOne({
      where: [
        { externalReference: String(transferId) },
        { wizeTransferId: String(transferId) },
      ],
    });

    if (!transaction) {
      return { status: 'ignored', message: 'Transaction not found' };
    }

    // Update transaction with problem information
    transaction.status = TransactionStatus.PROCESSING;
    transaction.wizeStatus = status;
    transaction.wizeResponse = resource;

    await this.transactionRepository.save(transaction);

    // Create admin notification for transfer problems
    await this.adminNotificationsService.createAdminNotification({
      title: 'Wise Transfer Problem Detected',
      message: `Transfer ${transferId} has active cases: ${JSON.stringify(activeCases)}`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });

    return { status: 'processed', message: 'Transfer problem handled' };
  }

  /**
   * Extract the business resource from Wise webhook payloads.
   */
  private extractResource(event: WiseWebhookEvent): Record<string, any> | null {
    const resource =
      event?.data?.resource ||
      event?.resource ||
      (event?.data && typeof event.data === 'object' ? event.data : null);

    return resource && typeof resource === 'object' ? resource : null;
  }

  /**
   * Extract a transfer ID from different Wise payload variants.
   */
  private extractTransferId(resource: Record<string, any> | null): string | undefined {
    const id =
      resource?.id ??
      resource?.transferId ??
      resource?.transfer_id ??
      resource?.resourceId;

    if (id === undefined || id === null || id === '') {
      return undefined;
    }

    return String(id);
  }

  /**
   * Extract a status from different Wise payload variants.
   */
  private extractTransferStatus(
    resource: Record<string, any> | null,
    event?: WiseWebhookEvent,
  ): string | undefined {
    const candidates = [
      resource?.status,
      resource?.state,
      resource?.currentState,
      resource?.current_state,
      resource?.transferStatus,
      resource?.transfer_status,
      event?.status,
      event?.state,
    ];

    const value = candidates.find(
      (candidate) =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    );

    return typeof value === 'string' ? value : undefined;
  }

  private extractActiveCases(resource: Record<string, any> | null): any[] {
    const activeCases = resource?.activeCases ?? resource?.active_cases ?? [];
    return Array.isArray(activeCases) ? activeCases : [];
  }

  /**
   * Finalize a successful withdrawal exactly once.
   */
  private async finalizeCompletedWithdrawal(
    transaction: Transaction,
  ): Promise<void> {
    const alreadyFinalized = transaction.wizeStatus === 'completed';

    transaction.status = TransactionStatus.COMPLETED;
    transaction.processedAt = transaction.processedAt || new Date();

    if (alreadyFinalized) {
      return;
    }

    const wallet =
      transaction.wallet ||
      (await this.walletRepository.findOne({
        where: { id: transaction.walletId },
      }));

    if (wallet) {
      wallet.reservedBalance = Math.max(
        0,
        Number(wallet.reservedBalance) - Number(transaction.amount),
      );
      wallet.lastWithdrawalDate = new Date();
      await this.walletRepository.save(wallet);
    }

    try {
      const notification = await this.notificationsService.createSystemNotification(
        transaction.senderId,
        NotificationType.WITHDRAWAL_COMPLETED,
        'Retrait termine',
        `Votre retrait de ${transaction.amount} a ete effectue avec succes.`,
        transaction.id,
        'transaction',
      );

      await this.notificationsGateway.sendNotificationToUser(
        transaction.senderId,
        notification,
      );
    } catch (notifErr) {
      this.logger.warn(
        `Failed to send withdrawal completion notification: ${notifErr}`,
      );
    }
  }

  /**
   * Handle balance credit events
   */
  private async handleBalanceCredit(
    resource: any,
  ): Promise<{ status: string; message: string }> {
    this.logger.log('Balance credit event:', resource);

    // This could be used for reconciliation or notifications
    // For now, just log and acknowledge
    return { status: 'acknowledged', message: 'Balance credit noted' };
  }

  /**
   * Handle balance debit events
   */
  private async handleBalanceDebit(
    resource: any,
  ): Promise<{ status: string; message: string }> {
    this.logger.log('Balance debit event:', resource);

    // This could be used for reconciliation or notifications
    // For now, just log and acknowledge
    return { status: 'acknowledged', message: 'Balance debit noted' };
  }

  /**
   * Handle recipient created events
   */
  private async handleRecipientCreated(
    resource: any,
  ): Promise<{ status: string; message: string }> {
    this.logger.log('Recipient created:', resource);

    // Could be used for notifications or audit
    return { status: 'acknowledged', message: 'Recipient creation noted' };
  }

  /**
   * Handle recipient updated events
   */
  private async handleRecipientUpdated(
    resource: any,
  ): Promise<{ status: string; message: string }> {
    this.logger.log('Recipient updated:', resource);

    // Could be used for notifications or audit
    return { status: 'acknowledged', message: 'Recipient update noted' };
  }

  /**
   * Handle quote expired events
   */
  private async handleQuoteExpired(
    resource: any,
  ): Promise<{ status: string; message: string }> {
    this.logger.log('Quote expired:', resource);

    // Could be used to notify users to create new quotes
    return { status: 'acknowledged', message: 'Quote expiration noted' };
  }

  /**
   * Create admin notification for transfer status changes
   */
  private async createTransferStatusNotification(
    transaction: Transaction,
    status: string,
  ): Promise<void> {
    let title: string;
    let message: string;
    let type: AdminNotificationType;
    let priority: AdminNotificationPriority;

    switch (status) {
      case 'completed':
      case 'outgoing_payment_sent':
        title = 'Wise Transfer Completed';
        message = `Transfer ${transaction.wizeTransferId} for transaction ${transaction.id} has been completed successfully. Amount: ${transaction.amount}`;
        type = AdminNotificationType.SUCCESS;
        priority = AdminNotificationPriority.LOW;
        break;

      case 'cancelled':
        title = 'Wise Transfer Cancelled';
        message = `Transfer ${transaction.wizeTransferId} for transaction ${transaction.id} has been cancelled. Amount: ${transaction.amount}`;
        type = AdminNotificationType.WARNING;
        priority = AdminNotificationPriority.MEDIUM;
        break;

      case 'bounced_back':
        title = 'Wise Transfer Bounced Back';
        message = `Transfer ${transaction.wizeTransferId} for transaction ${transaction.id} has bounced back. Amount: ${transaction.amount}`;
        type = AdminNotificationType.ERROR;
        priority = AdminNotificationPriority.HIGH;
        break;

      case 'funds_refunded':
        title = 'Wise Transfer Funds Refunded';
        message = `Transfer ${transaction.wizeTransferId} for transaction ${transaction.id} has been refunded. Amount: ${transaction.amount}`;
        type = AdminNotificationType.INFO;
        priority = AdminNotificationPriority.MEDIUM;
        break;

      default:
        return;
    }

    await this.adminNotificationsService.createAdminNotification({
      title,
      message,
      type,
      priority,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  /**
   * Get transfer details from Wise API
   */
  async getTransferDetails(transferId: string): Promise<any> {
    try {
      return await this.wiseService.getTransfer(transferId);
    } catch (error) {
      this.logger.error(
        `Failed to get transfer details for ${transferId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Retry failed transfer
   */
  async retryTransfer(
    transferId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get current transfer details
      const transfer = await this.getTransferDetails(transferId);

      if (
        transfer.status !== 'cancelled' &&
        transfer.status !== 'bounced_back'
      ) {
        return {
          success: false,
          message: 'Transfer cannot be retried in current status',
        };
      }

      // Create new transfer with same details
      const newTransfer = await this.wiseService.createTransfer({
        targetAccount: transfer.targetAccount,
        quoteUuid: transfer.quoteUuid,
        customerTransactionId: `${transfer.customerTransactionId}_retry_${Date.now()}`,
        reference: transfer.reference,
        transferPurpose: transfer.transferPurpose,
        sourceOfFunds: transfer.sourceOfFunds,
      });

      // Fund the new transfer
      await this.wiseService.fundTransfer(newTransfer.id, { type: 'BALANCE' });

      this.logger.log(`Transfer retry successful: ${newTransfer.id}`);

      return {
        success: true,
        message: `Transfer retried successfully: ${newTransfer.id}`,
      };
    } catch (error) {
      this.logger.error(`Transfer retry failed for ${transferId}:`, error);
      return {
        success: false,
        message: `Transfer retry failed: ${error.message}`,
      };
    }
  }
}
