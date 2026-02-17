# Superfluid Streaming Payments

## Overview

Superfluid enables real-time streaming payments - pay agents by the second instead of per-transaction.

## How It Works

```
User → Start Stream → $0.10/min → Agent
         ↓
    Real-time flow
         ↓
    Stop Stream → Final settlement
```

## Usage

```typescript
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';

const { startStream, stopStream, isStreaming, flowRate } = useSuperfluidStreaming();

// Start paying $0.10/min
await startStream({
  recipient: agentAddress,
  monthlyAmount: 4.32, // $0.10/min * 60 * 24 * 30
});

// Stop after call
await stopStream();
```

## vs Direct x402

| Feature | x402 Direct | Superfluid Streaming |
|---------|-------------|---------------------|
| Best for | Short calls (< 5 min) | Long calls (> 5 min) |
| Gas cost | Per transaction | One-time setup |
| Settlement | Immediate | Real-time stream |
| Complexity | Simple | Requires setup |

## Configuration

```bash
# Celo Superfluid contracts
SUPERFLUID_HOST=0xA4Ff07cF81C02CFD356184759D92b88E2A1b7c0
SUPERFLIDA_CUSD=0x7d69E1f1F0d05A0E76e1aD390cbB6522D194793
```

## Implementation

See `lib/superfluid-streaming.ts` for full implementation.

## Resources

- [Superfluid Docs](https://docs.superfluid.finance/)
- [Celo Integration](https://docs.superfluid.finance/superfluid/networks/celo)
