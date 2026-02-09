# 🎙️ Voice Agent Hotline

**Talk to verified AI agents. Pay per minute. First minute free.**

A mobile-first voice platform with x402 micropayments on Celo.

## Quick Start

```bash
npm install
npm run dev
```

## What Makes This Different

| Feature | Traditional | Hotline |
|----------|-------------|---------|
| **Pricing** | Subscription | Pay-per-minute |
| **Voice** | Text only | Real voice |
| **Trust** | None | ERC-8004 verified |
| **Payment** | Credit card | Crypto micropayments |

## Architecture

```
User (Mobile)
    │
    ▼
Next.js Frontend
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
Real AI voice via ElevenLabs/VOISSS.

### ⭐ Trust
ERC-8004 agent reputation system.

## Stack

- Next.js 14
- Tailwind CSS
- WebSocket
- x402 (Celo)
- ERC-8004
- ElevenLabs

## License

MIT
