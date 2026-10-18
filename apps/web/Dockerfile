# Multi-stage Dockerfile for Next.js Web Dashboard
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN npm ci

# Copy sources
COPY packages/shared packages/shared
COPY apps/web apps/web

# Build shared package
RUN npm run build --workspace=@quotaflow/shared

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@quotaflow/web

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# In standalone mode, static assets are copied to apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
