# Security Architecture: User-Settled Payments

## Current Architecture (No Server-Side Keys)

```
User Signs EIP-712 Typed Data → User's Wallet Submits On-Chain → Blockchain
                                       ↑
                              MetaMask / WalletConnect
                              (user controls keys)
```

**Security properties:**
- Zero private keys on the server
- User has full control over transaction timing
- Platform cannot delay, freeze, or redirect funds
- No single point of compromise

## Payment Modes

### 1. User-Settled (Active — Default)

The user signs an EIP-712 `transferWithAuthorization` and submits it directly from their wallet. The server only tracks settlement for analytics.

- **Code:** `lib/useRealPayment.ts`
- **Trust:** None — fully non-custodial
- **Gas:** User pays (small amount for token transfer)
- **UX:** One MetaMask pop-up per settlement

### 2. Yellow State Channels (Ready to Wire)

Payments happen off-chain in a state channel. Gasless, instant, per-second. On-chain settlement only when channel closes.

- **Code:** `lib/yellow-channel.ts`
- **SDK:** `@erc7824/nitrolite`
- **Trust:** Clearnode validates (decentralized)
- **Gas:** Only on channel open/close
- **UX:** One deposit, then seamless payments

### 3. WDK x402 (Optional)

Tether's WDK with optional facilitator for gasless EIP-3009 settlement. Supports Celo, Plasma, Stable.

- **Code:** `lib/wdk-wallet.ts`, `lib/wdk-x402.ts`
- **Trust:** Facilitator pays gas (if configured)
- **Gas:** Facilitator pays (optional)
- **UX:** Gasless if facilitator is used

## Environment Variables

### Required (no private keys!)

```bash
# Core
NEXT_PUBLIC_CELO_CHAIN_ID=42220
CELO_RPC_URL=https://forno.celo.org

# Database
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Voice
ELEVENLABS_API_KEY=...
```

### Optional

```bash
# Yellow Network (for state channel payments)
NEXT_PUBLIC_YELLOW_SANDBOX_WS_URL=wss://clearnet-sandbox.yellow.com/ws

# WDK (for multi-chain USD₮ payments)
WDK_ENABLED=true
WDK_SEED_PHRASE=...  # Only if using WDK facilitator mode

# Legacy — NOT required for user-settled payments
# FACILITATOR_PRIVATE_KEY=...  ← Can be removed entirely
```

## Migration Checklist

- [x] Remove `FACILITATOR_PRIVATE_KEY` from server environment
- [x] User-settled payments implemented (`lib/useRealPayment.ts`)
- [x] Settlement API simplified to tracking-only
- [x] Yellow Network SDK integrated (`lib/yellow-channel.ts`)
- [x] WDK integration supports optional facilitator
- [ ] Deploy ERC-8004 contracts for on-chain delegation
- [ ] Remove facilitator key from git history
