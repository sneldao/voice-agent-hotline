#!/bin/bash
# ================================================
# Standalone Build Cleanup
# ================================================
# Runs automatically after `next build` (via package.json `postbuild`).
#
# Always:
#   - Copies .next/static and public/ into .next/standalone/
#     (Next.js standalone does NOT do this automatically)
#
# Only when CLEANUP_BUILD=1 OR NODE_ENV=production:
#   - Removes intermediate build artifacts the standalone runtime
#     does NOT need (saves ~1.2 GB on the Hetzner server).
#   - Preserves .git so subsequent `git pull` works.
#   - Preserves source files & package.json so the project stays
#     re-deployable from the same directory.
#
# Locally (no env vars set), only the asset copy happens — your
# `.next/` directory is left intact for `next start` / dev tooling.
# ================================================

set -e

# Resolve project root (parent of scripts/)
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Bail if there's no standalone build (e.g. someone disabled output: 'standalone')
if [ ! -d ".next/standalone" ]; then
  echo "[cleanup-standalone] No .next/standalone — skipping."
  exit 0
fi

# Skip cleanup on Vercel — Vercel needs the full .next directory (including .next/server)
# for its own deployment pipeline. This script is only meaningful for standalone
# (Hetzner / VPS) deploys.
if [ -n "$VERCEL" ]; then
  echo "[cleanup-standalone] Vercel environment detected — skipping cleanup."
  exit 0
fi

echo "[cleanup-standalone] Copying static assets into standalone…"
# Copy/refresh static + public so the standalone server can serve them
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
[ -d ".next/static" ] && cp -r .next/static .next/standalone/.next/static
[ -d "public" ] && { rm -rf .next/standalone/public; cp -r public .next/standalone/public; }

# Only do destructive cleanup in production / when explicitly requested
if [ "$CLEANUP_BUILD" = "1" ] || [ "$NODE_ENV" = "production" ]; then
  echo "[cleanup-standalone] Production cleanup — removing intermediate build artifacts…"
  rm -rf .next/cache
  rm -rf .next/server
  rm -rf .next/static
  rm -rf .next/types
  rm -rf .next/trace
  rm -rf .next/standalone/.next/cache
  # NOTE: We intentionally do NOT delete:
  #   - node_modules     (handled by deploy.sh after this runs, since
  #                       postbuild itself runs INSIDE node_modules tooling)
  #   - .git             (needed for next `git pull`)
  #   - source files     (needed to rebuild)
  echo "[cleanup-standalone] Done. Standalone runtime preserved at .next/standalone/"
else
  echo "[cleanup-standalone] Local build — keeping .next/ intact."
  echo "[cleanup-standalone] (Set CLEANUP_BUILD=1 or NODE_ENV=production to auto-clean.)"
fi
