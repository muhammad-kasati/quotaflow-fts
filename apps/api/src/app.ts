import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupSwagger } from './docs/swagger';
import { errorHandler, AppError } from './middleware/errorHandler';
import { healthRouter } from './modules/health/health.controller';
import { usageRouter } from './modules/usage/usage.controller';
import { accountsRouter } from './modules/accounts/accounts.controller';
import { usersRouter } from './modules/users/users.controller';
import { plansRouter } from './modules/plans/plans.controller';
import { historyRouter } from './modules/history/history.controller';
import { apiKeysRouter } from './modules/api-keys/api-keys.controller';
import { analyticsRouter } from './modules/analytics/analytics.controller';
import { alertsRouter } from './modules/alerts/alerts.controller';
import { webhooksRouter } from './modules/webhooks/webhooks.controller';
import { auditRouter } from './modules/audit/audit.controller';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to run cleanly
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Body parser with 1MB limit to protect against oversized payloads
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Swagger Documentation
  setupSwagger(app);

  // Health and readiness endpoints
  app.use('/', healthRouter);

  // API v1 Modules
  app.use('/api/v1', usageRouter);
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/plans', plansRouter);
  app.use('/api/v1/history', historyRouter);
  app.use('/api/v1/api-keys', apiKeysRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/alerts', alertsRouter);
  app.use('/api/v1/webhooks', webhooksRouter);
  app.use('/api/v1/audit-logs', auditRouter);

  // 404 Catch-all handler
  app.use((req, res, next) => {
    next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
