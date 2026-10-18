import { Router, Request, Response, NextFunction } from 'express';
import {
  getConsumptionHistory,
  exportConsumptionHistoryToCsv,
} from './history.service';
import { historyQuerySchema } from '@quotaflow/shared';
import { authenticateApiKey, authenticateAdmin } from '../../middleware/authenticate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const historyRouter = Router();

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
 * GET /api/v1/history
 */
historyRouter.get(
  '/',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      const query = historyQuerySchema.parse(req.query);

      const result = await getConsumptionHistory(accountId, query);
      res.json({
        success: true,
        data: result.requests,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/history/export
 * Downloads CSV of consumption history
 */
historyRouter.get(
  '/export',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      const query = historyQuerySchema.parse(req.query);

      const csvContent = await exportConsumptionHistoryToCsv(accountId, query);

      const filename = `quotaflow-history-${accountId}-${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/requests/:requestId
 * Request Inspector single lookup
 */
historyRouter.get(
  '/requests/:requestId',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = resolveAccountId(req);
      const requestId = String(req.params.requestId);

      const record = await prisma.consumptionRequest.findUnique({
        where: {
          accountId_requestId: {
            accountId,
            requestId,
          },
        },
        include: {
          user: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } },
        },
      });

      if (!record) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', `Request '${requestId}' not found in this account.`);
      }

      res.json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }
);
