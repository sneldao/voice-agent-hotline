# Superfluid Streaming Payments

## Overview

Superfluid streaming is implemented as a real wallet-signed flow on Celo.
Users start and stop streams directly from their connected wallet while on-chain flow state is read from public RPC.

## Architecture

```text
User Wallet (signs tx)
   -> CFAv1Forwarder (create/update/delete flow)
   -> Super Token balance updates in real time

UI + Hook
   -> reads flow state via public RPC
   -> shows tx hash + explorer receipt
```

Key properties:

1. No server-side facilitator key is required for streaming operations.
2. Stream start auto-detects existing flow and uses `updateFlow` when needed.
3. Stream stop calls `deleteFlow` and returns an on-chain transaction hash.

## Source of Truth

1. Streaming config and ABI: `lib/superfluid-streaming.ts`
2. Wallet-signed client hook: `lib/useSuperfluidStreaming.ts`
3. Preflight checks before call connect: `lib/streaming-preflight.ts`
4. In-call lifecycle integration: `components/ActiveCall.tsx`

## Hook Usage

```typescript
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';

const {
  status,
  txHash,
  flowRate,
  error,
  startStream,
  stopStream,
} = useSuperfluidStreaming();

const monthlyUsd = 4.32; // e.g. $0.10/min * 60 * 24 * 30

// Start (create or update)
const startTx = await startStream(agentPayoutAddress, monthlyUsd);

// Stop
const stopTx = await stopStream(agentPayoutAddress);
```

## Environment Variables

```bash
# Optional: override token + label
NEXT_PUBLIC_SUPERFLUID_TOKEN=0x...
NEXT_PUBLIC_SUPERFLUID_TOKEN_SYMBOL=cUSDCx

# Optional: fallback payout address when an agent record has no wallet
NEXT_PUBLIC_PLATFORM_ADDRESS=0x...

# Optional RPC override
CELO_RPC_URL=https://forno.celo.org
```

## Readiness and Preflight

Before launching a streaming call, preflight checks verify:

1. Selected agent has a payout address.
2. Wallet is connected to the required Celo chain.
3. Super token contract exists on the active chain.
4. Wallet has enough super token balance for the initial reserve window.

Current preflight implementation: `lib/streaming-preflight.ts`.

## Error Handling

Common user-visible failure classes:

1. Wrong chain: prompt wallet network switch.
2. Missing payout address: block launch and show configuration issue.
3. Missing super token on chain: treat streaming as unavailable.
4. Insufficient balance: show top-up flow using reserve amount guidance.

## Notes

1. Streaming and x402 are both supported; choose at call launch.
2. Receipts use transaction hashes and explorer links from shared helper logic.

## Resources

1. [Superfluid Docs](https://docs.superfluid.finance/)
2. [Celo Network Support](https://docs.superfluid.finance/superfluid/networks/celo)
3. [Protocol Monorepo / CFAv1Forwarder](https://github.com/superfluid-finance/protocol-monorepo)
4. [viem](https://viem.sh/)
