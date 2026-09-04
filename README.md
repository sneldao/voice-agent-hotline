# Claflin — voice-native broker desk

A voice-first trading desk. Pick up the line, ask about tokenized stocks, and place paper trades by voice. The first Claflin broker is **Hetty** — conservative, independent, and obsessed with confirmation before execution.

**Live:** [your-claflin-app.vercel.app](https://your-claflin-app.vercel.app)  
**API:** [api.your-claflin-app.com](https://api.your-claflin-app.com) (Hetzner VPS, port 3042)

---

## Quick Start

```bash
git clone https://github.com/sneldao/claflin.git
cd claflin
pnpm install
cp .env.local.example .env.local
# Fill in your API keys (ElevenLabs, Upstash, WalletConnect, etc.)
pnpm dev
```

Seed the Hetty broker and tools in ElevenLabs:

```bash
pnpm tsx scripts/seed-elevenlabs.ts
```

Then seed the directory:

```bash
curl -X POST https://your-claflin-app.vercel.app/api/agents/seed
```

---

## Tech Stack

| Layer | |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS, Fraunces (display) + JetBrains Mono (codes) + IBM Plex Sans (body) |
| Voice | ElevenLabs Conversational AI via controlled `<elevenlabs-convai>` widget (`components/WidgetEngine.tsx`) |
| Payments | x402 / USDC on Arbitrum via MetaMask Smart Accounts — 80/20 platform/broker split (ledgered until PaymentRouter) |
| Settlement | 1Shot Permissionless Relayer — gasless on-chain settlement |
| Identity | ERC-8004 delegation registry (Arbitrum Sepolia, testnet) |
| LLM | Venice AI (privacy-first research) |
| Tools | Firecrawl (web research), Coinbase / broker APIs via Composio (where available) |
| Storage | Upstash Redis |
| Infra | Vercel (frontend) + Hetzner VPS (API, PM2 standalone) |

---

## Brokers

| Broker | Specialty | Voice |
|---|---|---|
| **Hetty** | Tokenized stocks, conservative execution, confirmation-first voice trading | Adam |
| Benham | Fundamental research and earnings analysis | Josh |
| Woodhull | Growth & momentum, thematic baskets | Antoni |
| Claflin Concierge | Account questions, hand-offs, and desk routing | Rachel |
| Baruch *(planned)* | Macro, rates, and real-time market news | Steve |
| Marks *(planned)* | Risk, position sizing, and portfolio health | Sarah |

The canonical broker registry lives in `lib/agent-registry.ts`; display personas live in `lib/agent-personas.ts`. The `general_helper` entry (Hetty) is the default concierge in `components/DiscoverTab.tsx`.

---

## Architecture

```
Voice Layer (ElevenLabs ConvAI widget) → Webhook Handler (tool routing)
  → Skill Execution (web research, quote lookup, simulated trade intent)
    → Settlement (x402 → 1Shot relayer → Arbitrum)
```

- **WidgetEngine** mounts a single offscreen `<elevenlabs-convai>` element via `WidgetEngineProvider` and controls it programmatically.
- **ActiveCall** is the broker-desk console during a conversation: live cost ticker, cap selector, and mute/hang-up.
- **Broker desk** (`components/DiscoverTab.tsx` + `DirectoryRow`) is the directory — mono dial codes, live activity, per-minute price.
- **CostPanel** is the first-class cost surface: per-minute rate, optional cap ($0.50 / $1 / $2 / $5 / Open), live ticker with soft "30s left on the line" warnings.
- **LiveActivity** ticker shows "3 on the line · 17 in the last hour" from `/api/activity/live` — fails soft and hides if there's no activity.
- **Webhook** routes tool calls per-broker and handles x402 payment negotiation.
- **DelegationRegistry** (ERC-8004, Arbitrum Sepolia) manages broker permissions.

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
- `lib/` — domain helpers, data layer, hooks.
- `app/api/activity/live` — proof-of-life endpoint for the broker-desk ticker.
- `.githooks/pre-commit` — installs on `pnpm install`; scans for common secret shapes (Upstash, AWS, GitHub, Stripe, ElevenLabs, generic base64url ≥40 chars).
- The project uses pnpm. A stale `package-lock.json` was removed; do not reintroduce it.

---

## Docs

- [`ROADMAP.md`](ROADMAP.md) — Claflin product status, completed phases, beta plan, and roadmap to real-money execution
- [`docs/AGENTIC_ARCHITECTURE.md`](docs/AGENTIC_ARCHITECTURE.md) — broker lifecycle, on-chain identity, payment flow
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel + Hetzner dual deploy
- [`docs/HETZNER_DEPLOYMENT.md`](docs/HETZNER_DEPLOYMENT.md) — `make deploy` walkthrough
- [`docs/SECURITY_ARCHITECTURE_COMPARISON.md`](docs/SECURITY_ARCHITECTURE_COMPARISON.md) — payment security model
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — current perf hot spots
- [`docs/WIDGET_ARCHITECTURE.md`](docs/WIDGET_ARCHITECTURE.md) — voice widget control layer
- [`docs/REDIS_KEYS.md`](docs/REDIS_KEYS.md) — Redis key naming conventions and data structures
- [`docs/ERROR_RESILIENCE.md`](docs/ERROR_RESILIENCE.md) — how Claflin survives CORS and backend hiccups
- [`docs/STREAMING_INTEGRATION.md`](docs/STREAMING_INTEGRATION.md) — historical note on Superfluid / WDK (inactive)

---

Built for Hetty · MIT
