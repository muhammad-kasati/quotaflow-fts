# Multi-stage Dockerfile for QuotaFlow API
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN npm ci

# Copy source code and Prisma schema
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared package
RUN npm run build --workspace=@quotaflow/shared

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build API application
RUN npm run build --workspace=@quotaflow/api

# Production Runner Image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

# Install curl/netcat for healthcheck
RUN apk add --no-cache curl postgresql-client

# Copy package manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy generated Prisma Client, built files, and Prisma migrations
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

EXPOSE 4000

# Controlled startup script that deploys migrations, seeds demo data idempotently, and starts the server
COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
