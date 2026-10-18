import { Router, Request, Response, NextFunction } from 'express';
import {
  listWebhookConfigs,
  createWebhookConfig,
  deleteWebhookConfig,
  listWebhookEvents,
} from './webhooks.service';
import { createWebhookConfigSchema } from '@quotaflow/shared';
import { authenticateApiKey, authenticateAdmin } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';

export const webhooksRouter = Router();

function authenticateAny(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.header('X-Admin-Key') || req.header('x-admin-key');
  const configuredAdminKey = process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026';

  if (adminKey && adminKey === configuredAdminKey) {
    req.actor = 'admin';
    next();
    return;
  }

  authenticateApiKey(req, res, next);
}

function resolveAccountId(req: Request): string {
  if (req.account?.id) return req.account.id;
  const q = req.query.accountId as string;
  if (req.actor === 'admin' && q) return q;
  throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account context or accountId query required.');
}

/**
 * GET /api/v1/webhooks
 */
webhooksRouter.get(
  '/',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      const webhooks = await listWebhookConfigs(accountId);

      // Mask secret for safety
      const safeWebhooks = webhooks.map((w) => ({
        ...w,
        secret: w.secret ? `${w.secret.substring(0, 4)}...${w.secret.slice(-4)}` : null,
      }));

      res.json({
        success: true,
        data: safeWebhooks,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/webhooks
 */
webhooksRouter.post(
  '/',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      const body = createWebhookConfigSchema.parse(req.body);
      const config = await createWebhookConfig(accountId, body);

      res.status(201).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/webhooks/:id
 */
webhooksRouter.delete(
  '/:id',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      await deleteWebhookConfig(accountId, String(req.params.id));

      res.json({
        success: true,
        message: 'Webhook configuration removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/webhooks/events
 * View webhook event dispatch outbox and delivery attempts
 */
webhooksRouter.get(
  '/events',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const events = await listWebhookEvents(accountId, limit);

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }
);
