import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllPlans,
  getPlanById,
  createCustomPlan,
  updatePlan,
} from './plans.service';
import { createPlanSchema, updatePlanSchema } from '@quotaflow/shared';
import { authenticateApiKey, authenticateAdmin } from '../../middleware/authenticate';

export const plansRouter = Router();

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

/**
 * GET /api/v1/plans
 */
plansRouter.get(
  '/',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = req.account?.id;
      const plans = await getAllPlans(accountId);

      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/plans/:id
 */
plansRouter.get(
  '/:id',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await getPlanById(String(req.params.id));

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/plans
 */
plansRouter.post(
  '/',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createPlanSchema.parse(req.body);
      const ownerAccountId = req.actor === 'admin' ? undefined : req.account?.id;

      const plan = await createCustomPlan(
        { ...body, ownerAccountId },
        req.actor || req.account?.id || 'admin'
      );

      res.status(201).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/plans/:id
 */
plansRouter.patch(
  '/:id',
  authenticateAny,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = updatePlanSchema.parse(req.body);
      const updated = await updatePlan(
        String(req.params.id),
        body,
        req.actor || req.account?.id || 'admin'
      );

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);
