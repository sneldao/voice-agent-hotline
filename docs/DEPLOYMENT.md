# Deployment Guide

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsneldao%2Fvoice-agent-hotline)

## Manual Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod
```

## Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables.

See `.env.local.example` for the full template with placeholder values.

### Core

```bash
NODE_ENV=production
NEXT_PUBLIC_CELO_CHAIN_ID=42220
CELO_RPC_URL=https://forno.celo.org
```

### Required

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | [thirdweb](https://thirdweb.com/dashboard) | Wallet connection |
| `THIRDWEB_SECRET_KEY` | [thirdweb](https://thirdweb.com/dashboard) | x402 payments |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [WalletConnect](https://cloud.walletconnect.com) | WalletConnect |
| `UPSTASH_REDIS_REST_URL` | [Upstash](https://console.upstash.com) | Database |
| `UPSTASH_REDIS_REST_TOKEN` | [Upstash](https://console.upstash.com) | Database auth |

### Voice & Agents

| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | Real voice synthesis |
| `ELEVENLABS_AGENT_*` | ConvAI agent IDs (set after running seed script) |
| `COMPOSIO_API_KEY` | Agent tools (GitHub, Solana, etc.) |
| `TAVILY_API_KEY` | Web research for agents |

### Payments

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | Enable real payments |
| `PAYMENT_RECEIVER` | Address that receives agent payments |

**User-pays-gas model:** Users sign their own transactions. No facilitator private key needed on the server. See [SECURITY_ARCHITECTURE_COMPARISON.md](./SECURITY_ARCHITECTURE_COMPARISON.md).

### WDK (Tether Wallet Development Kit)

For multi-chain USD₮ payments via Tether WDK:

| Variable | Purpose |
|----------|---------|
| `WDK_ENABLED` | Enable WDK integration |
| `WDK_SEED_PHRASE` | BIP-39 seed phrase for WDK wallets |
| `WDK_ACTIVE_CHAIN` | Active chain: `celo`, `plasma`, or `stable` |

### Yellow Network (State Channels)

For instant, gasless micropayments via state channels:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_YELLOW_WS_URL` | Production clearnode WebSocket |
| `NEXT_PUBLIC_YELLOW_SANDBOX_WS_URL` | Sandbox clearnode (dev/testing) |

### ERC-8004 (Agent Identity & Reputation)

Contracts are deployed on Celo Sepolia (chain ID: 11142220):

```bash
NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00
```

For production (Celo mainnet), deploy DelegationRegistry using `contracts-deploy/`.

### Feature Flags

```bash
NEXT_PUBLIC_DEMO_MODE=false          # Set true for demo without wallet
NEXT_PUBLIC_PAYMENTS_ENABLED=true    # Enable real payments
NEXT_PUBLIC_RECORDING_ENABLED=false  # Enable call recording
```

### Security

- **Never commit secrets** — `.env.local` is gitignored
- **Mark as Encrypted** in Vercel — all keys except `NEXT_PUBLIC_*`
- **Pre-commit hook** — scans for secret patterns, auto-configured via `npm install`
- **Rotate keys regularly** — especially after any suspected exposure

## Post-Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] Sensitive values marked as Encrypted
- [ ] Redis database connected
- [ ] Wallet connection working
- [ ] Agents loading from API
- [ ] ElevenLabs agents seeded (`npx tsx scripts/seed-elevenlabs.ts`)
- [ ] Test call flow (demo mode first)
- [ ] Enable real payments
- [ ] Test payment flow with small amount
- [ ] Verify payments go to `PAYMENT_RECEIVER`

## Troubleshooting

### Build Errors
```bash
rm -rf .next node_modules
npm install
npm run build
```

### API Errors
- Check Redis connection via Upstash dashboard
- Verify all environment variables are set
- Check Vercel function logs

### Payment Issues
- Ensure user has cUSD/USDC balance for settlement
- Verify user is on Celo chain (chain ID 42220)
- Check [CeloScan](https://celoscan.io) for transaction status

### ElevenLabs Issues
- Verify `ELEVENLABS_API_KEY` has voice and ConvAI permissions
- Check character quota on ElevenLabs dashboard
- Re-run seed script if agents/tools are missing

## Architecture

```
User (MetaMask/Rainbow/Coinbase) → Vercel Edge → Next.js API → Redis / Celo Sepolia
                      ↕                       ↕
              WalletConnect SDK        Composio (Agent Tools)
                      ↕                       ↕
              ElevenLabs ConvAI (voice)   OpenTable, Uber, Google Calendar
```

- **Frontend:** Static on Vercel CDN
- **API:** Serverless functions (Redis-backed)
- **Database:** Upstash Redis (rate limiting, sessions, agents)
- **Blockchain:** Celo Sepolia (chain ID: 11142220)
- **Voice:** ElevenLabs ConvAI
- **Payments:** User-settled (users sign their own txs)
- **Identity:** ERC-8004 (on-chain delegation)
