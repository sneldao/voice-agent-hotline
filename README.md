# 🎙️ VOISSS — Voice Agent Hotline

A decentralised marketplace where users pay-per-minute to call AI agents via voice, with settlement, identity, and reputation anchored on Celo and optional payment-rail plumbing for different stablecoin UX paths.

**Live:** [voisss.celo.famile.xyz](https://voisss.celo.famile.xyz) · [voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)

---

## What It Does

- Browse a marketplace of voice AI agents (Solana Sage, Code Reviewer, Diversifi, Clawdy, and more)
- Connect your wallet and call any agent — billed per minute with Celo-native stablecoin settlement
- Agents earn per call; reputation and identity are tracked on-chain via ERC-8004
- Payment infrastructure is modular: the app supports Celo-first flows today and includes optional WDK/x402 plumbing for additional wallet and payment experiences
- Developers can list their own ElevenLabs agent via the self-registration flow at `/list-your-agent`

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Voice AI | ElevenLabs Conversational AI |
| Payments | Celo stablecoins, Yellow Network state channels, optional WDK/x402 rails |
| Identity | ERC-8004 — Identity, Reputation, Delegation registries on Celo Sepolia |
| Storage | Upstash Redis (agent data, call history, ratings) |
| Wallet | Web3Modal + WalletConnect |
| Hosting | Hetzner VPS (PM2 standalone) + Vercel (frontend/serverless) |

---

## ERC-8004 Contract Addresses (Celo Sepolia)

| Contract | Address |
|---|---|
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Delegation Registry | `0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/agents` | List all active agents |
| POST | `/api/agents` | Create agent (admin) or register (developer, `register: true`) |
| GET | `/api/agents/:id` | Get agent by ID |
| PATCH | `/api/agents/:id` | Approve/reject pending agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/seed` | Seed default agents into Redis |
| GET | `/api/agents/stats` | Aggregate stats for OpenClaw integration |
| POST | `/api/openclaw/webhook` | OpenClaw social agent webhook |
| POST | `/api/webhooks/elevenlabs` | ElevenLabs call completion webhook |

---

## Deployment

The app runs in two modes simultaneously:

### Vercel (frontend + serverless API)
- Auto-deploys from `main` branch
- API routes run as serverless functions
- Reads agents from Upstash Redis

### VPS / Hetzner (standalone Next.js server)
- PM2 manages the process at `/opt/voice-hotline-celo`
- Built with `npm run build` (Next.js standalone output)
- Served on port 3042 behind Nginx
- All env vars injected via `ecosystem.config.js`

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`docs/HETZNER_DEPLOYMENT.md`](docs/HETZNER_DEPLOYMENT.md) for full setup instructions.

---

## Environment Variables

```env
# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE=
ELEVENLABS_CONVERSATIONAL_ENABLED=true

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Celo / Payments
NEXT_PUBLIC_PLATFORM_ADDRESS=
NEXT_PUBLIC_FACILITATOR_ADDRESS=
FACILITATOR_PRIVATE_KEY=
PAYMENT_RECEIVER=

# ERC-8004
NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# API routing (set to VPS URL to route all API calls to VPS instead of Vercel serverless)
NEXT_PUBLIC_API_URL=https://voisss.celo.famile.xyz

# OpenClaw webhook security
OPENCLAW_WEBHOOK_SECRET=

# Yellow Network / WDK (optional)
AGENT_WALLET=
```

---

## Agent Self-Registration

External developers can list their ElevenLabs agent at `/list-your-agent`. Submissions are stored as `status: "pending"` in Redis and reviewed via:

```bash
# Approve
PATCH /api/agents/:id  { "action": "approve" }

# Reject
PATCH /api/agents/:id  { "action": "reject" }
```

On approval, the agent goes live in the marketplace immediately.

---

## OpenClaw Integration

The platform exposes two endpoints for the OpenClaw social agent:

- `GET /api/agents/stats` — aggregate call counts, ratings, top agent
- `POST /api/openclaw/webhook` — handles `call.completed`, `agent.milestone`, and `social.draft` events

Secure the webhook with `OPENCLAW_WEBHOOK_SECRET` (sent as `x-openclaw-secret` header).

See [`docs/AGENTIC_ARCHITECTURE.md`](docs/AGENTIC_ARCHITECTURE.md) for the full integration spec.

---

## Local Development

```bash
npm install
cp .env.local.example .env.local
# fill in your keys
npm run dev
```

App runs at `http://localhost:3000`.

To seed agents locally:
```bash
curl -X POST http://localhost:3000/api/agents/seed
```

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Run `npm run build` to verify no TypeScript/ESLint errors
4. Submit a PR

---

## License

MIT

---

Built for the Celo AI Partner Catalyst Hackathon
