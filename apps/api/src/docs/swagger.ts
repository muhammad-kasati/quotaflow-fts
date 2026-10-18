import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'QuotaFlow Usage Metering & Quota Management API',
    version: '1.0.0',
    description:
      'Production usage metering and multi-level quota management service enforcing dual account-level and user-level limits atomically with PostgreSQL transactions, row-level locking, and idempotency protection.',
    contact: {
      name: 'QuotaFlow Engineering Team',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Account API key for consumption and tenant operations',
      },
      AdminKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Admin-Key',
        description: 'Administrative secret key for system-level operations',
      },
    },
    schemas: {
      ConsumeRequest: {
        type: 'object',
        required: ['userId', 'units', 'requestId'],
        properties: {
          userId: {
            type: 'string',
            example: 'user_demo_alice',
            description: 'Target user ID belonging to the authenticated account',
          },
          units: {
            type: 'integer',
            minimum: 1,
            example: 10,
            description: 'Positive integer units of quota to consume',
          },
          requestId: {
            type: 'string',
            example: 'doc-job-2026-abc1',
            description: 'Unique client-generated idempotency request identifier',
          },
        },
      },
      QuotaSnapshot: {
        type: 'object',
        properties: {
          monthlyAllowance: { type: 'integer', example: 10000 },
          consumedUnits: { type: 'integer', example: 50 },
          remainingUnits: { type: 'integer', example: 9950 },
          usagePercentage: { type: 'number', example: 0.5 },
          planId: { type: 'string', example: 'plan_account_starter' },
          planName: { type: 'string', example: 'Starter' },
          planVersion: { type: 'integer', example: 1 },
        },
      },
      ConsumptionDecision: {
        type: 'object',
        properties: {
          accepted: { type: 'boolean', example: true },
          requestId: { type: 'string', example: 'doc-job-2026-abc1' },
          unitsRequested: { type: 'integer', example: 10 },
          period: { type: 'string', example: '2026-10' },
          timestamp: { type: 'string', format: 'date-time' },
          rejectionReason: { type: 'string', nullable: true, example: null },
          rejectionScope: { type: 'string', enum: ['ACCOUNT', 'USER'], nullable: true },
          rejectionCode: {
            type: 'string',
            enum: [
              'ACCOUNT_MAX_UNITS_EXCEEDED',
              'USER_MAX_UNITS_EXCEEDED',
              'ACCOUNT_QUOTA_EXCEEDED',
              'USER_QUOTA_EXCEEDED',
            ],
            nullable: true,
          },
          account: { $ref: '#/components/schemas/QuotaSnapshot' },
          user: { $ref: '#/components/schemas/QuotaSnapshot' },
          alertTriggered: {
            type: 'object',
            nullable: true,
            properties: {
              scope: { type: 'string' },
              threshold: { type: 'integer' },
            },
          },
          idempotentReplay: { type: 'boolean', example: false },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Request payload validation failed' },
              details: { type: 'object' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Process health check',
        tags: ['System'],
        responses: {
          200: { description: 'Process is live' },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'Readiness and database probe',
        tags: ['System'],
        responses: {
          200: { description: 'Database connected and service ready' },
          503: { description: 'Database disconnected' },
        },
      },
    },
    '/api/v1/consume': {
      post: {
        summary: 'Evaluate and consume units against account and user quotas',
        tags: ['Consumption'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ConsumeRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Quota consumption evaluated successfully (accepted or rejected)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/ConsumptionDecision' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'User not found in account' },
          409: { description: 'Idempotency conflict (same requestId reused with different units or user)' },
          429: { description: 'Request-rate limit exceeded' },
        },
      },
    },
    '/api/v1/accounts': {
      get: {
        summary: 'List accounts (Admin)',
        tags: ['Accounts'],
        security: [{ AdminKeyAuth: [] }],
        responses: { 200: { description: 'List of accounts' } },
      },
      post: {
        summary: 'Create account (Admin)',
        tags: ['Accounts'],
        security: [{ AdminKeyAuth: [] }],
        responses: { 201: { description: 'Account created' } },
      },
    },
    '/api/v1/accounts/{id}/overview': {
      get: {
        summary: 'Account usage and quota overview',
        tags: ['Accounts'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Account quota overview' } },
      },
    },
    '/api/v1/users': {
      get: {
        summary: 'List users for account',
        tags: ['Users'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'List of users' } },
      },
      post: {
        summary: 'Create user in account',
        tags: ['Users'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 201: { description: 'User created' } },
      },
    },
    '/api/v1/plans': {
      get: {
        summary: 'List available account and user plans',
        tags: ['Plans'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'List of plans' } },
      },
      post: {
        summary: 'Create custom plan',
        tags: ['Plans'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 201: { description: 'Plan created' } },
      },
    },
    '/api/v1/history': {
      get: {
        summary: 'Query consumption history with filters and pagination',
        tags: ['History'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'Paginated request history' } },
      },
    },
    '/api/v1/history/export': {
      get: {
        summary: 'Export request history to CSV',
        tags: ['History'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'CSV file download' } },
      },
    },
    '/api/v1/requests/{requestId}': {
      get: {
        summary: 'Inspect single request snapshot',
        tags: ['History'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Request details' } },
      },
    },
    '/api/v1/api-keys': {
      get: {
        summary: 'List API keys for account',
        tags: ['API Keys'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'List of API keys' } },
      },
      post: {
        summary: 'Create new API key',
        tags: ['API Keys'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 201: { description: 'API key created (raw key shown once)' } },
      },
    },
    '/api/v1/api-keys/{id}/rotate': {
      post: {
        summary: 'Rotate API key',
        tags: ['API Keys'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Key rotated with new raw key returned once' } },
      },
    },
    '/api/v1/analytics': {
      get: {
        summary: 'Get usage analytics, top users, trends, and rejection metrics',
        tags: ['Analytics'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'Analytics summary' } },
      },
    },
    '/api/v1/webhooks': {
      get: {
        summary: 'List webhook configurations',
        tags: ['Webhooks'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 200: { description: 'Configured webhooks' } },
      },
      post: {
        summary: 'Register webhook endpoint',
        tags: ['Webhooks'],
        security: [{ ApiKeyAuth: [] }, { AdminKeyAuth: [] }],
        responses: { 201: { description: 'Webhook registered' } },
      },
    },
    '/api/v1/audit-logs': {
      get: {
        summary: 'List administrative audit logs',
        tags: ['Audit'],
        security: [{ AdminKeyAuth: [] }],
        responses: { 200: { description: 'Audit log entries' } },
      },
    },
  },
};

export function setupSwagger(app: Express) {
  // OpenAPI JSON route
  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  // Swagger UI route
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'QuotaFlow API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
    })
  );
}
