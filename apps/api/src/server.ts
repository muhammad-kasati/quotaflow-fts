import dotenv from 'dotenv';
// Load environment variables before anything else
dotenv.config();

import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { processPendingWebhookEvents } from './modules/webhooks/webhooks.service';

const PORT = parseInt(process.env.API_PORT || '4000', 10);
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`QuotaFlow API Server listening on port ${PORT}`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    swaggerUrl: `http://localhost:${PORT}/api-docs`,
    openApiJsonUrl: `http://localhost:${PORT}/api-docs.json`,
  });
});

// Start background Webhook Outbox Worker
const workerIntervalMs = parseInt(process.env.WEBHOOK_WORKER_INTERVAL_MS || '3000', 10);
const webhookWorker = setInterval(async () => {
  try {
    await processPendingWebhookEvents();
  } catch (error) {
    logger.error('Error processing webhook events in background', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}, workerIntervalMs);

// Graceful shutdown handlers
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully shutting down QuotaFlow API server...`);
  clearInterval(webhookWorker);

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnect', { error: String(err) });
      process.exit(1);
    }
  });

  // Force close after 10 seconds if still hanging
  setTimeout(() => {
    logger.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
