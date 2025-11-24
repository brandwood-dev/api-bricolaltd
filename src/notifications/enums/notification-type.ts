export enum NotificationType {
  // Account Management
  ACCOUNT_DELETION_REQUEST = 'account_deletion_request',
  ACCOUNT_DELETION_REQUEST_PENDING = 'account_deletion_request_pending',
  ACCOUNT_DELETION_REQUEST_APPROVED = 'account_deletion_request_approved',
  ACCOUNT_DELETION_REQUEST_REJECTED = 'account_deletion_request_rejected',
  ACCOUNT_DELETION_REQUEST_CANCELLED = 'account_deletion_request_cancelled',
  ACCOUNT_CREATED = 'account_created',
  ACCOUNT_SUSPENDED = 'account_suspended',
  ACCOUNT_REACTIVATED = 'account_reactivated',
  PASSWORD_CHANGED = 'password_changed',
  EMAIL_CHANGED = 'email_changed',

  // User Verification
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  IDENTITY_VERIFICATION_REQUIRED = 'identity_verification_required',
  IDENTITY_VERIFICATION_APPROVED = 'identity_verification_approved',
  IDENTITY_VERIFICATION_REJECTED = 'identity_verification_rejected',

  // Booking Lifecycle
  BOOKING_CREATED = 'booking_created',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_REJECTED = 'booking_rejected',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_REMINDER = 'booking_reminder',
  BOOKING_OVERDUE = 'booking_overdue',
  BOOKING_EXTENDED = 'booking_extended',

  // Tool Management
  TOOL_SUBMITTED = 'tool_submitted',
  TOOL_APPROVED = 'tool_approved',
  TOOL_REJECTED = 'tool_rejected',
  TOOL_ARCHIVED = 'tool_archived',
  TOOL_UNAVAILABLE = 'tool_unavailable',
  TOOL_MAINTENANCE = 'tool_maintenance',
  TOOL_RETURNED = 'tool_returned',
  TOOL_DAMAGED = 'tool_damaged',

  // Financial Transactions
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  PAYMENT_REMINDER = 'payment_reminder',
  DEPOSIT_RECEIVED = 'deposit_received',
  DEPOSIT_RETURNED = 'deposit_returned',
  WITHDRAWAL_REQUESTED = 'withdrawal_requested',
  WITHDRAWAL_COMPLETED = 'withdrawal_completed',
  WITHDRAWAL_FAILED = 'withdrawal_failed',

  // Dispute Resolution
  DISPUTE_CREATED = 'dispute_created',
  DISPUTE_UPDATED = 'dispute_updated',
  DISPUTE_RESOLVED = 'dispute_resolved',
  DISPUTE_CLOSED = 'dispute_closed',
  DISPUTE_ESCALATED = 'dispute_escalated',

  // Reviews and Ratings
  REVIEW_RECEIVED = 'review_received',
  REVIEW_REMINDER = 'review_reminder',
  REVIEW_RESPONSE = 'review_response',

  // System Communications
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SYSTEM_UPDATE = 'system_update',
  TERMS_UPDATED = 'terms_updated',
  PRIVACY_POLICY_UPDATED = 'privacy_policy_updated',

  // Security
  LOGIN_ATTEMPT = 'login_attempt',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SECURITY_ALERT = 'security_alert',

  // Marketing and Engagement
  PROMOTIONAL_OFFER = 'promotional_offer',
  NEWSLETTER = 'newsletter',
  FEATURE_ANNOUNCEMENT = 'feature_announcement',
  WELCOME_MESSAGE = 'welcome_message',

  // Admin and Moderation
  CONTENT_FLAGGED = 'content_flagged',
  USER_REPORTED = 'user_reported',
  MODERATION_ACTION = 'moderation_action',
}
