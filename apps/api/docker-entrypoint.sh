#!/bin/sh
set -e

echo "=== QuotaFlow API Container Starting ==="

echo "Applying Prisma migrations..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "Seeding database with system plans and demo account..."
node -e "
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function runSeed() {
  const plans = [
    { id: 'plan_account_starter', name: 'Starter', type: 'ACCOUNT', monthlyAllowance: 10000, maxUnitsPerRequest: 100, isPredefined: true },
    { id: 'plan_account_pro', name: 'Pro', type: 'ACCOUNT', monthlyAllowance: 100000, maxUnitsPerRequest: 500, isPredefined: true },
    { id: 'plan_user_basic', name: 'Basic', type: 'USER', monthlyAllowance: 1000, maxUnitsPerRequest: 20, isPredefined: true },
    { id: 'plan_user_premium', name: 'Premium', type: 'USER', monthlyAllowance: 5000, maxUnitsPerRequest: 100, isPredefined: true },
  ];

  for (const p of plans) {
    const exists = await prisma.plan.findUnique({ where: { id: p.id } });
    if (!exists) {
      await prisma.plan.create({
        data: {
          id: p.id,
          name: p.name,
          type: p.type,
          monthlyAllowance: p.monthlyAllowance,
          maxUnitsPerRequest: p.maxUnitsPerRequest,
          isPredefined: true,
          version: 1,
          versions: {
            create: {
              version: 1,
              name: p.name,
              type: p.type,
              monthlyAllowance: p.monthlyAllowance,
              maxUnitsPerRequest: p.maxUnitsPerRequest,
              changeReason: 'Initial system plan definition',
            }
          }
        }
      });
      console.log('Seeded plan:', p.name);
    }
  }

  // Demo Account
  let acc = await prisma.account.findUnique({ where: { id: 'account_demo_acme' } });
  if (!acc) {
    acc = await prisma.account.create({
      data: {
        id: 'account_demo_acme',
        name: 'Acme Document AI',
        planId: 'plan_account_starter',
        status: 'ACTIVE'
      }
    });
    console.log('Seeded demo account:', acc.name);
  }

  // Demo Key
  const rawKey = 'qf_live_demo_acme_production_key_2026';
  const keyHash = hashApiKey(rawKey);
  const keyExists = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!keyExists) {
    await prisma.apiKey.create({
      data: {
        accountId: acc.id,
        name: 'Primary Live Key',
        keyPrefix: 'qf_live_demo_acm...',
        keyHash,
        status: 'ACTIVE'
      }
    });
    console.log('Seeded demo API key: qf_live_demo_acm...');
  }

  // Demo Users
  const users = [
    { id: 'user_demo_alice', name: 'Alice Developer', planId: 'plan_user_basic' },
    { id: 'user_demo_bob', name: 'Bob PowerUser', planId: 'plan_user_premium' },
  ];

  for (const u of users) {
    const userExists = await prisma.user.findUnique({ where: { id: u.id } });
    if (!userExists) {
      await prisma.user.create({
        data: {
          id: u.id,
          accountId: acc.id,
          name: u.name,
          planId: u.planId,
          status: 'ACTIVE'
        }
      });
      console.log('Seeded demo user:', u.name);
    }
  }

  await prisma.\$disconnect();
}

runSeed().catch((err) => {
  console.error('Entrypoint seed warning:', err.message);
  process.exit(0); // Continue to launch server even if seed already exists
});
"

echo "Starting QuotaFlow Express API Server..."
exec node apps/api/dist/server.js
