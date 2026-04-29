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

echo "=== Step 5: Post-build cleanup ==="
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

echo "=== Step 6: Restart PM2 ==="
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