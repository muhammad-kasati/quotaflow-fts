import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { DEMO_DATA } from '../prisma/seed';
import { generateApiKey } from '../src/lib/crypto';
import { ApiKeyStatus, PlanType } from '@prisma/client';
import { getCurrentUtcPeriod } from '../src/lib/period';

const app = createApp();

describe('QuotaFlow Comprehensive Integration Tests', () => {
  let testAccountId: string;
  let testApiKey: string;
  let testUserId: string;
  let testUserBasicId: string;
  let isolatedPlanAccountId: string;
  let isolatedPlanUserId: string;

  beforeAll(async () => {
    // Setup isolated test account, plan, user, and key
    const uniqueSuffix = Date.now().toString();

    // Create custom test account plan (allowance: 200, maxUnitsPerRequest: 50)
    const accountPlan = await prisma.plan.create({
      data: {
        id: `plan_test_acc_${uniqueSuffix}`,
        name: `Test Acc Plan ${uniqueSuffix}`,
        type: PlanType.ACCOUNT,
        monthlyAllowance: 200,
        maxUnitsPerRequest: 50,
        version: 1,
        versions: {
          create: {
            version: 1,
            name: `Test Acc Plan ${uniqueSuffix}`,
            type: PlanType.ACCOUNT,
            monthlyAllowance: 200,
            maxUnitsPerRequest: 50,
          },
        },
      },
    });
    isolatedPlanAccountId = accountPlan.id;

    // Create custom test user plan (allowance: 80, maxUnitsPerRequest: 25)
    const userPlan = await prisma.plan.create({
      data: {
        id: `plan_test_usr_${uniqueSuffix}`,
        name: `Test Usr Plan ${uniqueSuffix}`,
        type: PlanType.USER,
        monthlyAllowance: 80,
        maxUnitsPerRequest: 25,
        version: 1,
        versions: {
          create: {
            version: 1,
            name: `Test Usr Plan ${uniqueSuffix}`,
            type: PlanType.USER,
            monthlyAllowance: 80,
            maxUnitsPerRequest: 25,
          },
        },
      },
    });
    isolatedPlanUserId = userPlan.id;

    // Create test account
    const account = await prisma.account.create({
      data: {
        name: `Test Account ${uniqueSuffix}`,
        planId: accountPlan.id,
      },
    });
    testAccountId = account.id;

    // Create test user under account
    const user = await prisma.user.create({
      data: {
        accountId: testAccountId,
        name: 'Test Runner User',
        planId: userPlan.id,
      },
    });
    testUserId = user.id;

    // Create second user with Basic predefined plan
    const basicUser = await prisma.user.create({
      data: {
        accountId: testAccountId,
        name: 'Basic Test User',
        planId: 'plan_user_basic',
      },
    });
    testUserBasicId = basicUser.id;

    // Create active API key
    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    testApiKey = rawKey;
    await prisma.apiKey.create({
      data: {
        accountId: testAccountId,
        name: 'Test Automated Key',
        keyPrefix,
        keyHash,
        status: ApiKeyStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.consumptionRequest.deleteMany({ where: { accountId: testAccountId } });
    await prisma.accountMonthlyUsage.deleteMany({ where: { accountId: testAccountId } });
    await prisma.userMonthlyUsage.deleteMany({ where: { accountId: testAccountId } });
    await prisma.alertEvent.deleteMany({ where: { accountId: testAccountId } });
    await prisma.apiKey.deleteMany({ where: { accountId: testAccountId } });
    await prisma.user.deleteMany({ where: { accountId: testAccountId } });
    await prisma.account.deleteMany({ where: { id: testAccountId } });
    await prisma.plan.deleteMany({
      where: { id: { in: [isolatedPlanAccountId, isolatedPlanUserId] } },
    });
    await prisma.$disconnect();
  });

  // 1. Health & Readiness
  describe('Health & Readiness', () => {
    it('GET /health returns 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeTypeOf('number');
    });

    it('GET /ready returns 200 with database connected', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });
  });

  // 2. Authentication & Account Isolation
  describe('Authentication & Scoping', () => {
    it('rejects requests missing X-API-Key with 401', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .send({ userId: testUserId, units: 5, requestId: 'req-auth-test-1' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_API_KEY');
    });

    it('rejects requests with invalid X-API-Key with 401', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', 'qf_live_invalid_nonexistent_key_123')
        .send({ userId: testUserId, units: 5, requestId: 'req-auth-test-2' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_API_KEY');
    });

    it('prevents cross-account user consumption with 404', async () => {
      // Trying to consume for demo user alice using testApiKey
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: DEMO_DATA.users[0].id, units: 5, requestId: 'req-cross-tenant-1' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  // 3. Input Validation
  describe('Payload & Input Validation', () => {
    it('rejects non-positive units', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: -10, requestId: 'req-val-1' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-integer units', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 10.5, requestId: 'req-val-2' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid requestId with special characters', async () => {
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 5, requestId: 'invalid/request/id!@#' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 4. Core Consumption & Quota Decisions
  describe('Quota Decisions & Atomic Enforcement', () => {
    it('accepts valid consumption and increments counters atomically', async () => {
      const reqId = `req-accept-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 10, requestId: reqId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(true);
      expect(res.body.data.unitsRequested).toBe(10);
      expect(res.body.data.account.consumedUnits).toBe(10);
      expect(res.body.data.account.remainingUnits).toBe(190); // 200 - 10
      expect(res.body.data.user.consumedUnits).toBe(10);
      expect(res.body.data.user.remainingUnits).toBe(70); // 80 - 10
    });

    it('rejects when units exceed user per-request limit (25) without consuming units', async () => {
      const reqId = `req-user-per-req-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 30, requestId: reqId });

      expect(res.status).toBe(200);
      expect(res.body.data.accepted).toBe(false);
      expect(res.body.data.rejectionScope).toBe('USER');
      expect(res.body.data.rejectionCode).toBe('USER_MAX_UNITS_EXCEEDED');
      // Verify counters were untouched!
      expect(res.body.data.user.consumedUnits).toBe(10);
      expect(res.body.data.account.consumedUnits).toBe(10);
    });

    it('rejects when units exceed account per-request limit (50) with priority over user limit', async () => {
      const reqId = `req-acc-per-req-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 60, requestId: reqId });

      expect(res.status).toBe(200);
      expect(res.body.data.accepted).toBe(false);
      expect(res.body.data.rejectionScope).toBe('ACCOUNT');
      expect(res.body.data.rejectionCode).toBe('ACCOUNT_MAX_UNITS_EXCEEDED');
      // Counters remained intact
      expect(res.body.data.account.consumedUnits).toBe(10);
    });

    it('rejects when user monthly quota is exhausted (user limit: 80)', async () => {
      // Consume 20 + 20 + 20 = 60 more units (user will have 70 consumed out of 80)
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/v1/consume')
          .set('X-API-Key', testApiKey)
          .send({ userId: testUserId, units: 20, requestId: `req-drain-user-${i}-${Date.now()}` });
      }

      // User now has 70 consumed, 10 remaining. Requesting 15 should reject!
      const reqId = `req-user-exhaust-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 15, requestId: reqId });

      expect(res.status).toBe(200);
      expect(res.body.data.accepted).toBe(false);
      expect(res.body.data.rejectionScope).toBe('USER');
      expect(res.body.data.rejectionCode).toBe('USER_QUOTA_EXCEEDED');
      expect(res.body.data.user.consumedUnits).toBe(70); // Still 70
    });
  });

  // 5. Idempotency & Retries
  describe('Idempotency & Request Conflict', () => {
    it('returns identical cached decision on idempotent retry without double-counting', async () => {
      const reqId = `idempotent-test-${Date.now()}`;

      // First request (consumes 5 units)
      const res1 = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 5, requestId: reqId });

      expect(res1.status).toBe(200);
      expect(res1.body.data.accepted).toBe(true);
      const consumedAfterFirst = res1.body.data.user.consumedUnits;

      // Duplicate request with exact same payload
      const res2 = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 5, requestId: reqId });

      expect(res2.status).toBe(200);
      expect(res2.body.data.idempotentReplay).toBe(true);
      expect(res2.body.data.requestId).toBe(reqId);
      // Ensure counters were NOT incremented again!
      expect(res2.body.data.user.consumedUnits).toBe(consumedAfterFirst);
    });

    it('returns 409 Conflict when same requestId is reused with different units', async () => {
      const reqId = `conflict-test-${Date.now()}`;

      await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 5, requestId: reqId });

      const resConflict = await request(app)
        .post('/api/v1/consume')
        .set('X-API-Key', testApiKey)
        .send({ userId: testUserId, units: 10, requestId: reqId });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  // 6. Plan Changes & Versioning
  describe('Plan Changes & Versioning', () => {
    it('preserves consumed usage when plan limits are modified', async () => {
      // Check current account usage
      const summaryBefore = await request(app)
        .get(`/api/v1/accounts/${testAccountId}/overview`)
        .set('X-Admin-Key', process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026');

      const consumed = summaryBefore.body.data.consumedUnits;

      // Update plan to reduce allowance (new allowance = 50, which is below consumed!)
      const updateRes = await request(app)
        .patch(`/api/v1/plans/${isolatedPlanAccountId}`)
        .set('X-Admin-Key', process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026')
        .send({
          monthlyAllowance: 50,
          changeReason: 'Reduced quota limit test',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.version).toBe(2);

      // Verify that consumed units did not reset
      const summaryAfter = await request(app)
        .get(`/api/v1/accounts/${testAccountId}/overview`)
        .set('X-Admin-Key', process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026');

      expect(summaryAfter.body.data.consumedUnits).toBe(consumed);
      expect(summaryAfter.body.data.remainingUnits).toBe(0); // Clamped to zero!
    });
  });

  // 7. API Key Rotation and Revocation
  describe('API Key Lifecycle', () => {
    it('revokes an API key and immediately denies access with 401', async () => {
      // 1. Create a temporary key
      const createRes = await request(app)
        .post('/api/v1/api-keys')
        .set('X-Admin-Key', process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026')
        .query({ accountId: testAccountId })
        .send({ name: 'Revocation Test Key' });

      expect(createRes.status).toBe(201);
      const tempKey = createRes.body.data.rawKey;
      const keyId = createRes.body.data.id;

      // Verify temp key works
      const testRes = await request(app)
        .get(`/api/v1/users`)
        .set('X-API-Key', tempKey);
      expect(testRes.status).toBe(200);

      // Revoke the key
      const revokeRes = await request(app)
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('X-Admin-Key', process.env.ADMIN_API_KEY || 'qf_admin_dev_bootstrap_secret_key_2026')
        .query({ accountId: testAccountId });
      expect(revokeRes.status).toBe(200);

      // Verify key is immediately denied
      const deniedRes = await request(app)
        .get(`/api/v1/users`)
        .set('X-API-Key', tempKey);
      expect(deniedRes.status).toBe(401);
    });
  });

  // 8. PostgreSQL Concurrency & Row Locking Test
  describe('Concurrency & Race Condition Protection', () => {
    it('prevents over-consumption under high concurrency using row-level locking', async () => {
      const concSuffix = Date.now().toString();

      // Fresh account with ample account-level quota (Starter: 10,000 units)
      const concAccount = await prisma.account.create({
        data: {
          name: `Concurrent Test Acc ${concSuffix}`,
          planId: 'plan_account_starter',
        },
      });

      const { rawKey: concApiKey, keyPrefix, keyHash } = generateApiKey();
      await prisma.apiKey.create({
        data: {
          accountId: concAccount.id,
          name: 'Conc Key',
          keyPrefix,
          keyHash,
          status: ApiKeyStatus.ACTIVE,
        },
      });

      // Create fresh user with tight quota of 30 units (3 requests of 10 units each)
      const tightPlan = await prisma.plan.create({
        data: {
          id: `plan_tight_${concSuffix}`,
          name: 'Tight Quota Plan',
          type: PlanType.USER,
          monthlyAllowance: 30,
          maxUnitsPerRequest: 10,
          version: 1,
        },
      });

      const tightUser = await prisma.user.create({
        data: {
          accountId: concAccount.id,
          name: 'Tight Quota User',
          planId: tightPlan.id,
        },
      });

      // Fire 10 simultaneous requests of 10 units each
      // Total requested = 100 units, but user allowance is ONLY 30 units!
      // Exactly 3 requests must succeed, and 7 must be rejected!
      const promises = Array.from({ length: 10 }).map((_, i) =>
        request(app)
          .post('/api/v1/consume')
          .set('X-API-Key', concApiKey)
          .send({
            userId: tightUser.id,
            units: 10,
            requestId: `concurrent-burst-${i}-${Date.now()}`,
          })
      );

      const results = await Promise.all(promises);

      const acceptedCount = results.filter((r) => r.body.data?.accepted === true).length;
      const rejectedCount = results.filter((r) => r.body.data?.accepted === false).length;

      // Quota MUST NEVER be exceeded!
      expect(acceptedCount).toBe(3);
      expect(rejectedCount).toBe(7);

      // Verify in DB that final consumedUnits equals exactly 30!
      const period = getCurrentUtcPeriod();
      const usageInDb = await prisma.userMonthlyUsage.findUnique({
        where: { userId_period: { userId: tightUser.id, period } },
      });

      expect(usageInDb?.consumedUnits).toBe(30);
      expect(usageInDb?.acceptedRequests).toBe(3);
      expect(usageInDb?.rejectedRequests).toBe(7);

      // Clean up
      await prisma.consumptionRequest.deleteMany({ where: { accountId: concAccount.id } });
      await prisma.userMonthlyUsage.deleteMany({ where: { accountId: concAccount.id } });
      await prisma.accountMonthlyUsage.deleteMany({ where: { accountId: concAccount.id } });
      await prisma.apiKey.deleteMany({ where: { accountId: concAccount.id } });
      await prisma.user.delete({ where: { id: tightUser.id } });
      await prisma.account.delete({ where: { id: concAccount.id } });
      await prisma.plan.delete({ where: { id: tightPlan.id } });
    });
  });
});
