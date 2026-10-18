import { Router, Request, Response, NextFunction } from 'express';
import { consumeRequestSchema } from '@quotaflow/shared';
import { processConsumption } from './usage.service';
import { authenticateApiKey } from '../../middleware/authenticate';
import { apiRateLimiter } from '../../middleware/rateLimiter';
import { AppError } from '../../middleware/errorHandler';

export const usageRouter = Router();

/**
 * POST /api/v1/consume
 * Core consumption decision endpoint.
 * Requires X-API-Key header.
 */
usageRouter.post(
  '/consume',
  apiRateLimiter,
  authenticateApiKey,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.account) {
        throw new AppError(401, 'UNAUTHORIZED', 'Account context missing.');
      }

      // Validate payload schema with Zod
      const validatedBody = consumeRequestSchema.parse(req.body);

      // Process consumption with row-level locks and transactional safety
      const decision = await processConsumption(req.account.id, validatedBody);

      // Return 200 OK for evaluated business decisions
      res.status(200).json({
        success: true,
        data: decision,
      });
    } catch (error) {
      next(error);
    }
  }
);
