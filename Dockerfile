# ============================================
# Claflin - Production Dockerfile
# ============================================
# Multi-stage build for minimal production image
# Usage:
#   docker build -t claflin .
#   docker run -p 3000:3000 --env-file .env.local claflin

# ── Stage 1: Dependencies ────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Build ───────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Next.js needs these at build time — provide safe defaults
ENV NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_PAYMENTS_ENABLED=true
ENV NEXT_PUBLIC_ERC8004_ENABLED=false
ENV UPSTASH_REDIS_REST_URL=https://placeholder.upstash.io
ENV UPSTASH_REDIS_REST_TOKEN=placeholder

RUN npm run build

# ── Stage 3: Production ──────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/sdk/health || exit 1

CMD ["node", "server.js"]
