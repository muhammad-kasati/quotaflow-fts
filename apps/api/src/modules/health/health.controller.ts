import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export const healthRouter = Router();

/**
 * GET /health
 * Basic process liveness probe
 */
healthRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 * Database and dependency readiness probe
 */
healthRouter.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Database ping failed',
      timestamp: new Date().toISOString(),
    });
  }
});
