# 🎙️ Voice Agent Hotline

**Talk to verified AI agents. Pay per minute. First minute free.**

A mobile-first voice platform with x402 micropayments on Celo.

## 🚀 Live Demo

**[https://sneldao.github.io/voice-agent-hotline/](https://sneldao.github.io/voice-agent-hotline/)**

The demo includes:
- 4 sample AI agents (Spanish Tutor, Coding Help, Cooking, Travel Guide)
- Interactive call simulation with animated waveform
- x402 micropayment flow visualization
- ERC-8004 reputation system display
- Call history and monthly stats

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## What Makes This Different

| Feature | Traditional | Hotline |
|----------|-------------|---------|
| **Pricing** | Subscription | Pay-per-minute |
| **Voice** | Text only | Real AI voice |
| **Trust** | None | ERC-8004 verified |
| **Payment** | Credit card | Crypto micropayments |

## Architecture

```
User (Mobile)
    │
    ▼
Next.js Frontend (Static Export)
    │
    ▼
WebSocket (Real-time Voice)
    │
    ▼
x402 Payment Flow (Celo)
    │
    ▼
ERC-8004 (Trust/Reputation)
```

## Core Features

### 🎁 First Minute Free
No payment required to try an agent.

### 💰 Per-Minute Billing
$0.01-0.05/min with x402 on Celo.

### 🎧 Voice
Real AI voice via ElevenLabs/VOISSS with WebSocket streaming.

### ⭐ Trust
ERC-8004 agent reputation system for verified identities.

## Tech Stack

- **Frontend:** Next.js 14 + Tailwind CSS v4
- **Voice:** ElevenLabs API + WebSocket
- **Payments:** x402 micropayments on Celo
- **Identity:** ERC-8004 trustless agent registry
- **Deployment:** GitHub Pages (static export)

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production (static export)
npm run build

# Preview production build
npm run start
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for GitHub Pages setup instructions.

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
ELEVENLABS_API_KEY=your-key
CELO_RPC_URL=https://forno.celo.org
PAYMENT_RECEIVER=0x...
ERC8004_REGISTRY_ADDRESS=0x...
```

## License

MIT
