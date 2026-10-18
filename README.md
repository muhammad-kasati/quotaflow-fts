# QuotaFlow

> **Enterprise-grade API Quota & Usage Metering Platform**

QuotaFlow is a full-stack, production-ready SaaS metering engine that allows you to track, enforce, and visualize API usage quotas at both the **account** and **user** level — with real-time alerting, webhook delivery, audit logging, and an interactive analytics dashboard.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Modules](#api-modules)
- [Core Consumption Engine](#core-consumption-engine)
- [Authentication System](#authentication-system)
- [Webhook Outbox System](#webhook-outbox-system)
- [Frontend Dashboard](#frontend-dashboard)
- [Shared Package](#shared-package)
- [Environment Variables](#environment-variables)
- [Quick Start (Docker)](#quick-start-docker)
- [Development Setup](#development-setup)
- [Load Testing](#load-testing)
- [Pre-seeded Demo Data](#pre-seeded-demo-data)

---

## Overview

QuotaFlow solves a common SaaS infrastructure problem: **how do you reliably meter and enforce API usage limits without race conditions, double-counting, or data inconsistency?**

Key capabilities:
- Transactional quota enforcement with PostgreSQL row-level locking (FOR UPDATE)
- Idempotent consumption requests — replaying the same requestId always returns the same decision
- Dual-scope quota — limits enforced at both Account level and User level simultaneously
- Automatic threshold alerts at 80%, 90%, and 100% consumption
- Webhook outbox pattern with exponential-backoff retry and HMAC signature verification
- Full audit log for all administrative actions
- Interactive analytics dashboard (Next.js) with real-time data from the API
- Swagger / OpenAPI documentation auto-generated from code
- Dockerized — single docker compose up --build brings up the entire stack

---

## Architecture

```
+-------------------------------------------------------------+
|                     Docker Network                          |
|                                                             |
|  +-----------+   HTTP   +-----------+   TCP/5432           |
|  | Next.js   | -------> | Express   | ------------------>  |
|  | Web :3000 |          | API :4000 |   +------------+     |
|  | Frontend  |          | Backend   |   | PostgreSQL |     |
|  +-----------+          +-----------+   |  Port:5432 |     |
|       |                      |          +------------+     |
|  Browser calls         Background Worker                   |
|  NEXT_PUBLIC_API_BASE_URL  (Webhook Outbox)                |
|  -> http://localhost:4000  runs every 3 seconds            |
+-------------------------------------------------------------+
```

### Request Flow (Quota Consumption)

```
Client POST /api/v1/consume (X-API-Key: <key>)
  |
  v
authenticateApiKey middleware  ->  hash key, lookup in DB, attach account
  |
  v
apiRateLimiter middleware       ->  120 req/min per API key
  |
  v
usage.service.processConsumption()
  |
  |-- 1. Verify user belongs to account
  |-- 2. Idempotency check (accountId + requestId)
  +-- 3. PostgreSQL Transaction (FOR UPDATE)
         |-- Upsert usage rows (ON CONFLICT DO NOTHING)
         |-- Lock rows (deterministic order, no deadlock)
         |-- Evaluate 4 rejection rules in priority order
         |-- Update counters atomically
         |-- Insert ConsumptionRequest record
         +-- Check alert thresholds (80/90/100%)
              +-- If triggered: AlertEvent + WebhookEvent (outbox)
  |
  v
Response: { accepted, requestId, account: {...}, user: {...} }

Background: Webhook Worker polls every 3s
  -> delivers with HMAC signature
  -> exponential backoff: 5s -> 20s -> 60s
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend API | Node.js 22 + Express 4 | HTTP server, routing, middleware |
| Language | TypeScript 5 | Type safety across the entire codebase |
| Database | PostgreSQL 16 | Primary data store with ACID transactions |
| ORM | Prisma 6 | Database client, schema management, migrations |
| Validation | Zod 3 | Runtime schema validation (shared with frontend) |
| Auth | Custom HMAC (SHA-256) | API key hashing, webhook signatures |
| Rate Limiting | express-rate-limit 7 | Per-key rate limiting (120 req/min) |
| Security | Helmet 8 | HTTP security headers |
| API Docs | Swagger UI + swagger-jsdoc | Auto-generated OpenAPI 3.0 docs |
| Logging | Custom JSON Logger | Structured JSON logs (production-ready) |
| Frontend | Next.js 14 + React 18 | Dashboard UI with App Router |
| Styling | TailwindCSS 3 | Utility-first CSS |
| Icons | Lucide React | Consistent icon system |
| Shared Code | @quotaflow/shared (npm workspace) | Types, Zod schemas, enums shared across API and Web |
| Containerization | Docker + Docker Compose | Full production deployment |
| Load Testing | k6 | Performance & stress testing |
| Testing | Vitest + Supertest | Unit and integration tests |
| Package Manager | npm Workspaces (monorepo) | Single node_modules, shared dependencies |

---

## Project Structure

```
QuotaFlow/                          <- Monorepo Root
|-- package.json                    <- Workspace root (npm workspaces)
|-- docker-compose.yml              <- Orchestrates postgres + api + web
|-- .env / .env.example             <- Environment configuration
|
|-- packages/
|   +-- shared/                     <- @quotaflow/shared (internal package)
|       +-- src/index.ts            <- All shared types, Zod schemas, enums
|
|-- apps/
|   |-- api/                        <- @quotaflow/api (Express backend)
|   |   |-- Dockerfile
|   |   |-- docker-entrypoint.sh    <- Migrations -> Seed -> Start server
|   |   |-- prisma/
|   |   |   |-- schema.prisma       <- Database schema (13 models)
|   |   |   +-- migrations/         <- SQL migration history
|   |   +-- src/
|   |       |-- server.ts           <- Entry point, HTTP listen, webhook worker
|   |       |-- app.ts              <- Express app factory, route mounting
|   |       |-- lib/
|   |       |   |-- prisma.ts       <- Prisma singleton client
|   |       |   |-- logger.ts       <- Structured JSON logger
|   |       |   |-- crypto.ts       <- SHA-256 key hashing, HMAC signing
|   |       |   +-- period.ts       <- Current UTC period (YYYY-MM)
|   |       |-- middleware/
|   |       |   |-- authenticate.ts <- API key auth + Admin key auth
|   |       |   |-- rateLimiter.ts  <- Per-key rate limiting
|   |       |   +-- errorHandler.ts <- Centralized error handling
|   |       |-- docs/
|   |       |   +-- swagger.ts      <- OpenAPI spec setup
|   |       +-- modules/
|   |           |-- health/         <- GET /health, GET /ready
|   |           |-- usage/          <- POST /api/v1/consume (core engine)
|   |           |-- accounts/       <- CRUD + overview for accounts
|   |           |-- users/          <- CRUD + overview for users
|   |           |-- plans/          <- Plan management with versioning
|   |           |-- api-keys/       <- Key create/revoke/rotate
|   |           |-- history/        <- Request history + CSV export
|   |           |-- analytics/      <- Aggregated analytics data
|   |           |-- alerts/         <- Threshold alert events
|   |           |-- webhooks/       <- Config management + outbox processor
|   |           +-- audit/          <- Audit log entries
|   |
|   +-- web/                        <- @quotaflow/web (Next.js frontend)
|       |-- Dockerfile
|       |-- next.config.js
|       +-- src/
|           |-- app/
|           |   |-- layout.tsx      <- Root layout (Navbar + fonts)
|           |   |-- page.tsx        <- Dashboard (analytics overview)
|           |   |-- demo/           <- Interactive quota simulator
|           |   |-- users/          <- User management page
|           |   |-- plans/          <- Plan management page
|           |   |-- api-keys/       <- API key management page
|           |   |-- history/        <- Request history log
|           |   |-- inspector/      <- Single request deep-dive
|           |   |-- webhooks/       <- Webhook config + event log
|           |   +-- audit/          <- Audit log viewer
|           |-- components/
|           |   +-- Navbar.tsx      <- Navigation bar
|           +-- lib/
|               +-- api-client.ts   <- Typed fetch wrapper for all API calls
|
+-- load-tests/
    |-- run-k6.ps1                  <- PowerShell runner script
    +-- scenarios/
        |-- normal-consumption.js   <- Steady-state load (20 VUs, 300ms p95)
        |-- quota-exhaustion.js     <- Drives quota to 100%
        |-- idempotency.js          <- Replays same requestIds concurrently
        +-- history-analytics.js   <- Read-heavy analytics load
```

---

## Database Schema

The database has **13 models** covering the full domain:

| Model | Purpose |
|-------|---------|
| `Account` | Top-level tenant entity with its own plan |
| `User` | Belongs to an Account, has its own plan |
| `Plan` | Defines monthlyAllowance and maxUnitsPerRequest |
| `PlanVersion` | Immutable snapshot of each plan change |
| `ApiKey` | SHA-256 hashed key linked to an Account |
| `AccountMonthlyUsage` | Running counters per Account per YYYY-MM period |
| `UserMonthlyUsage` | Running counters per User per YYYY-MM period |
| `ConsumptionRequest` | Full record of every evaluated request (idempotency key) |
| `AlertEvent` | Fired once per (account/user, period, threshold) crossing |
| `WebhookConfig` | Registered delivery endpoint with secret and event filters |
| `WebhookEvent` | Outbox event (PENDING -> DELIVERED/FAILED) |
| `WebhookDeliveryAttempt` | Logs each HTTP delivery attempt with status code |
| `AuditLog` | Admin action trail |

---

## API Modules

All endpoints are under `/api/v1/`. Full interactive docs at **http://localhost:4000/api-docs**.

### Authentication Headers

| Header | Used For |
|--------|----------|
| `X-API-Key` | Client-facing endpoints (consume, history, analytics, webhooks) |
| `X-Admin-Key` | Administrative endpoints (accounts, users, plans, audit logs) |

### Endpoints Summary

| Module | Method | Path | Auth |
|--------|--------|------|------|
| Health | GET | `/health` | None |
| Health | GET | `/ready` | None |
| **Usage** | **POST** | **`/api/v1/consume`** | **API Key** |
| Analytics | GET | `/api/v1/analytics` | API Key |
| Accounts | GET/POST | `/api/v1/accounts` | Admin |
| Accounts | GET/PATCH | `/api/v1/accounts/:id` | Admin |
| Accounts | GET | `/api/v1/accounts/:id/overview` | Admin |
| Users | GET/POST | `/api/v1/users` | Admin |
| Users | GET/PATCH | `/api/v1/users/:id` | Admin |
| Users | GET | `/api/v1/users/:id/overview` | Admin |
| Plans | GET/POST | `/api/v1/plans` | Admin |
| Plans | PATCH | `/api/v1/plans/:id` | Admin |
| API Keys | GET/POST | `/api/v1/api-keys` | Admin |
| API Keys | POST | `/api/v1/api-keys/:id/rotate` | Admin |
| API Keys | DELETE | `/api/v1/api-keys/:id` | Admin |
| History | GET | `/api/v1/history` | API Key |
| History | GET | `/api/v1/history/requests/:id` | API Key |
| History | GET | `/api/v1/history/export` | API Key |
| Alerts | GET | `/api/v1/alerts` | API Key |
| Webhooks | GET/POST | `/api/v1/webhooks` | API Key |
| Webhooks | DELETE | `/api/v1/webhooks/:id` | API Key |
| Webhooks | GET | `/api/v1/webhooks/events` | API Key |
| Audit | GET | `/api/v1/audit-logs` | Admin |

---

## Core Consumption Engine

`POST /api/v1/consume` request body:

```json
{
  "userId": "user_demo_alice",
  "units": 10,
  "requestId": "my-unique-idempotency-key-001"
}
```

**4 Rejection Rules (in priority order):**
1. `ACCOUNT_MAX_UNITS_EXCEEDED` — units > account's maxUnitsPerRequest
2. `USER_MAX_UNITS_EXCEEDED` — units > user's maxUnitsPerRequest
3. `ACCOUNT_QUOTA_EXCEEDED` — would exceed account monthly allowance
4. `USER_QUOTA_EXCEEDED` — would exceed user monthly allowance

**Idempotency:** Same `(accountId, requestId)` always returns the same stored decision. Conflict on same requestId with different parameters returns HTTP 409.

**Concurrency Safety:** PostgreSQL `FOR UPDATE` row locking in deterministic order (Account first, then User) prevents race conditions and deadlocks under high concurrency.

---

## Authentication System

- **API Keys**: Stored as SHA-256 hashes only. Raw key shown once at creation time.
- **Admin Key**: Shared secret (ADMIN_API_KEY env var) for administrative operations.
- **Rate Limiter**: 120 req/min per API key (falls back to IP if no key). Standard `RateLimit-*` headers returned.

---

## Webhook Outbox System

Uses the **Transactional Outbox Pattern**:

1. `WebhookEvent` written inside the same transaction as quota consumption — guaranteed no data loss
2. Background worker polls every 3 seconds for PENDING events
3. Delivers to all active `WebhookConfig` URLs for the account
4. Each attempt logged in `WebhookDeliveryAttempt`
5. Retry with exponential backoff: `3^attempt x 5s` (5s -> 20s -> 60s), max 3 retries
6. HMAC-SHA256 signature in `X-QuotaFlow-Signature` header for recipient verification
7. Production SSRF protection: HTTPS only, no private/loopback IP addresses

---

## Frontend Dashboard

| Route | Description |
|-------|-------------|
| `/` | Analytics — quota gauges, daily trend, top users, rejection breakdown |
| `/demo` | Interactive quota simulator — fire requests and see live decisions |
| `/users` | User list with quota snapshots |
| `/plans` | Plan management (auto-versioned on every edit) |
| `/api-keys` | Create, rotate, revoke API keys |
| `/history` | Paginated request log with filters + CSV export |
| `/inspector` | Deep-dive into a single request by ID |
| `/webhooks` | Register webhooks, view delivery event log |
| `/audit` | Full administrative audit trail |

---

## Shared Package

`@quotaflow/shared` (`packages/shared`) is imported by both the API and Web app:

- **Enums**: `PlanType`, `RejectionScope`, `RejectionCode`, `ApiKeyStatus`, `RequestStatus`
- **Constants**: `PREDEFINED_PLANS`, `ALERT_THRESHOLDS = [80, 90, 100]`
- **Zod Schemas**: Input validation for all create/update operations
- **TypeScript Interfaces**: `QuotaSnapshot`, `ConsumptionDecisionResponse`, `ApiSuccessResponse<T>`, `ApiErrorResponse`

This ensures zero type drift — the API validates with the same Zod schemas the frontend uses.

---

## Environment Variables

```env
# PostgreSQL
POSTGRES_USER=quotaflow_user
POSTGRES_PASSWORD=quotaflow_secret
POSTGRES_DB=quotaflow_db
POSTGRES_PORT=5434

# API
API_PORT=4000
DATABASE_URL=postgresql://quotaflow_user:quotaflow_secret@localhost:5434/quotaflow_db?schema=public
ADMIN_API_KEY=qf_admin_dev_bootstrap_secret_key_2026

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

# Webhook Worker
WEBHOOK_WORKER_INTERVAL_MS=3000
WEBHOOK_MAX_RETRIES=3

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
INTERNAL_API_URL=http://api:4000
```

---

## Quick Start (Docker)

Requirements: Docker Desktop with Compose V2

```bash
cp .env.example .env
docker compose up --build
# or: npm run docker:up
```

| Service | URL |
|---------|-----|
| Web Dashboard | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api-docs |
| PostgreSQL (host) | localhost:5434 |

```bash
npm run docker:down    # Stop all services
npm run docker:clean   # Stop + delete volumes (wipes DB)
```

### Container Startup Sequence (docker-entrypoint.sh)

1. Run `prisma migrate deploy` — applies any pending migrations
2. Run seed script — idempotently creates system plans and demo account/users/keys
3. Start the Express server with `node apps/api/dist/server.js`

---

## Development Setup

```bash
npm install                              # Install all workspace deps

# API (hot reload with tsx watch)
cd apps/api && npm run dev

# Web (Next.js dev server)
cd apps/web && npm run dev

# Run API tests
cd apps/api && npm test

# Prisma
cd apps/api && npm run prisma:generate                        # Regenerate client
cd apps/api && npm run prisma:migrate:dev -- --name <name>    # New migration
```

---

## Load Testing

Install [k6](https://k6.io/docs/getting-started/installation/), then:

```bash
cd load-tests
.\run-k6.ps1   # PowerShell

# Or run a specific scenario directly:
k6 run scenarios/normal-consumption.js --env API_URL=http://localhost:4000
```

| Scenario | Description | SLA Target |
|----------|-------------|-----------|
| `normal-consumption.js` | 20 VUs, steady quota consumption | p95 < 300ms, error rate < 1% |
| `quota-exhaustion.js` | Drive account to 100% quota | Graceful rejection under load |
| `idempotency.js` | Concurrent replays of same requestIds | Consistent decisions always |
| `history-analytics.js` | Read-heavy analytics queries | Read throughput benchmarking |

---

## Pre-seeded Demo Data

Auto-seeded on first container boot:

| Entity | ID | Details |
|--------|----|---------|
| Account | `account_demo_acme` | "Acme Document AI" — Starter plan (10,000 units/month) |
| User | `user_demo_alice` | Alice Developer — Basic plan (1,000 units/month, 20/req) |
| User | `user_demo_bob` | Bob PowerUser — Premium plan (5,000 units/month, 100/req) |
| API Key | `qf_live_demo_acme_production_key_2026` | Active demo key |
| Admin Key | `qf_admin_dev_bootstrap_secret_key_2026` | Admin access (via ADMIN_API_KEY env) |

### System Plans

| Plan ID | Name | Type | Monthly Allowance | Max/Request |
|---------|------|------|-------------------|-------------|
| `plan_account_starter` | Starter | ACCOUNT | 10,000 units | 100 |
| `plan_account_pro` | Pro | ACCOUNT | 100,000 units | 500 |
| `plan_user_basic` | Basic | USER | 1,000 units | 20 |
| `plan_user_premium` | Premium | USER | 5,000 units | 100 |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| PostgreSQL `FOR UPDATE` | Prevents race conditions without optimistic-lock retry loops |
| DB-level idempotency | Unique constraint on `(accountId, requestId)` -> exactly-once semantics |
| Transactional Outbox | Webhook events in same transaction as consumption -> no lost events on crash |
| SHA-256 key storage | Raw API keys never stored — only hash. Key shown once at creation |
| `@quotaflow/shared` package | Single source of truth for types and Zod schemas — no frontend/backend drift |
| Plan versioning | Every plan edit creates an immutable PlanVersion — historical accuracy preserved |
| Dual-scope quota | Account + User limits checked in a single atomic transaction |

---

*Built with Node.js, PostgreSQL, Prisma, Next.js, and Docker.*
"# quotaflow-fts" 
