import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/crypto';
import { AppError } from './errorHandler';
import { ApiKeyStatus } from '@prisma/client';

export interface AuthenticatedAccount {
  id: string;
  name: string;
  planId: string;
  status: string;
}

export interface AuthenticatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: AuthenticatedAccount;
      apiKey?: AuthenticatedApiKey;
      actor?: string;
    }
  }
}

/**
 * Authenticates client requests using the X-API-Key header.
 * Enforces account-level scoping and verifies key status.
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawKey = req.header('X-API-Key') || req.header('x-api-key');

  if (!rawKey) {
    next(new AppError(401, 'MISSING_API_KEY', 'Authentication required. Missing X-API-Key header.'));
    return;
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        account: true,
      },
    });

    if (!keyRecord || keyRecord.status !== ApiKeyStatus.ACTIVE) {
      next(new AppError(401, 'INVALID_API_KEY', 'The provided API key is invalid, inactive, or revoked.'));
      return;
    }

    if (keyRecord.account.status !== 'ACTIVE') {
      next(new AppError(403, 'ACCOUNT_INACTIVE', 'The associated account is currently inactive.'));
      return;
    }

    // Update lastUsedAt asynchronously without blocking the request
    prisma.apiKey
      .update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Non-critical background update failure
      });

    req.account = {
      id: keyRecord.account.id,
      name: keyRecord.account.name,
      planId: keyRecord.account.planId,
      status: keyRecord.account.status,
    };
    req.apiKey = {
      id: keyRecord.id,
      name: keyRecord.name,
      keyPrefix: keyRecord.keyPrefix,
    };
    req.actor = `key:${keyRecord.id}`;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticates administrative dashboard operations.
 * Requires X-Admin-Key matching ADMIN_API_KEY.
 */
export function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminKey = req.header('X-Admin-Key') || req.header('x-admin-key');
  const configuredAdminKey = process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026';

  if (!adminKey || adminKey !== configuredAdminKey) {
    next(new AppError(401, 'UNAUTHORIZED_ADMIN', 'Administrative authentication failed. Missing or invalid X-Admin-Key.'));
    return;
  }

  req.actor = 'admin';
  next();
}
