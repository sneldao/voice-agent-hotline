# Voice Agent Hotline - Documentation

## Quick Links

| Document | Purpose |
|----------|---------|
| [Architecture](./AGENTIC_ARCHITECTURE.md) | Intent-based, no-server-keys architecture |
| [Deployment](./DEPLOYMENT.md) | Vercel deployment guide |
| [API Reference](../lib/intent-architecture.ts) | Intent parsing and execution |

## Project Overview

**Voice Agent Hotline** - Talk to verified AI agents. Pay per second. Built for Celo.

- **Live Demo:** https://voisss-agent-hotline.vercel.app
- **Repository:** https://github.com/sneldao/voice-agent-hotline
- **Hackathon:** Celo AI Partner Catalyst

## Core Features

### 🎙️ Voice
- Real-time WebRTC voice calls
- ElevenLabs Conversational AI integration
- Sub-500ms latency
- Live transcripts

### 💰 Payments
- **x402 Protocol:** Gasless micropayments on Celo
- **Session Keys:** Limited-scope, auto-expiring authorizations
- **On-Chain Settlement:** Real transaction receipts
- **Smart Contract Wallets:** ERC-4337 account abstraction

### 🤖 Agents
- 4 built-in agents (Solana Sage, Code Reviewer, Tournament Master, General Helper)
- Agent SDK for external developers
- Credential verification (legal, medical, finance)
- Revenue sharing (90% agent, 10% platform)

### ⭐ Trust
- ERC-8004 agent registry
- Reputation staking with slashing
- Dispute resolution
- TEE-secured cloud agents

## Architecture Highlights

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────→│   Intent    │────→│   Cloud     │
│   Wallet    │     │   Parser    │     │   Agent     │
│  (ERC-4337) │←────│  (OpenClaw) │←────│   (TEE)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       └────────────────────────────────────────┘
                          │
                    ┌─────────────┐
                    │    Celo     │
                    │  Blockchain │
                    └─────────────┘
```

**Key Innovation:** No private keys on servers. Ever.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, Tailwind CSS, TypeScript |
| Voice | WebRTC, ElevenLabs Conversational AI |
| Payments | x402, ERC-4337, Celo cUSD/USDC |
| Blockchain | Celo Mainnet/Alfajores, viem, wagmi |
| Database | Upstash Redis |
| Cloud | Vercel, AWS Nitro Enclaves (TEE) |

## Project Structure

```
voice-agent-hotline/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── demo/              # Demo page
│   └── page.tsx           # Main app
├── components/            # React components
├── contracts/             # Solidity smart contracts
├── lib/                   # Core services
│   ├── useRealAgents.ts   # Real agent data hook
│   ├── useRealPayment.ts  # On-chain payment hook
│   ├── useRealVoiceCall.ts # WebRTC voice hook
│   ├── intent-architecture.ts # Intent system
│   └── payment-settlement.ts  # x402 settlement
├── docs/                  # Documentation
└── .kilocode/            # KILOCODE cloud agent config
```

## Environment Variables

### Required
```bash
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
THIRDWEB_SECRET_KEY=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### Optional (for real payments)
```bash
FACILITATOR_PRIVATE_KEY=...     # For on-chain settlement
ARBITRATOR_PRIVATE_KEY=...      # For dispute resolution
ARBITRATOR_API_KEY=...          # For dispute API
```

## Running Locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deployment

```bash
# Using Vercel CLI
vercel --prod

# Or use the deploy button in README.md
```

## Key Design Decisions

1. **Intent-Based UX** - Users say WHAT, not HOW
2. **Session Keys** - Limited scope, auto-expire
3. **Graceful Degradation** - Works with or without real APIs
4. **Open Source** - Full transparency
5. **No Server Keys** - User sovereignty first

## Documentation Index

- [Architecture](./AGENTIC_ARCHITECTURE.md) - Detailed technical architecture
- [Deployment](./DEPLOYMENT.md) - Step-by-step deployment guide
- [Smart Contracts](../contracts/) - Solidity source code
- [KILOCODE Config](../.kilocode/) - Cloud agent skills and profiles

## License

MIT
