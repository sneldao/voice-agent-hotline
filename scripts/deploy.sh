#!/bin/bash
set -e

# ================================================
# Voice Hotline Celo — Server Deploy (Space Optimized)
# ================================================
# Run on the Hetzner server, from /opt/voice-hotline-celo.
#
# Cleanup of intermediate .next/* artifacts is handled
# automatically by the `postbuild` hook in package.json
# (scripts/cleanup-standalone.sh) — this script only
# handles things that hook can't, like node_modules and
# the deprecated `out/` directory.
# ================================================

PROJECT_DIR="/opt/voice-hotline-celo"
cd "$PROJECT_DIR"

echo "=== Step 1: Pre-deploy cache wipe ==="
# Wipe webpack cache so the next build starts cold-but-clean
rm -rf .next/cache .next/standalone/.next/cache

echo "=== Step 2: Pull latest changes ==="
# Re-init .git silently if it's missing (e.g. first deploy after
# old script nuked it). Otherwise just pull.
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

echo "=== Step 3: Install dependencies ==="
pnpm install --no-frozen-lockfile

echo "=== Step 4: Build standalone (postbuild auto-cleans) ==="
# NODE_ENV=production triggers scripts/cleanup-standalone.sh
# to remove .next/{cache,server,static,types,trace}, copy assets
# into .next/standalone/, and preserve .git + source.
NODE_ENV=production pnpm build

echo "=== Step 5: Drop build-only deps & legacy dirs ==="
# Standalone has its own bundled node_modules — top-level is
# only needed during build.
rm -rf node_modules
# `out/` was for static export; frontend now lives on Vercel.
rm -rf out

echo "=== Step 6: Write persistent launcher ==="
cat > /opt/voice-hotline-celo/start.sh << 'LAUNCHER'
#!/bin/bash
export NODE_ENV=production
export PORT=3042
export HOSTNAME=0.0.0.0

# Upstash Redis
export UPSTASH_REDIS_REST_URL="https://us1-small-reindeer-45942.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="ABApIkNBRDEzODU5MTA0NThlYzc4ZjM4ZjEzZTBkMTVjZDE1ODMyOXwxODU1Nzk3MzIwNDU3Njk3Njc3"
export UPSTASH_REDIS_URL="${UPSTASH_REDIS_REST_URL}"
export UPSTASH_REDIS_TOKEN="${UPSTASH_REDIS_REST_TOKEN}"

# Celo RPC
export CELO_RPC_URL="https://forno.celo.org"

cd /opt/voice-hotline-celo/.next/standalone && exec node server.js
LAUNCHER
chmod +x /opt/voice-hotline-celo/start.sh

echo "=== Step 7: Restart PM2 ==="
pm2 restart voice-hotline-celo

# Wait for startup and verify
sleep 3
if curl -sf -o /dev/null -w '%{http_code}' http://localhost:3042/api/agents | grep -qE '^(2|4)0[0-9]$'; then
    echo "✅ Deployment successful! API is responding."
else
    echo "⚠️  Deployment complete but API health check failed. Check: pm2 logs voice-hotline-celo"
fi

echo ""
echo "=== Disk Usage ==="
du -sh "$PROJECT_DIR"
du -sh "$PROJECT_DIR"/.[!.]* "$PROJECT_DIR"/* 2>/dev/null | sort -h | tail -10
