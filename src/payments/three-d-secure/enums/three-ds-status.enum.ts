export enum ThreeDSStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  CHALLENGE_REQUIRED = 'challenge_required',
  CHALLENGE_PENDING = 'challenge_pending',
  CHALLENGE_COMPLETED = 'challenge_completed',
  FRICTIONLESS_COMPLETED = 'frictionless_completed',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export enum ThreeDSFlow {
  FRICTIONLESS = 'frictionless',
  CHALLENGE = 'challenge',
  ERROR = 'error',
}

export enum ThreeDSAuthenticationMethod {
  CHALLENGE = 'challenge',
  FRICTIONLESS = 'frictionless',
  ATTEMPT = 'attempt',
  NONE = 'none',
}