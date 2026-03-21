# Vercel Environment Variables Setup

## Deployment URL
**https://voisss-agent-hotline.vercel.app**

---

## Required Environment Variables

Set these in: **Vercel Dashboard → Project → Settings → Environment Variables**

See `.env.local.example` for the full template with placeholder values.

### Core Configuration
```
NODE_ENV=production
NEXT_PUBLIC_CELO_CHAIN_ID=42220
CELO_RPC_URL=https://forno.celo.org
```

### Thirdweb (Wallet & Payments)
```
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<your_thirdweb_client_id>
THIRDWEB_SECRET_KEY=<your_thirdweb_secret_key>
```

### WalletConnect
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>
```

### Upstash Redis (Database)
```
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your_upstash_token>
```

### ElevenLabs (Voice)
```
ELEVENLABS_API_KEY=<your_elevenlabs_api_key>
ELEVENLABS_DEFAULT_VOICE=Adam
ELEVENLABS_CONVERSATIONAL_ENABLED=true
```

### Payment Settlement (Facilitator Wallet)
```
FACILITATOR_PRIVATE_KEY=<your_facilitator_private_key>
PAYMENT_RECEIVER=<your_payment_receiver_address>
```

### Composio (Agent Tools)
```
COMPOSIO_API_KEY=<your_composio_api_key>
```

### Webhook URL
```
NEXT_PUBLIC_WEBHOOK_URL=https://voisss-agent-hotline.vercel.app
```

### WDK (Tether Wallet Development Kit)
```
WDK_ENABLED=true
WDK_SEED_PHRASE=<your_bip39_seed_phrase>
WDK_ACTIVE_CHAIN=celo
```

### Feature Flags
```
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_PAYMENTS_ENABLED=true
NEXT_PUBLIC_RECORDING_ENABLED=false
```

### ERC-8004
```
NEXT_PUBLIC_ERC8004_ENABLED=false
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0x0000000000000000000000000000000000000000
```

### Optional Services
```
FIRECRAWL_API_KEY=<your_firecrawl_api_key>
TAVILY_API_KEY=<your_tavily_api_key>
```

---

## Security

**Never commit real secrets to the repository.** Use `.env.local` for local development (already in `.gitignore`).

The pre-commit hook in `.githooks/pre-commit` scans for common secret patterns. Install it with:
```bash
npm install  # runs `prepare` script automatically
```

### Mark as Encrypted in Vercel
All keys except `NEXT_PUBLIC_*` values should be marked as **Encrypted** in the Vercel dashboard.

---

## Architecture Notes

### x402 Facilitator
The implementation uses EIP-3009 `transferWithAuthorization`:
- User signs authorization off-chain
- Facilitator wallet submits the transaction on-chain
- Settlement is also available via Tether WDK for USD₮ payments

### Payment Flow
1. User connects wallet on frontend
2. User signs payment authorization (EIP-3009)
3. Authorization verified server-side
4. Facilitator wallet submits transaction on-chain
5. Payment goes to `PAYMENT_RECEIVER`

---

## Post-Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Sensitive values marked as Encrypted
- [ ] Deploy to Production environment
- [ ] Test wallet connection
- [ ] Test agent listing
- [ ] Test payment flow (with small amount)
- [ ] Verify payments go to `PAYMENT_RECEIVER`
