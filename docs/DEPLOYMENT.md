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

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | [thirdweb](https://thirdweb.com/dashboard) | Wallet connection |
| `THIRDWEB_SECRET_KEY` | [thirdweb](https://thirdweb.com/dashboard) | x402 payments |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [WalletConnect](https://cloud.walletconnect.com) | WalletConnect |
| `UPSTASH_REDIS_REST_URL` | [Upstash](https://console.upstash.com) | Database |
| `UPSTASH_REDIS_REST_TOKEN` | [Upstash](https://console.upstash.com) | Database auth |

### Optional (for production features)

| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | Real voice synthesis |
| `COMPOSIO_API_KEY` | Agent tools (GitHub, Solana, etc.) |
| `FACILITATOR_PRIVATE_KEY` | On-chain payment settlement |
| `ARBITRATOR_PRIVATE_KEY` | Dispute resolution |

### Feature Flags

```bash
NEXT_PUBLIC_DEMO_MODE=false          # Set true for demo without wallet
NEXT_PUBLIC_PAYMENTS_ENABLED=true    # Enable real payments
NEXT_PUBLIC_X402_ENABLED=true        # Enable x402 protocol
```

## Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] Redis database connected
- [ ] Wallet connection working
- [ ] Agents loading from API
- [ ] Test call flow (demo mode first)
- [ ] Enable real payments (optional)

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### API Errors
- Check Redis connection
- Verify environment variables
- Check Vercel function logs

### Payment Issues
- Ensure `FACILITATOR_PRIVATE_KEY` has CELO for gas
- Verify contract addresses on Celo
- Check CeloScan for transaction status

## Architecture

```
User → Vercel Edge → Next.js API → Redis/Blockchain
```

- **Frontend:** Static on Vercel CDN
- **API:** Serverless functions
- **Database:** Upstash Redis (global)
- **Blockchain:** Celo (via forno.celo.org)
