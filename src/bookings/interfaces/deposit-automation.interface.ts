import { DepositCaptureStatus } from '../enums/deposit-capture-status.enum';
import { DepositJobStatus } from '../enums/deposit-job-status.enum';

export interface DepositSetupData {
  setupIntentId: string;
  clientSecret: string;
  customerId: string;
}

export interface DepositCaptureData {
  bookingId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  customerId: string;
}

export interface DepositNotificationData {
  bookingId: string;
  renterEmail: string;
  renterName: string;
  toolName: string;
  depositAmount: number;
  currency: string;
  captureDate: Date;
}

export interface DepositJobMetadata {
  bookingId: string;
  depositAmount: number;
  currency: string;
  renterEmail: string;
  toolName: string;
  notificationScheduledAt?: Date;
  captureScheduledAt?: Date;
}

export interface DepositCaptureResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  status: DepositCaptureStatus;
}

export interface CreateBookingWithDepositDto {
  toolId: string;
  startDate: string;
  endDate: string;
  pickupHour: string;
  message?: string;
  renterEmail: string;
  renterName: string;
}

export interface ConfirmDepositSetupDto {
  bookingId: string;
  setupIntentId: string;
  paymentMethodId: string;
}
