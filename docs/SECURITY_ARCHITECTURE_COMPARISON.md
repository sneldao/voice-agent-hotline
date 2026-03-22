# Security Architecture

## Payment Security Model

All payments are **user-settled** — the server holds no private keys for payment transactions.

```
User Signs EIP-712 Typed Data → User's Wallet Submits On-Chain → Celo Blockchain
                                       ↑
                              MetaMask / WalletConnect
                              (user controls keys)
```

**Properties:**
- Zero payment private keys on the server
- User has full control over transaction timing and approval
- Platform cannot delay, freeze, or redirect funds
- No single point of compromise for user funds

## Server-Side Keys

The server does hold one key:

| Key | Purpose | Risk |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | Signs ERC-8004 identity minting transactions | Loss = inability to mint new agent identities; no user funds at risk |

## API Security

- **OpenClaw webhook:** protected by `OPENCLAW_WEBHOOK_SECRET` header (`x-openclaw-secret`)
- **Admin endpoints** (`PATCH /api/agents/:id`, `DELETE /api/agents/:id`): currently rely on network-level access control — add auth middleware before exposing publicly
- **Seed endpoint** (`POST /api/agents/seed`): should be restricted to internal/admin use in production

## Wallet Connection

Web3Modal + WalletConnect. The app never receives or stores private keys. All signing happens in the user's wallet extension or mobile app.

## Environment Variables

Sensitive values (`ELEVENLABS_API_KEY`, `FACILITATOR_PRIVATE_KEY`, `UPSTASH_REDIS_REST_TOKEN`) are:
- Stored in `.env.local` on the VPS (not committed to git)
- Injected into the PM2 process via `ecosystem.config.js` (also not committed)
- Set as encrypted secrets in Vercel dashboard

The `.gitignore` excludes `.env.local` and `ecosystem.config.js` to prevent accidental exposure.
