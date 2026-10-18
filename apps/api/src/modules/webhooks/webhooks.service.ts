import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { computeHmacSignature } from '../../lib/crypto';
import { logger } from '../../lib/logger';
import crypto from 'crypto';

export interface CreateWebhookDto {
  url: string;
  secret?: string;
  events?: string[];
}

/**
 * Validates against SSRF (Server Side Request Forgery) in production environments
 */
function validateWebhookUrl(urlStr: string): void {
  try {
    const parsed = new URL(urlStr);

    if (process.env.NODE_ENV === 'production') {
      if (parsed.protocol !== 'https:') {
        throw new AppError(400, 'INVALID_WEBHOOK_URL', 'Webhook URL must use HTTPS in production.');
      }

      const hostname = parsed.hostname.toLowerCase();
      // Block loopback and internal private IP blocks
      const isPrivate =
        hostname === 'localhost' ||
        hostname.endsWith('.local') ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        hostname === '::1' ||
        hostname === '0.0.0.0';

      if (isPrivate) {
        throw new AppError(400, 'SSRF_BLOCKED', 'Webhook URL points to a restricted internal address.');
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, 'INVALID_WEBHOOK_URL', 'Invalid webhook URL provided.');
  }
}

export async function createWebhookConfig(accountId: string, dto: CreateWebhookDto) {
  validateWebhookUrl(dto.url);

  const secret = dto.secret || crypto.randomBytes(24).toString('hex');
  const events = dto.events || ['THRESHOLD_80', 'THRESHOLD_90', 'THRESHOLD_100'];

  return prisma.webhookConfig.create({
    data: {
      accountId,
      url: dto.url,
      secret,
      events,
      isActive: true,
    },
  });
}

export async function listWebhookConfigs(accountId: string) {
  return prisma.webhookConfig.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteWebhookConfig(accountId: string, webhookId: string) {
  const config = await prisma.webhookConfig.findUnique({
    where: { id: webhookId },
  });

  if (!config || config.accountId !== accountId) {
    throw new AppError(404, 'WEBHOOK_NOT_FOUND', 'Webhook configuration not found in this account.');
  }

  await prisma.webhookConfig.delete({ where: { id: webhookId } });
  return { success: true };
}

export async function listWebhookEvents(accountId: string, limit = 20) {
  return prisma.webhookEvent.findMany({
    where: { accountId },
    include: {
      deliveryAttempts: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Background outbox processor for delivering pending webhook events
 */
export async function processPendingWebhookEvents(): Promise<void> {
  const maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10);

  const pendingEvents = await prisma.webhookEvent.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: new Date() },
      attempts: { lt: maxRetries },
    },
    include: {
      account: {
        include: {
          webhookConfigs: {
            where: { isActive: true },
          },
        },
      },
    },
    take: 10,
  });

  for (const event of pendingEvents) {
    const activeConfigs = event.account.webhookConfigs;
    if (activeConfigs.length === 0) {
      // Mark delivered/no-op if no active configs configured
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'DELIVERED' },
      });
      continue;
    }

    let allDelivered = true;

    for (const config of activeConfigs) {
      const startTime = Date.now();
      const signature = computeHmacSignature(config.secret, event.payload);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-QuotaFlow-Signature': signature,
            'X-QuotaFlow-Event': event.eventType,
            'User-Agent': 'QuotaFlow-Webhook-Dispatcher/1.0',
          },
          body: event.payload,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;
        const responseText = await response.text();

        await prisma.webhookDeliveryAttempt.create({
          data: {
            eventId: event.id,
            statusCode: response.status,
            responseBody: responseText.slice(0, 1000),
            durationMs,
          },
        });

        if (!response.ok) {
          allDelivered = false;
        }
      } catch (err: unknown) {
        allDelivered = false;
        const durationMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        await prisma.webhookDeliveryAttempt.create({
          data: {
            eventId: event.id,
            statusCode: null,
            errorMessage: errorMessage.slice(0, 500),
            durationMs,
          },
        });
      }
    }

    const nextAttempts = event.attempts + 1;
    if (allDelivered) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'DELIVERED', attempts: nextAttempts },
      });
    } else if (nextAttempts >= maxRetries) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', attempts: nextAttempts },
      });
    } else {
      // Exponential backoff: 5s, 20s, 60s
      const delaySeconds = Math.pow(3, nextAttempts) * 5;
      const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { attempts: nextAttempts, nextAttemptAt },
      });
    }
  }
}
