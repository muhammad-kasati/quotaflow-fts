import { Router, Request, Response, NextFunction } from 'express';
import {
  listAccounts,
  getAccountById,
  getAccountUsageSummary,
  createAccount,
  updateAccount,
} from './accounts.service';
import { createAccountSchema, updateAccountSchema } from '@quotaflow/shared';
import { authenticateAdmin, authenticateApiKey } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';

export const accountsRouter = Router();

// Middleware to accept either Admin key or Account API Key
function authenticateAny(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.header('X-Admin-Key') || req.header('x-admin-key');
  const configuredAdminKey = process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026';

  if (adminKey && adminKey === configuredAdminKey) {
    req.actor = 'admin';
    next();
    return;
  }

  // Fall back to API Key authentication
  authenticateApiKey(req, res, next);
}

/**
 * GET /api/v1/accounts
 * Admin-only list of all customer accounts
 */
accountsRouter.get(
  '/',
  authenticateAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const status = req.query.status ? String(req.query.status) : undefined;

      const result = await listAccounts({ page, limit, status });
      res.json({
        success: true,
        data: result.accounts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/accounts
 * Admin-only creation of customer account
 */
accountsRouter.post(
  '/',
  authenticateAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createAccountSchema.parse(req.body);
      const account = await createAccount(body, req.actor || 'admin');

      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/accounts/:id
 */
accountsRouter.get(
  '/:id',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = String(req.params.id);
      // Account isolation: non-admin can only access own account
      if (req.actor !== 'admin' && req.account?.id !== accountId) {
        throw new AppError(403, 'FORBIDDEN', 'Access to other accounts is forbidden.');
      }

      const account = await getAccountById(accountId);
      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/accounts/:id/overview
 */
accountsRouter.get(
  '/:id/overview',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = String(req.params.id);
      if (req.actor !== 'admin' && req.account?.id !== accountId) {
        throw new AppError(403, 'FORBIDDEN', 'Access to other accounts is forbidden.');
      }

      const period = req.query.period ? String(req.query.period) : undefined;
      const summary = await getAccountUsageSummary(accountId, period);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/accounts/:id
 */
accountsRouter.patch(
  '/:id',
  authenticateAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = String(req.params.id);
      const body = updateAccountSchema.parse(req.body);
      const updated = await updateAccount(accountId, body, req.actor || 'admin');

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);
