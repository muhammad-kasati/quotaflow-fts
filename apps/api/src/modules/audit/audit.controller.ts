import { Router, Request, Response, NextFunction } from 'express';
import { listAuditLogs } from './audit.service';
import { authenticateAdmin } from '../../middleware/authenticate';

export const auditRouter = Router();

/**
 * GET /api/v1/audit-logs
 * Authorized administrative view of system audit logs
 */
auditRouter.get(
  '/',
  authenticateAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const targetResource = req.query.targetResource ? String(req.query.targetResource) : undefined;
      const actor = req.query.actor ? String(req.query.actor) : undefined;

      const result = await listAuditLogs({ page, limit, targetResource, actor });
      res.json({
        success: true,
        data: result.logs,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);
