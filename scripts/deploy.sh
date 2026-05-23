#!/bin/bash
set -e

# ================================================
# Voice Hotline Celo — Server Deploy
# ================================================
# Run on the Hetzner server, from /opt/voice-hotline-celo.
#
# Required env vars (set before running or export inline):
#   UPSTASH_REDIS_REST_URL
#   UPSTASH_REDIS_REST_TOKEN
#   CELO_RPC_URL  (optional, defaults to forndo.celo.org)
#
# All secrets are written to .env.hetzner so PM2 (via
# ecosystem.config.js) can load them. start.sh is now
# a dumb launcher that just sets PORT/NODE_ENV and calls
# .next/standalone/server.js — no secrets live there.
# ================================================

PROJECT_DIR="/opt/voice-hotline-celo"
cd "$PROJECT_DIR"

UPSTASH_URL="${UPSTASH_REDIS_REST_URL:-https://game-corgi-122374.upstash.io}"
UPSTASH_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-}"
CELO_RPC="${CELO_RPC_URL:-https://forno.celo.org}"

echo "=== Step 1: Pull latest ==="
if [ ! -d .git ]; then
  echo "    .git missing — re-initialising from origin…"
  git init -q
  git remote add origin https://github.com/sneldao/voice-agent-hotline.git 2>/dev/null || true
  git fetch -q origin main
  git reset -q --hard origin/main
else
  git fetch -q origin main
  git reset -q --hard origin/main
fi

echo "=== Step 2: Install dependencies ==="
pnpm install --no-frozen-lockfile

echo "=== Step 3: Build standalone (postbuild auto-cleans) ==="
NODE_ENV=production pnpm build

echo "=== Step 4: Drop build-only deps & legacy dirs ==="
rm -rf node_modules
rm -rf out

echo "=== Step 5: Write .env.hetzner (PM2 reads this) ==="
cat > "$PROJECT_DIR/.env.hetzner" << ENVFILE
NODE_ENV=production
PORT=3042
HOSTNAME=0.0.0.0
CELO_RPC_URL=${CELO_RPC}
UPSTASH_REDIS_REST_URL=${UPSTASH_URL}
UPSTASH_REDIS_REST_TOKEN=${UPSTASH_TOKEN}
UPSTASH_REDIS_URL=${UPSTASH_URL}
UPSTASH_REDIS_TOKEN=${UPSTASH_TOKEN}
ENVFILE

echo "=== Step 6: Reload PM2 with new ecosystem config ==="
# Delete stale PM2 process (uses old script path / env vars),
# then re-add using the current ecosystem.config.js.
pm2 delete voice-hotline-celo 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "=== Step 7: Health check ==="
sleep 3
HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:3042/api/agents || echo "000")
if echo "$HTTP_CODE" | grep -qE '^(2|4)0[0-9]$'; then
    echo "✅ API responding (HTTP $HTTP_CODE)"
else
    echo "⚠️  API not responding (HTTP $HTTP_CODE) — check: pm2 logs voice-hotline-celo"
fi

echo ""
echo "=== Disk Usage ==="
du -sh "$PROJECT_DIR"