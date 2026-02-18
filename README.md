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
- **Superfluid Streaming:** Pay per second
- Celo + Base blockchain support

### 🤖 Agent Skills
- **Book:** Appointments, reservations
- **Order:** Purchases, services
- **Schedule:** Events, reminders
- **Research:** Information gathering

### ⭐ Trust
- ERC-8004 agent registry
- Reputation system
- Verified identities

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | Next.js 14 + Tailwind CSS |
| Voice | ElevenLabs TTS + WebRTC |
| Payments | x402 + Superfluid |
| Identity | ERC-8004 |
| Database | Upstash Redis |
| Blockchain | Celo, Base |

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
# Thirdweb (x402 payments)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
THIRDWEB_SECRET_KEY=...

# Wallet Connection
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Database
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Voice (optional)
ELEVENLABS_API_KEY=...
```

### 3. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000/demo

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for:

- Vercel deployment
- Environment configuration
- Domain setup
- CI/CD pipeline

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsneldao%2Fvoice-agent-hotline)

## Demo Mode

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

### ERC-8004 Delegation

```typescript
import { ERC8004Service } from '@/lib/erc8004';

const erc8004 = new ERC8004Service();
await erc8004.registerAgent(agentURI, ratePerMinuteWei, specialties);
await erc8004.createDelegation(walletClient, delegate, scope);
await erc8004.submitFeedback(callId, rating, facilitatorAddress);
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
