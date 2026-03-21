# 🎙️ VOISSS - Voice Agent Hotline

**Talk to verified AI agents. Pay per second. Built for Celo AI Partner Hackathon.**

A mobile-first voice platform with x402 micropayments and Superfluid streaming payments.

## 🚀 Live Demo

**[https://voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)**

**[https://voice-agent-hotline.vercel.app](https://voice-agent-hotline.vercel.app)**

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Then open http://localhost:3000/demo

## Two Payment Modes

| Mode | How It Works | Best For |
|------|--------------|----------|
| **Direct x402** | Pay per call segment | Short conversations |
| **Superfluid Streaming** | Pay per second continuously | Long calls |

## Architecture

```
User (Mobile/Web)
    │
    ├─► WebRTC Voice Call
    │
    ├─► x402 Payment (Celo/Base)
    │   │
    │   ├─ Direct Payment
    │   └─ Superfluid Streaming
    │
    └─► ERC-8004 Delegation
        │
        ├─ Book appointments
        ├─ Place orders
        ├─ Schedule events
        └─ Research tasks
```

## Core Features

### 🎙️ Voice
- Real AI voice via ElevenLabs
- WebRTC peer connections
- Call recording and playback

### 💰 Payments
- **x402 Direct:** Pay per call segment
- **User-settled:** Users sign their own transactions
- Redis-backed session persistence
- Celo Sepolia testnet support

### 🤖 Agent Skills (via Composio)
- **Book:** OpenTable reservations
- **Order:** Uber rides, DoorDash delivery
- **Schedule:** Google Calendar events
- **Research:** Web search via Tavily

### ⭐ Trust
- ERC-8004 agent registry (deployed on Celo Sepolia)
- On-chain delegation with user-signed transactions
- Reputation system
- Verified identities

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | Next.js 14 + Tailwind CSS |
| Voice | ElevenLabs TTS + WebRTC |
| Wallet | WalletConnect (MetaMask, Rainbow, Coinbase) |
| Payments | x402 (user-settled) |
| Identity | ERC-8004 (Celo Sepolia) |
| Agent Tools | Composio (OpenTable, Uber, Google Calendar) |
| Database | Upstash Redis |
| Blockchain | Celo Sepolia (testnet) |

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/sneldao/voice-agent-hotline.git
cd voice-agent-hotline
npm install
```

### 2. Configure Environment

Copy and edit:

```bash
cp .env.local.example .env.local
```

Required variables:

```env
# Wallet Connection
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Database
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Voice
ELEVENLABS_API_KEY=...

# Agent Tools
COMPOSIO_API_KEY=...

# ERC-8004 (deployed on Celo Sepolia)
NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00
```

### 3. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000/demo

## Deployment

### Option 1: Vercel (Quick Deploy)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsneldao%2Fvoice-agent-hotline)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed Vercel setup.

**Best for:** Quick demos, hackathons, low-traffic apps

### Option 2: Hetzner VPS (Production)

Deploy to Hetzner VPS for **zero cold starts**, **unlimited timeouts**, and **full WebSocket support**.

**Quick Start:**
```bash
# Automated deployment
./scripts/deploy-hetzner.sh your-server-ip root

# Manual setup (SSH)
ssh root@your-server-ip
cd /opt/voice-hotline-celo
git pull origin main
npm install --production
npm run build
pm2 restart voice-hotline-celo
```

See [docs/HETZNER_DEPLOYMENT.md](docs/HETZNER_DEPLOYMENT.md) for complete guide.

**Best for:** Production, voice calls, high-traffic apps

### Comparison

| Feature | Vercel | Hetzner VPS |
|---------|--------|-------------|
| Setup Time | 5 minutes | 30 minutes |
| Cold Starts | 2-5 seconds | None |
| Timeout Limit | 10-300s | Unlimited |
| WebSocket | Limited | Full support |
| Cost | $20/month | ~€5/month |
| Control | Limited | Full root access |

---

## Contributing

Set `NEXT_PUBLIC_DEMO_MODE=true` to test without real wallet:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

## API Reference

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/agents` | List all agents |
| `GET /api/users/[address]` | Get user profile |
| `POST /api/calls` | Start voice call |
| `POST /api/payments` | Process payment |
| `GET /api/voice/stream` | WebSocket voice stream |

### WebSocket

Connect to `/api/voice/stream` for real-time voice:

```typescript
const ws = new WebSocket('ws://localhost:3000/api/voice/stream');
ws.onmessage = (e) => {
  console.log('Received audio:', e.data);
};
```

## Integrations

### x402 Payments

```typescript
import { VoicePaymentService } from '@/lib/payments/x402';
import { paymentSettlement } from '@/lib/payment-settlement';

const payment = new VoicePaymentService();
// End-to-end billing: meter → settle → on-chain tx
await payment.endCall({ callId, amount, authorization });
```

### Superfluid Streaming

```typescript
import { SuperfluidStreamingService } from '@/lib/superfluid-streaming';

const stream = new SuperfluidStreamingService();
// Auto-detects create vs update flow
await stream.startStream({ recipient, monthlyAmount });
await stream.stopStream(recipient);
```

### ElevenLabs TTS

```typescript
import { ElevenLabsService } from '@/lib/elevenlabs';

const tts = new ElevenLabsService(apiKey, defaultVoiceId);
const { audio } = await tts.textToSpeech({ text, voiceId });
```

### ERC-8004 Delegation (Celo Sepolia)

Deployed contracts:
- **IdentityRegistry:** `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **ReputationRegistry:** `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- **DelegationRegistry:** `0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00`

Users sign their own delegation transactions (user-pays-gas model):

```typescript
// Create delegation - returns unsigned tx for user to sign
const response = await fetch('/api/delegations', {
  method: 'POST',
  body: JSON.stringify({ userAddress, scope }),
});
const { txData } = await response.json();

// User signs and submits via their wallet
await wallet.sendTransaction(txData);
```

## Project Structure

```
voice-agent-hotline/
├── app/                        # Next.js app router
│   ├── api/                   # API routes
│   │   ├── agents/            # Agent management
│   │   ├── calls/             # Call handling
│   │   ├── payments/          # Payment settlement
│   │   ├── ratings/           # Agent ratings
│   │   ├── reputation/        # ERC-8004 reputation
│   │   ├── sdk/               # Agent SDK endpoints
│   │   └── webhooks/          # ElevenLabs webhooks
│   ├── demo/                  # Demo page
│   └── profile/               # User profile
├── components/                # React components
│   ├── ui/                    # Reusable UI components
│   ├── ActiveCall.tsx         # Active call UI
│   ├── SmartAgentFinder.tsx   # AI-powered agent matching
│   └── CallSummary.tsx        # Post-call summary
├── contracts/                 # Solidity smart contracts
│   └── AgentSmartWallet.sol   # ERC-4337 wallet
├── lib/                       # Core services
│   ├── payments/              # Payment services
│   │   ├── x402.ts            # x402 protocol
│   │   └── settlement.ts      # Payment settlement
│   ├── voice/                 # Voice services
│   │   ├── webrtc-voice.ts    # WebRTC implementation
│   │   └── elevenlabs.ts      # ElevenLabs integration
│   ├── agentMatching.ts       # AI agent matching engine
│   ├── db.ts                  # Redis operations
│   ├── erc8004.ts             # Delegation & reputation
│   ├── superfluid-streaming.ts # Streaming payments (viem)
│   ├── payment-settlement.ts  # EIP-3009 settlement
│   ├── intent-architecture.ts # Intent parsing
│   └── useCallHistory.ts      # Call history hook
├── docs/                      # Documentation
│   ├── README.md              # Documentation index
│   ├── AGENTIC_ARCHITECTURE.md # Architecture overview
│   ├── DEPLOYMENT.md          # Vercel deployment
│   ├── HETZNER_DEPLOYMENT.md  # Hetzner VPS deployment
│   ├── PERFORMANCE.md         # Performance optimizations
│   └── SUPERFLUID_INTEGRATION.md # Superfluid docs
├── scripts/                   # Deployment & utility scripts
│   └── deploy-hetzner.sh      # Automated Hetzner deployment
└── .kilocode/                # KILOCODE cloud agent config
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Run tests
4. Submit PR

## License

MIT

---

Built with ❤️ for the Celo AI Partner Catalyst Hackathon
