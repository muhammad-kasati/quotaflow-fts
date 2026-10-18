import { PrismaClient, PlanType, ApiKeyStatus } from '@prisma/client';
import { PREDEFINED_PLANS } from '@quotaflow/shared';
import { hashApiKey } from '../src/lib/crypto';

const prisma = new PrismaClient();

export const DEMO_DATA = {
  account: {
    id: 'account_demo_acme',
    name: 'Acme Document AI',
  },
  apiKey: {
    rawKey: 'qf_live_demo_acme_production_key_2026',
    name: 'Primary Live Key',
  },
  users: [
    {
      id: 'user_demo_alice',
      name: 'Alice Developer',
      planId: PREDEFINED_PLANS.USER_BASIC.id,
    },
    {
      id: 'user_demo_bob',
      name: 'Bob PowerUser',
      planId: PREDEFINED_PLANS.USER_PREMIUM.id,
    },
  ],
};

export async function seed() {
  console.log('--- Starting QuotaFlow Database Seeding ---');

  // 1. Seed Predefined Plans & Initial Versions
  const plansToSeed = [
    PREDEFINED_PLANS.ACCOUNT_STARTER,
    PREDEFINED_PLANS.ACCOUNT_PRO,
    PREDEFINED_PLANS.USER_BASIC,
    PREDEFINED_PLANS.USER_PREMIUM,
  ];

  for (const plan of plansToSeed) {
    const existing = await prisma.plan.findUnique({ where: { id: plan.id } });
    if (!existing) {
      await prisma.plan.create({
        data: {
          id: plan.id,
          name: plan.name,
          type: plan.type as PlanType,
          monthlyAllowance: plan.monthlyAllowance,
          maxUnitsPerRequest: plan.maxUnitsPerRequest,
          isPredefined: true,
          version: 1,
          versions: {
            create: {
              version: 1,
              name: plan.name,
              type: plan.type as PlanType,
              monthlyAllowance: plan.monthlyAllowance,
              maxUnitsPerRequest: plan.maxUnitsPerRequest,
              changeReason: 'Initial system plan definition',
            },
          },
        },
      });
      console.log(`Created predefined plan: ${plan.name} (${plan.id})`);
    } else {
      console.log(`Predefined plan already exists: ${plan.name} (${plan.id})`);
    }
  }

  // 2. Seed Demo Account
  let demoAccount = await prisma.account.findUnique({
    where: { id: DEMO_DATA.account.id },
  });

  if (!demoAccount) {
    demoAccount = await prisma.account.create({
      data: {
        id: DEMO_DATA.account.id,
        name: DEMO_DATA.account.name,
        planId: PREDEFINED_PLANS.ACCOUNT_STARTER.id,
        status: 'ACTIVE',
      },
    });
    console.log(`Created demo account: ${demoAccount.name} (${demoAccount.id})`);
  } else {
    console.log(`Demo account already exists: ${demoAccount.name}`);
  }

  // 3. Seed Demo API Key
  const keyHash = hashApiKey(DEMO_DATA.apiKey.rawKey);
  const existingKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!existingKey) {
    const keyPrefix = DEMO_DATA.apiKey.rawKey.substring(0, 16) + '...';
    await prisma.apiKey.create({
      data: {
        accountId: demoAccount.id,
        name: DEMO_DATA.apiKey.name,
        keyPrefix,
        keyHash,
        status: ApiKeyStatus.ACTIVE,
      },
    });
    console.log(`Created demo API key: ${DEMO_DATA.apiKey.name} (${keyPrefix})`);
    console.log(`  Raw demo API key (keep secure): ${DEMO_DATA.apiKey.rawKey}`);
  } else {
    console.log(`Demo API key already exists: ${existingKey.keyPrefix}`);
  }

  // 4. Seed Demo Users
  for (const user of DEMO_DATA.users) {
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: user.id,
          accountId: demoAccount.id,
          name: user.name,
          planId: user.planId,
          status: 'ACTIVE',
        },
      });
      console.log(`Created demo user: ${user.name} (${user.id})`);
    } else {
      console.log(`Demo user already exists: ${user.name} (${user.id})`);
    }
  }

  // 5. Audit Log Entry
  const bootstrapLog = await prisma.auditLog.findFirst({
    where: { action: 'SYSTEM_BOOTSTRAP' },
  });
  if (!bootstrapLog) {
    await prisma.auditLog.create({
      data: {
        actor: 'system',
        action: 'SYSTEM_BOOTSTRAP',
        targetResource: 'Database',
        targetId: 'seed',
        metadata: JSON.stringify({
          seededAt: new Date().toISOString(),
          accountId: demoAccount.id,
        }),
      },
    });
  }

  console.log('--- QuotaFlow Database Seeding Completed Successfully ---');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error('Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
