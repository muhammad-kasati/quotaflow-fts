import { prisma } from '../../lib/prisma';
import { generateApiKey } from '../../lib/crypto';
import { AppError } from '../../middleware/errorHandler';
import { ApiKeyStatus } from '@prisma/client';
import { recordAudit } from '../audit/audit.service';

export async function listApiKeys(accountId: string) {
  return prisma.apiKey.findMany({
    where: { accountId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      status: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApiKey(accountId: string, name: string, actor: string) {
  const { rawKey, keyPrefix, keyHash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      accountId,
      name: name || 'API Key',
      keyPrefix,
      keyHash,
      status: ApiKeyStatus.ACTIVE,
    },
  });

  await recordAudit({
    actor,
    action: 'API_KEY_CREATED',
    targetResource: 'ApiKey',
    targetId: apiKey.id,
    metadata: { keyPrefix, name: apiKey.name, accountId },
  });

  // Return rawKey ONLY ONCE upon creation
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    rawKey,
    createdAt: apiKey.createdAt,
    status: apiKey.status,
  };
}

export async function rotateApiKey(accountId: string, keyId: string, actor: string) {
  const existingKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!existingKey || existingKey.accountId !== accountId) {
    throw new AppError(404, 'KEY_NOT_FOUND', 'API Key not found in this account.');
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey();

  const [revokedOld, createdNew] = await prisma.$transaction([
    prisma.apiKey.update({
      where: { id: keyId },
      data: {
        status: ApiKeyStatus.REVOKED,
        revokedAt: new Date(),
      },
    }),
    prisma.apiKey.create({
      data: {
        accountId,
        name: `${existingKey.name} (Rotated)`,
        keyPrefix,
        keyHash,
        status: ApiKeyStatus.ACTIVE,
      },
    }),
  ]);

  await recordAudit({
    actor,
    action: 'API_KEY_ROTATED',
    targetResource: 'ApiKey',
    targetId: createdNew.id,
    metadata: {
      accountId,
      oldKeyId: revokedOld.id,
      oldKeyPrefix: revokedOld.keyPrefix,
      newKeyId: createdNew.id,
      newKeyPrefix: createdNew.keyPrefix,
    },
  });

  return {
    revokedKeyId: revokedOld.id,
    newKey: {
      id: createdNew.id,
      name: createdNew.name,
      keyPrefix: createdNew.keyPrefix,
      rawKey,
      createdAt: createdNew.createdAt,
      status: createdNew.status,
    },
  };
}

export async function revokeApiKey(accountId: string, keyId: string, actor: string) {
  const existingKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!existingKey || existingKey.accountId !== accountId) {
    throw new AppError(404, 'KEY_NOT_FOUND', 'API Key not found in this account.');
  }

  if (existingKey.status === ApiKeyStatus.REVOKED) {
    throw new AppError(400, 'KEY_ALREADY_REVOKED', 'This API key has already been revoked.');
  }

  const revoked = await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      status: ApiKeyStatus.REVOKED,
      revokedAt: new Date(),
    },
  });

  await recordAudit({
    actor,
    action: 'API_KEY_REVOKED',
    targetResource: 'ApiKey',
    targetId: keyId,
    metadata: { accountId, keyPrefix: existingKey.keyPrefix },
  });

  return {
    id: revoked.id,
    status: revoked.status,
    revokedAt: revoked.revokedAt,
  };
}
