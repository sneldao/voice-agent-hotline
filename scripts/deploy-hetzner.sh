#!/bin/bash
set -euo pipefail

# ================================================
# Deploy to Hetzner — Local Build, Remote Run
# ================================================
# Builds the Next.js standalone bundle locally,
# then rsyncs only the runtime artifacts to the
# server. No install/build happens on the server.
#
# Usage:
#   ./scripts/deploy-hetzner.sh
#
# Prerequisites:
#   - Access to the `snel-bot` SSH host configured
#   - Node + pnpm locally (matching server versions)
# ================================================

REMOTE_HOST="snel-bot"
REMOTE_DIR="/opt/voice-hotline-celo"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Step 1: Install dependencies (local) ==="
cd "$LOCAL_DIR"
npm install

echo ""
echo "=== Step 2: Build standalone (local) ==="
# NODE_ENV=production triggers cleanup-standalone.sh postbuild
# to strip intermediate artifacts and copy assets into standalone
NODE_ENV=production npm run build

echo ""
echo "=== Step 3: Rsync standalone bundle to server ==="
# Only sync what the runtime needs:
#   .next/standalone/  — compiled server + traced deps + static assets
# We explicitly DO NOT sync:
#   .env.hetzner       — server-specific secrets
#   ecosystem.config.js — server's PM2 config (kept as-is)
#   node_modules/      — not present on server (bundled in standalone)
rsync -az --delete --no-perms --no-owner --no-group \
  "$LOCAL_DIR/.next/standalone/" \
  "$REMOTE_HOST:$REMOTE_DIR/.next/standalone/"

echo ""
echo "=== Step 4: Restart PM2 on server ==="
ssh "$REMOTE_HOST" "pm2 restart voice-hotline-celo"

echo ""
echo "=== Step 5: Health check ==="
sleep 3
HEALTH=$(ssh "$REMOTE_HOST" "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3042/api/agents 2>/dev/null || echo 'failed'")
if echo "$HEALTH" | grep -qE '^(2|4)0[0-9]$'; then
  echo "✅ Deployment successful! API responded with HTTP $HEALTH."
else
  echo "⚠️  Health check returned $HEALTH. Check: pm2 logs voice-hotline-celo"
fi

echo ""
echo "=== Disk usage (server) ==="
ssh "$REMOTE_HOST" "du -sh $REMOTE_DIR && du -sh $REMOTE_DIR/.next/standalone/"

echo ""
echo "Done."
