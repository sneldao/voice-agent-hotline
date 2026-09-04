# Deployment Guide

## Overview

| Target | URL | Notes |
|---|---|---|
| Vercel | `voisss-agent-hotline.vercel.app` | Auto-deploys from `main`; serverless API routes |
| VPS (Hetzner) | `api.sneldao.com` | PM2 standalone server on port 3042; ~52 MB |

Both targets share the same **Upstash Redis** instance (`game-corgi-122374.upstash.io`).

---

## Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsneldao%2Fvoice-agent-hotline)

### Environment Variables (Vercel Dashboard)

```
ELEVENLABS_API_KEY=
ELEVENLABS_CONVERSATIONAL_ENABLED=true

UPSTASH_REDIS_REST_URL=https://game-corgi-122374.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
# Same-origin API proxy (kills browser CORS — see below)
API_PROXY_TARGET=https://api.sneldao.com

NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00
NEXT_PUBLIC_PLATFORM_ADDRESS=0x54351049081A5A64Ea93c56b666830ED5076b960
```

After updating env vars, trigger a manual redeploy — Vercel only picks up new values on the next build.

### Seed agents

```bash
curl -X POST https://voisss-agent-hotline.vercel.app/api/agents/seed
```

---

## Hetzner VPS Deployment

See [`docs/HETZNER_DEPLOYMENT.md`](HETZNER_DEPLOYMENT.md).

```bash
export UPSTASH_REDIS_REST_TOKEN=your_token
make deploy   # full: git pull → build → clean → restart
make logs     # PM2 logs
make status   # PM2 status
make restart  # restart without rebuilding
```

---

## Dual-Deployment Architecture

```
Browser
  └─► Vercel (HTML/JS/CSS) — same-origin /api/* calls
        └─► API_PROXY_TARGET = https://api.sneldao.com  (server-to-server rewrite)
              └─► Hetzner Next.js standalone (port 3042)
                    └─► Upstash Redis (shared)
```

**Preferred: same-origin proxy.** Set `API_PROXY_TARGET` on Vercel. The browser only ever
talks to its own origin; Vercel forwards `/api/*` to the VPS server-to-server. No browser
CORS, no preflight round-trips, and backend restarts surface as ordinary retryable 5xxs
instead of opaque CORS failures.

**Legacy: direct cross-origin.** Set `NEXT_PUBLIC_API_URL` instead and the browser calls
the VPS directly. This still works — `middleware.ts` answers all OPTIONS preflights and
stamps CORS headers on every API response — but prefer the proxy.

If neither is set, Vercel's serverless functions handle API calls directly (same Redis).

---

## After Any Deployment

1. Verify agents: `GET /api/agents`
2. If empty, seed: `POST /api/agents/seed`
3. Check stats: `GET /api/agents/stats`