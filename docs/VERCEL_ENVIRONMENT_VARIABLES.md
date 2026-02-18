# Vercel Environment Variables Setup

## Deployment URL
**https://voisss-agent-hotline.vercel.app**

---

## Required Environment Variables

Set these in: **Vercel Dashboard → Project → Settings → Environment Variables**

### Core Configuration
```
NODE_ENV=production
NEXT_PUBLIC_CELO_CHAIN_ID=42220
CELO_RPC_URL=https://forno.celo.org
```

### Thirdweb (Wallet & Payments)
```
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=b9a142d988a6e40baa7342b423bf2361
THIRDWEB_SECRET_KEY=RuhKxNuU2eQ8kh4KO3iC4P-QwTb-U0yn0SNweSXa6CBAiwAlvZCEFYlgAEmpxub0mARt8xWat-RF9HgUOF2b-A
```

### WalletConnect
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=6c8d6825d97953bca440a03b6b4430f9
```

### Upstash Redis (Database)
```
UPSTASH_REDIS_REST_URL=https://notable-muskrat-59188.upstash.io
UPSTASH_REDIS_REST_TOKEN=Aec0AAIncDIxNTUwMTMzMzYwZTM0MGFiOGU1MzUzZDA3OGFkZmQ0ZHAyNTkxODg
UPSTASH_REDIS_URL=https://notable-muskrat-59188.upstash.io
UPSTASH_REDIS_TOKEN=Aec0AAIncDIxNTUwMTMzMzYwZTM0MGFiOGU1MzUzZDA3OGFkZmQ0ZHAyNTkxODg
```

### ElevenLabs (Voice)
```
ELEVENLABS_API_KEY=sk_ae5b570294f4314b0315aaeb3a83465596960ce18ed54d01
ELEVENLABS_DEFAULT_VOICE=Adam
ELEVENLABS_CONVERSATIONAL_ENABLED=true
```

### Payment Settlement (Facilitator Wallet)
```
# Facilitator Wallet (Hot Wallet - Limited Funds)
# Address: 0x54351049081A5A64Ea93c56b666830ED5076b960
# Keep only 0.1-0.5 CELO for gas fees
FACILITATOR_PRIVATE_KEY=0xe455fc7081ec167e58c62a259163916beac4e765d8ee68579f45be8f32c9755b

# Payment Receiver (Cold Wallet - Main Revenue)
PAYMENT_RECEIVER=0x55A5705453Ee82c742274154136Fce8149597058

# Platform & Agent Wallet (using facilitator for now)
NEXT_PUBLIC_PLATFORM_ADDRESS=0x54351049081A5A64Ea93c56b666830ED5076b960
AGENT_WALLET=0x54351049081A5A64Ea93c56b666830ED5076b960
NEXT_PUBLIC_FACILITATOR_ADDRESS=0x54351049081A5A64Ea93c56b666830ED5076b960
```

### Composio (Agent Tools)
```
COMPOSIO_API_KEY=ak_Bnu0tia8zt7Lyy7mkjaL
```

### Webhook URL
```
NEXT_PUBLIC_WEBHOOK_URL=https://voisss-agent-hotline.vercel.app
```

### x402 Payment Protocol
```
# Using custom EIP-3009 settlement (no external facilitator needed)
X402_FACILITATOR_URL=https://voisss.celo.famile.xyz
NEXT_PUBLIC_X402_ENABLED=true
```

### Feature Flags
```
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_PAYMENTS_ENABLED=true
NEXT_PUBLIC_RECORDING_ENABLED=false
NEXT_PUBLIC_PAYMENT_SETTLEMENT_ENABLED=true
```

### ERC-8004 (Disabled for now)
```
NEXT_PUBLIC_ERC8004_ENABLED=false
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0x0000000000000000000000000000000000000000
```

### Optional Services
```
FIRECRAWL_API_KEY=0832d9ae6d2f4513b7fa59e8d78ef097
TAVILY_API_KEY=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
VOISSS_URL=https://voisss.netlify.app
```

---

## Mark as Encrypted (Sensitive Values)

In Vercel, mark these as **Encrypted**:
- `THIRDWEB_SECRET_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `UPSTASH_REDIS_TOKEN`
- `ELEVENLABS_API_KEY`
- `FACILITATOR_PRIVATE_KEY`
- `COMPOSIO_API_KEY`
- `FIRECRAWL_API_KEY`
- `TAVILY_API_KEY`

---

## Architecture Notes

### x402 Facilitator
The current implementation uses a **custom EIP-3009 settlement** pattern:
- User signs `transferWithAuthorization` off-chain
- Facilitator wallet submits the transaction on-chain
- No external facilitator service needed

The `X402_FACILITATOR_URL` points to your Hetzner backend which handles settlement.

### Payment Flow
1. User connects wallet on Vercel frontend
2. User signs payment authorization
3. Authorization sent to Hetzner backend
4. Facilitator wallet submits transaction
5. Payment goes to `PAYMENT_RECEIVER` (your cold wallet)

---

## Post-Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Sensitive values marked as Encrypted
- [ ] Deploy to Production environment
- [ ] Test wallet connection
- [ ] Test agent listing
- [ ] Test payment flow (with small amount)
- [ ] Verify payments go to `PAYMENT_RECEIVER`

---

## Troubleshooting

### "Facilitator not configured"
- Check `FACILITATOR_PRIVATE_KEY` is set
- Verify key format: `0x` + 64 hex characters
- Ensure facilitator wallet has CELO for gas

### "Redis connection failed"
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Upstash dashboard for connection limits

### "Payment settlement failed"
- Check facilitator wallet balance: https://celoscan.io/address/0x54351049081A5A64Ea93c56b666830ED5076b960
- Verify `PAYMENT_RECEIVER` is set correctly
- Check Vercel function logs
