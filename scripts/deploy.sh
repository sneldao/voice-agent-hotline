#!/bin/bash
set -e

# ================================================
# Voice Hotline — Server-Side Deploy (fallback)
# ================================================
# Run on the Hetzner server, from /opt/voice-hotline.
#
# This is the FALLBACK deploy for when you can't build
# locally. The preferred flow is `make deploy` which
# builds locally and rsyncs to the server.
#
# This script does NOT touch .env.hetzner — manage
# that file manually on the server.
# ================================================

PROJECT_DIR="/opt/voice-hotline"
cd "$PROJECT_DIR"

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

echo "=== Step 4: Drop build-only deps ==="
rm -rf node_modules
rm -rf out

echo "=== Step 5: Set up current symlink ==="
# For server-side builds, point current → project root
# (the standalone is at .next/standalone/ within the project)
# Copy standalone to a release dir for consistency with the
# local-build flow
RELEASES_DIR="$PROJECT_DIR/releases"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELEASE_PATH="$RELEASES_DIR/$TIMESTAMP"
mkdir -p "$RELEASES_DIR"
cp -r .next/standalone "$RELEASE_PATH"
ln -sfn "$RELEASE_PATH" "$PROJECT_DIR/current"

# Clean up old releases (keep last 3)
cd "$RELEASES_DIR"
ls -1t | tail -n +4 | xargs -r rm -rf
cd "$PROJECT_DIR"

echo "=== Step 6: Reload PM2 ==="
pm2 delete voice-hotline 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "=== Step 7: Health check ==="
sleep 3
HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:3042/api/agents || echo "000")
if echo "$HTTP_CODE" | grep -qE '^(2|4)0[0-9]$'; then
    echo "✅ API responding (HTTP $HTTP_CODE)"
else
    echo "⚠️  API not responding (HTTP $HTTP_CODE) — check: pm2 logs voice-hotline"
fi

echo ""
echo "=== Disk Usage ==="
du -sh "$PROJECT_DIR"
du -sh "$PROJECT_DIR/current/" 2>/dev/null || true
