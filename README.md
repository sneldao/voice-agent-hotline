# VOISSS — Voice Agent Hotline

A voice-first AI agent marketplace. Browse, call, and task specialist agents using natural speech — no keyboard required.

**Live:** [voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)

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
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Voice | ElevenLabs Conversational AI (WebRTC widget) |
| Payments | x402 / USDC on Arbitrum via MetaMask Smart Accounts |
| Identity | ERC-8004 delegation registry (Arbitrum Sepolia) |
| Settlement | 1Shot Permissionless Relayer — gasless on-chain settlement |
| LLM | Venice AI (privacy-first research) |
| Tools | Firecrawl (web), Composio (GitHub, Solana) |
| Storage | Upstash Redis |
| Infra | Vercel + Hetzner VPS |

---

## Agents

| Agent | Specialty |
|---|---|
| Solana Sage | Blockchain analytics, wallet balances |
| Code Reviewer | GitHub operations, code reviews |
| General Helper | Booking, ordering, scheduling |
| Tour Master | Travel planning, price comparison |
| Web Researcher | Real-time web search (ElevenLabs agent) |

Each agent has a unique voice, system prompt, and tool set invoked via webhooks during calls.

---

## Architecture

```
Voice Layer (ElevenLabs ConvAI widget) → Webhook Handler (tool routing)
  → Skill Execution (Firecrawl, Composio, Venice AI)
    → Settlement (x402 → 1Shot relayer → Arbitrum)
```

- **WidgetEngine** mounts `<elevenlabs-convai>` offscreen and controls it programmatically
- **ActiveCall** provides the switchboard-style UI during conversations
- **Webhook** routes tool calls per-agent and handles x402 payment negotiation
- **DelegationRegistry** (ERC-8004, Arbitrum Sepolia) manages agent permissions

---

## Contract

| Contract | Network | Address |
|---|---|---|
| DelegationRegistry (ERC-8004) | Arbitrum Sepolia | `0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00` |

Deploy with: `cd contracts-deploy && pnpm hardhat run scripts/deploy.ts --network arbitrumSepolia`

---

## Key Env Vars

```
ELEVENLABS_API_KEY          # Required — voice agent API
VENICE_API_KEY              # Venice AI inference key
UPSTASH_REDIS_REST_URL      # Data persistence
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
FACILITATOR_PRIVATE_KEY     # x402 settlement gas wallet
ARBITRUM_RPC_URL            # https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS  # Deployed contract address
```

---

Built with [Cursor](https://cursor.sh) + [ElevenLabs](https://elevenlabs.io) · MIT
