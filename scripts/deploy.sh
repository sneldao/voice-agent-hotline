#!/bin/bash
set -e

# Voice Hotline Celo Deployment Script (Space Optimized)
# This script ensures minimal disk usage on the server

PROJECT_DIR="/opt/voice-hotline-celo"
cd "$PROJECT_DIR"

echo "=== Step 1: Pre-deploy cleanup ==="
# Remove old build artifacts and cache BEFORE pulling (faster)
rm -rf .next/cache .next/server .next/static .next/types .next/trace .next/standalone/.next/cache

echo "=== Step 2: Pull latest changes ==="
git pull

echo "=== Step 3: Install dependencies ==="
pnpm install --prod --no-frozen-lockfile

echo "=== Step 4: Build standalone ==="
pnpm build

echo "=== Step 5: Copy static assets into standalone ==="
# Next.js standalone does not include these automatically
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo "=== Step 5b: Post-build cleanup ==="
# Remove everything EXCEPT the standalone runtime
# This is what PM2 actually needs
rm -rf .next/cache
rm -rf .next/server
rm -rf .next/static
rm -rf .next/types
rm -rf .next/trace
rm -rf .next/standalone/.next/cache
rm -rf node_modules  # Not needed - standalone has its own

# Also clean up other non-essentials
rm -rf .git  # Not needed at runtime
rm -rf out   # Frontend goes to Vercel, not here

echo "=== Step 6: Write persistent launcher ==="
# Write start.sh to /opt (not /tmp) so it survives OS cleanup
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
if curl -sf http://localhost:3042/api/agents > /dev/null 2>&1; then
    echo "✅ Deployment successful! API is healthy."
else
    echo "⚠️  Deployment complete but API health check failed. Check logs: pm2 logs voice-hotline-celo"
fi

# Show final disk usage
echo ""
echo "=== Disk Usage ==="
du -sh .[!.]* * 2>/dev/null | sort -h | tail -10