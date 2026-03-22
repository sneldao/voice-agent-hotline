# Superfluid Streaming Payments

> **Status:** Partially integrated. The streaming infrastructure exists in `lib/superfluid-streaming.ts` and `lib/useSuperfluidStreaming.ts` but the primary payment model is now **Yellow Network state channels** for per-minute billing. Superfluid may be used for future subscription or continuous-stream use cases.

## What's Implemented

- `lib/superfluid-streaming.ts` — flow creation/deletion helpers using CFAv1Forwarder on Celo
- `lib/useSuperfluidStreaming.ts` — React hook wrapping the streaming helpers
- `components/StreamingPaymentModal.tsx` — UI for starting/stopping a Superfluid stream

## Architecture (when active)

```
User Wallet (signs tx)
   → CFAv1Forwarder (create/update/delete flow)
   → Super Token balance updates in real time

UI + Hook
   → reads flow state via public RPC
   → shows tx hash + explorer receipt
```

## Current Payment Model

Per-minute billing is handled via **Yellow Network state channels** — see `app/api/payments/wdk/route.ts` and `lib/wdk-wallet.ts`. This avoids on-chain tx fees for every minute of a call.

Superfluid remains available as an alternative for use cases requiring continuous streaming (e.g. long-running agent subscriptions).
