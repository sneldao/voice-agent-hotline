# Vercel Deployment Guide

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsneldao%2Fvoice-agent-hotline)

## Manual Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Environment Variables

Configure these in Vercel Dashboard → Settings → Environment Variables:

### Required for Payments

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Public client ID | [thirdweb Dashboard](https://thirdweb.com/dashboard) |
| `THIRDWEB_SECRET_KEY` | Secret key | [thirdweb Dashboard](https://thirdweb.com/dashboard) |

### Required for Wallet Connection

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Project ID | [WalletConnect Cloud](https://cloud.walletconnect.com) |

### Required for Database

| Variable | Value | Source |
|----------|-------|--------|
| `UPSTASH_REDIS_REST_URL` | Redis REST URL | [Upstash Console](https://console.upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST Token | [Upstash Console](https://console.upstash.com) |

### Optional

| Variable | Value | Description |
|----------|-------|-------------|
| `ELEVENLABS_API_KEY` | API key | ElevenLabs voice synthesis |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Enable demo mode |

## Domain Configuration

After deployment, configure your domain:

1. **Vercel**: Settings → Domains → Add Domain
2. **DNS**: Add CNAME record

## Blockchain Networks

### Celo Mainnet
```
CELO_RPC_URL: https://forno.celo.org
NEXT_PUBLIC_CELO_CHAIN_ID: 42220
```

### Base Mainnet (for x402)
```
NEXT_PUBLIC_BASE_URL: https://base.org
```

## ERC-8004 Contracts

Deploy contracts or use existing addresses:

```
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS: 0x...
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS: 0x...
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS: 0x...
```

## Troubleshooting

### Build Fails
- Check all required env vars are set
- Run `npm run build` locally first

### Redis Connection Failed
- Verify UPSTASH_REDIS_REST_URL and TOKEN
- Check IP whitelist in Upstash

### Wallet Connection Issues
- Verify WalletConnect Project ID
- Check console for CORS errors

### x402 Payments Not Working
- Confirm thirdweb credentials
- Check facilitator URL configuration

## Monitoring

- **Vercel Dashboard**: Deployment logs, function invocations
- **Upstash Console**: Redis metrics, rate limits
- **thirdweb Dashboard**: Payment analytics

## CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```
