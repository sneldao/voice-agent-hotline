# Deployment Guide

## Overview

The app supports two deployment targets that run simultaneously:

| Target | URL | Notes |
|---|---|---|
| Vercel | `voisss-agent-hotline.vercel.app` | Auto-deploys from `main`; serverless API routes |
| VPS (Hetzner) | `voisss.celo.famile.xyz` | PM2 standalone server on port 3042 |

Both targets connect to the same **Upstash Redis** instance, so agent data is shared.

---

## Vercel Deployment

### One-click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsneldao%2Fvoice-agent-hotline)

### Environment Variables (Vercel Dashboard)

Set these under **Settings → Environment Variables**:

```
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE=
ELEVENLABS_CONVERSATIONAL_ENABLED=true

UPSTASH_REDIS_REST_URL=https://harmless-chigger-79190.upstash.io
UPSTASH_REDIS_REST_TOKEN=

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_API_URL=https://voisss.celo.famile.xyz

NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00

NEXT_PUBLIC_PLATFORM_ADDRESS=
NEXT_PUBLIC_FACILITATOR_ADDRESS=
FACILITATOR_PRIVATE_KEY=
PAYMENT_RECEIVER=
AGENT_WALLET=

OPENCLAW_WEBHOOK_SECRET=
```

After updating env vars, trigger a manual redeploy — Vercel only picks up new values on the next build.

### Seed agents after deploy

```bash
curl -X POST https://voisss-agent-hotline.vercel.app/api/agents/seed
```

---

## VPS Deployment

See [`docs/HETZNER_DEPLOYMENT.md`](HETZNER_DEPLOYMENT.md) for the full VPS setup.

### Quick update (already configured)

```bash
ssh snel-bot "cd /opt/voice-hotline-celo && git pull origin main && npm run build && pm2 restart voice-hotline-celo && pm2 save"
```

### Check status

```bash
ssh snel-bot "pm2 status && curl -s http://localhost:3042/api/agents | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d[\"agents\"]), \"agents\")'"
```

---

## Dual-Deployment Architecture

```
Browser
  └─► Vercel (HTML/JS/CSS)
        └─► NEXT_PUBLIC_API_URL = https://voisss.celo.famile.xyz
              └─► VPS Next.js standalone (port 3042)
                    └─► Upstash Redis (shared)
```

When `NEXT_PUBLIC_API_URL` is set, all `/api/...` fetch calls from the browser are routed to the VPS via `lib/api.ts`. Vercel's serverless functions are bypassed for data operations.

If `NEXT_PUBLIC_API_URL` is unset, Vercel's own serverless functions handle API calls directly (also reading from the same Upstash Redis).

---

## After Any Deployment

1. Verify agents are live: `GET /api/agents`
2. If empty, seed: `POST /api/agents/seed`
3. Check stats: `GET /api/agents/stats`
