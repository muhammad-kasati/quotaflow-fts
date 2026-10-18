import { z } from 'zod';

// ==========================================
// Enumerations and Constants
// ==========================================

export enum PlanType {
  ACCOUNT = 'ACCOUNT',
  USER = 'USER',
}

export enum RejectionScope {
  ACCOUNT = 'ACCOUNT',
  USER = 'USER',
}

export enum RejectionCode {
  ACCOUNT_MAX_UNITS_EXCEEDED = 'ACCOUNT_MAX_UNITS_EXCEEDED',
  USER_MAX_UNITS_EXCEEDED = 'USER_MAX_UNITS_EXCEEDED',
  ACCOUNT_QUOTA_EXCEEDED = 'ACCOUNT_QUOTA_EXCEEDED',
  USER_QUOTA_EXCEEDED = 'USER_QUOTA_EXCEEDED',
}

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export enum RequestStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum WebhookEventStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export const PREDEFINED_PLANS = {
  ACCOUNT_STARTER: {
    id: 'plan_account_starter',
    name: 'Starter',
    type: PlanType.ACCOUNT,
    monthlyAllowance: 10000,
    maxUnitsPerRequest: 100,
    isPredefined: true,
  },
  ACCOUNT_PRO: {
    id: 'plan_account_pro',
    name: 'Pro',
    type: PlanType.ACCOUNT,
    monthlyAllowance: 100000,
    maxUnitsPerRequest: 500,
    isPredefined: true,
  },
  USER_BASIC: {
    id: 'plan_user_basic',
    name: 'Basic',
    type: PlanType.USER,
    monthlyAllowance: 1000,
    maxUnitsPerRequest: 20,
    isPredefined: true,
  },
  USER_PREMIUM: {
    id: 'plan_user_premium',
    name: 'Premium',
    type: PlanType.USER,
    monthlyAllowance: 5000,
    maxUnitsPerRequest: 100,
    isPredefined: true,
  },
} as const;

export const ALERT_THRESHOLDS = [80, 90, 100] as const;

// ==========================================
// Zod Schemas
// ==========================================

export const consumeRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required').max(128, 'userId is too long'),
  units: z
    .number({ invalid_type_error: 'units must be an integer' })
    .int('units must be an integer')
    .positive('units must be a positive integer'),
  requestId: z
    .string()
    .min(1, 'requestId is required')
    .max(128, 'requestId must not exceed 128 characters')
    .regex(/^[a-zA-Z0-9_\-.:]+$/, 'requestId must contain only alphanumeric characters, dashes, underscores, periods, and colons'),
});

export type ConsumeRequest = z.infer<typeof consumeRequestSchema>;

export const createAccountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  planId: z.string().min(1, 'planId is required'),
});

export const updateAccountSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  planId: z.string().min(1).optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  planId: z.string().min(1, 'planId is required'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  planId: z.string().min(1).optional(),
});

export const createPlanSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.nativeEnum(PlanType),
  monthlyAllowance: z.number().int().positive('Monthly allowance must be positive'),
  maxUnitsPerRequest: z.number().int().positive('Max units per request must be positive'),
});

export const updatePlanSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  monthlyAllowance: z.number().int().positive().optional(),
  maxUnitsPerRequest: z.number().int().positive().optional(),
  changeReason: z.string().max(255).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(100).default('Default Key'),
});

export const createWebhookConfigSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // Allow http for localhost in non-production, otherwise require https
        if (process.env.NODE_ENV === 'production') {
          return parsed.protocol === 'https:';
        }
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL must use HTTPS (or HTTP in local development)'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
  events: z.array(z.string()).default(['THRESHOLD_80', 'THRESHOLD_90', 'THRESHOLD_100']),
});

export const updateWebhookConfigSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(16).optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const historyQuerySchema = paginationQuerySchema.extend({
  userId: z.string().optional(),
  accepted: z.enum(['true', 'false']).optional(),
  rejectionScope: z.nativeEnum(RejectionScope).optional(),
  rejectionCode: z.nativeEnum(RejectionCode).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month format must be YYYY-MM').optional(),
});

// ==========================================
// Response Types
// ==========================================

export interface QuotaSnapshot {
  monthlyAllowance: number;
  consumedUnits: number;
  remainingUnits: number;
  usagePercentage: number;
  planId: string;
  planName: string;
  planVersion: number;
}

export interface ConsumptionDecisionResponse {
  accepted: boolean;
  requestId: string;
  unitsRequested: number;
  period: string; // "YYYY-MM"
  timestamp: string; // ISO 8601
  rejectionReason?: string | null;
  rejectionScope?: RejectionScope | null;
  rejectionCode?: RejectionCode | null;
  account: QuotaSnapshot;
  user: QuotaSnapshot;
  alertTriggered?: {
    scope: RejectionScope;
    threshold: number;
  } | null;
  idempotentReplay?: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
