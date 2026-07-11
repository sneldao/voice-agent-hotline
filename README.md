# VOISSS — Voice Agent Hotline

A voice-first AI agent marketplace. Browse the directory, pick up a line, and task specialist agents using natural speech — no keyboard required. Pay per minute in USDC on Arbitrum.

**Live:** [voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)
**API:** [api.sneldao.com](https://api.sneldao.com) (Hetzner VPS, port 3042)

---

## Quick Start

```bash
git clone https://github.com/sneldao/voice-agent-hotline.git
cd voice-agent-hotline
pnpm install
cp .env.local.example .env.local
# Fill in your API keys (ElevenLabs, Upstash, WalletConnect, etc.)
pnpm dev
```

Seed ElevenLabs agents with tool configs:
```bash
pnpm tsx scripts/seed-elevenlabs.ts
```

---

## Tech Stack

| Layer | |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS, Fraunces (display) + JetBrains Mono (codes) + IBM Plex Sans (body) |
| Voice | ElevenLabs Conversational AI via controlled `<elevenlabs-convai>` widget (`components/WidgetEngine.tsx`) |
| Payments | x402 / USDC on Arbitrum via MetaMask Smart Accounts — 80/20 platform/agent split (ledgered until PaymentRouter) |
| Settlement | 1Shot Permissionless Relayer — gasless on-chain settlement |
| Identity | ERC-8004 delegation registry (Arbitrum Sepolia, testnet) |
| LLM | Venice AI (privacy-first research) |
| Tools | Firecrawl (web), Composio (GitHub, Solana) |
| Storage | Upstash Redis |
| Infra | Vercel (frontend) + Hetzner VPS (API, PM2 standalone) |

---

## Agents

| Agent | Specialty | Voice |
|---|---|---|
| Solana Sage | Blockchain analytics, wallet balances | Josh |
| Code Reviewer | GitHub operations, code reviews | Antoni |
| General Helper | Booking, ordering, scheduling | Adam |
| Tour Master | Travel planning, price comparison | Rachel |
| Web Researcher | Real-time web search (ElevenLabs agent) | Steve |
| Medical Advisor | Health visit prep, symptoms, questions | Sarah |

Each agent has a unique voice, system prompt, and tool set invoked via webhooks during calls. See `lib/agent-registry.ts` for the canonical list and `lib/agent-personas.ts` for the display copy.

---

## Architecture

```
Voice Layer (ElevenLabs ConvAI widget) → Webhook Handler (tool routing)
  → Skill Execution (Firecrawl, Composio, Venice AI)
    → Settlement (x402 → 1Shot relayer → Arbitrum)
```

- **WidgetEngine** mounts a single offscreen `<elevenlabs-convai>` element via `WidgetEngineProvider` and controls it programmatically
- **ActiveCall** is the switchboard-style operator console during a conversation
- **Directory** (`components/DiscoverTab.tsx` + `DirectoryRow`) is the phonebook — mono dial codes, live activity, per-minute price, no card grid
- **CostPanel** is the first-class cost surface: per-minute rate, optional cap ($0.50 / $1 / $2 / $5 / Open), live ticker with soft "30s left on the line" warnings
- **LiveActivity** ticker shows "3 on the line · 17 in the last hour" from `/api/activity/live` — fails soft and hides if there's no activity
- **Webhook** routes tool calls per-agent and handles x402 payment negotiation
- **DelegationRegistry** (ERC-8004, Arbitrum Sepolia) manages agent permissions

---

## Contract

| Contract | Network | Address |
|---|---|---|
| DelegationRegistry (ERC-8004) | Arbitrum Sepolia (chain 421614) | `0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00` |
| ERC-8004 Identity (reference) | Arbitrum Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation (reference) | Arbitrum Sepolia | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

The Identity and Reputation contracts are ERC-8004 reference deployments. The DelegationRegistry is this project's `contracts/DelegationRegistry.sol`.

---

## Key Env Vars

```
ELEVENLABS_API_KEY              # Required — voice agent API
ELEVENLABS_CONVERSATIONAL_ENABLED=true

VENICE_API_KEY                  # Venice AI inference key

UPSTASH_REDIS_REST_URL          # Data persistence
UPSTASH_REDIS_REST_TOKEN

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

ARBITRUM_RPC_URL                # https://sepolia-rollup.arbitrum.io/rpc (default)
PAYMENT_RECEIVER                # Platform wallet (20% of every settled call)
PLATFORM_WALLET                 # Same role as PAYMENT_RECEIVER (alias used by settlement)

NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS
NEXT_PUBLIC_PLATFORM_ADDRESS

ONESHOT_RELAYER_URL             # https://relayer.1shotapi.com (default)
```

See `.env.local.example` for the full list with defaults.

---

## Repo Conventions

- `app/` — Next.js routes only. Reusable components live in `components/`.
- `lib/` — domain helpers, data layer, hooks (mixed but small; reshuffle deferred).
- `app/api/activity/live` — proof-of-life endpoint for the directory ticker.
- `.githooks/pre-commit` — installs on `pnpm install`; scans for common secret shapes (Upstash, AWS, GitHub, Stripe, ElevenLabs, generic base64url ≥40 chars).
- Two lockfiles present (`package-lock.json` + `pnpm-lock.yaml`) — the project uses pnpm; the npm one is for tooling compatibility and is not authoritative.

---

## Docs

- [`docs/AGENTIC_ARCHITECTURE.md`](docs/AGENTIC_ARCHITECTURE.md) — agent lifecycle, on-chain identity, payment flow
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel + Hetzner dual deploy
- [`docs/HETZNER_DEPLOYMENT.md`](docs/HETZNER_DEPLOYMENT.md) — `make deploy` walkthrough
- [`docs/SECURITY_ARCHITECTURE_COMPARISON.md`](docs/SECURITY_ARCHITECTURE_COMPARISON.md) — payment security model
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — current perf hot spots
- [`docs/WIDGET_ARCHITECTURE.md`](docs/WIDGET_ARCHITECTURE.md) — voice widget control layer
- [`docs/STREAMING_INTEGRATION.md`](docs/STREAMING_INTEGRATION.md) — historical note on Superfluid / WDK (inactive)

---

Built with [Cursor](https://cursor.sh) + [ElevenLabs](https://elevenlabs.io) · MIT

