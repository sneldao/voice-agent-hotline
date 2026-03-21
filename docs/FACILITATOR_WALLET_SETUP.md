# Facilitator Wallet Setup (Legacy)

> **This guide is no longer required.** Payments are now user-settled — the user's own wallet submits transactions directly on-chain. No facilitator private key is needed on the server.

## What changed

| Before | After |
|--------|-------|
| Server held `FACILITATOR_PRIVATE_KEY` | Zero private keys on server |
| Facilitator submitted `transferWithAuthorization` | User submits directly via MetaMask |
| Single point of compromise | No platform trust required |

## If you still want a facilitator (optional)

The WDK integration (`lib/wdk-x402.ts`) supports an optional facilitator for gasless settlement on Plasma/Stable. In that case:

```bash
# .env.local
WDK_FACILITATOR_SEED_PHRASE=your_bip39_seed_phrase
```

This is only needed if you want the platform to pay gas on behalf of users. For maximum decentralization, leave it empty — users settle their own payments.

## Yellow Network alternative

For instant, gasless micropayments without any facilitator, see [lib/yellow-channel.ts](../lib/yellow-channel.ts). Yellow uses state channels — payments happen off-chain with on-chain settlement only when the channel closes.
