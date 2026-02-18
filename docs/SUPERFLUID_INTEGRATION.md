# Superfluid Streaming Payments

## Overview

Superfluid enables real-time streaming payments - pay agents by the second instead of per-transaction.

**Latest Update:** Now using real on-chain CFAv1Forwarder contract calls via viem with auto-detection of create vs update flows.

## How It Works

```
User → Start Stream → $0.10/min → Agent
         ↓
    Real-time flow (on-chain)
         ↓
    Stop Stream → Final settlement
```

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   User UI   │────→│ Superfluid      │────→│ CFAv1        │
│             │     │ Streaming       │     │ Forwarder    │
│             │     │ Service (viem)  │     │ (On-chain)   │
└─────────────┘     └─────────────────┘     └──────────────┘
                           │
                    ┌──────────────┐
                    │ Server API   │
                    │ (private key)│
                    └──────────────┘
```

**Key Design:** Private keys never reach the client. Write operations route through server API endpoints.

## Usage

### Client-Side (React Hook)

```typescript
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';

const {
  startStream,
  stopStream,
  checkStream,
  getNetFlowRate,
  isStreaming,
  flowRate,
} = useSuperfluidStreaming();

// Start paying $0.10/min
await startStream({
  recipient: agentAddress,
  monthlyAmount: 4.32, // $0.10/min * 60 * 24 * 30
});

// Check if streaming
const isActive = await checkStream(agentAddress);

// Stop after call
await stopStream(agentAddress);
```

### Server-Side (Service)

```typescript
import { SuperfluidStreamingService } from '@/lib/superfluid-streaming';

const service = new SuperfluidStreamingService();

// Auto-detects create vs update flow
await service.startStream({
  sender: userAddress,
  receiver: agentAddress,
  token: cUSDAddress,
  flowRate: monthlyAmount,
});

// Get flow info
const flowInfo = await service.getFlowInfo({
  sender: userAddress,
  receiver: agentAddress,
  token: cUSDAddress,
});

// Calculate per-second cost
const perSecond = calculatePerSecondCost(monthlyAmount);
```

## Implementation Details

### Service Features

1. **Auto-Detection** - Checks for existing flow before create/update
2. **Real On-Chain Calls** - Uses viem to call CFAv1Forwarder directly
3. **Chain Support** - Celo Mainnet (42220) and Alfajores Testnet (44787)
4. **Error Handling** - Graceful fallbacks for insufficient balance, etc.

### Contract Addresses

```typescript
// Celo Mainnet
const CELO_MAINNET = {
  host: '0xA4Ff07cF81C02CFD356184759D92b88E2A1b7c0',
  cfAv1Forwarder: '0x6F83A16cA5B01eFe62c78F8e83682D7142493e07',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
};

// Celo Alfajores Testnet
const CELO_ALFAJORES = {
  host: '0x4E744b794A411f9a3634B40A815545bd8A618eEd',
  cfAv1Forwarder: '0x...', // Deploy via Superfluid CLI
  cUSD: '0x617F3113bf50Ae9359113310F26166dA674f683D',
};
```

## vs Direct x402

| Feature | x402 Direct | Superfluid Streaming |
|---------|-------------|---------------------|
| Best for | Short calls (< 5 min) | Long calls (> 5 min) |
| Gas cost | Per transaction | One-time setup + updates |
| Settlement | Immediate | Real-time stream |
| Complexity | Simple | Requires flow management |
| On-chain | ✅ Yes | ✅ Yes |

## Configuration

### Environment Variables

```bash
# Required for streaming
FACILITATOR_PRIVATE_KEY=...  # Server-side only, never exposed to client
```

### Chain Configuration

```typescript
import { defineChain } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// Auto-detect from wallet
const chain = walletChain.id === 42220 ? celo : celoAlfajores;
```

## Code Examples

### Start Stream with Auto-Detection

```typescript
async function startStream({ recipient, monthlyAmount }: {
  recipient: Address;
  monthlyAmount: bigint;
}) {
  // Check for existing flow
  const existingFlow = await getFlowInfo({
    sender: userAddress,
    receiver: recipient,
    token: cUSDAddress,
  });

  if (existingFlow && existingFlow.flowRate > 0n) {
    // Update existing flow
    await updateFlow({
      sender: userAddress,
      receiver: recipient,
      token: cUSDAddress,
      flowRate: monthlyAmount,
    });
  } else {
    // Create new flow
    await createFlow({
      sender: userAddress,
      receiver: recipient,
      token: cUSDAddress,
      flowRate: monthlyAmount,
    });
  }
}
```

### Grant Permissions (One-Time)

```typescript
async function grantPermissions(facilitatorAddress: Address) {
  // Grant unlimited approval to facilitator
  // This is a one-time operation per user
  const hash = await writeContract({
    address: cUSDAddress,
    abi: ERC20ABI,
    functionName: 'approve',
    args: [facilitatorAddress, MaxUint256],
  });
  
  await waitForTransactionReceipt(hash);
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INSUFFICIENT_BALANCE` | User doesn't have enough tokens | Check balance before starting |
| `FLOW_ALREADY_EXISTS` | Trying to create existing flow | Use updateFlow instead |
| `FLOW_DOES_NOT_EXIST` | Trying to update non-existent flow | Use createFlow instead |
| `UNAUTHORIZED` | Missing permissions | Call grantPermissions first |

### Graceful Degradation

```typescript
try {
  await startStream({ recipient, monthlyAmount });
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    // Show top-up modal
  } else if (error.code === 'UNAUTHORIZED') {
    // Request permissions
  } else {
    // Fallback to x402 direct payment
  }
}
```

## Testing

### Local Testing

```bash
# Use Alfajores testnet
export NEXT_PUBLIC_CELO_CHAIN_ID=44787

# Get testnet cUSD from faucet
# https://faucet.celo.org/alfajores
```

### Unit Tests

```typescript
describe('SuperfluidStreamingService', () => {
  it('should create new flow', async () => {
    const service = new SuperfluidStreamingService();
    await service.startStream({ recipient, monthlyAmount });
    
    const flowInfo = await service.getFlowInfo({ recipient });
    expect(flowInfo.flowRate).toBe(monthlyAmount);
  });

  it('should update existing flow', async () => {
    // Create first flow
    await service.startStream({ recipient, monthlyAmount: 100n });
    
    // Update flow
    await service.startStream({ recipient, monthlyAmount: 200n });
    
    const flowInfo = await service.getFlowInfo({ recipient });
    expect(flowInfo.flowRate).toBe(200n);
  });
});
```

## Resources

- [Superfluid Docs](https://docs.superfluid.finance/)
- [Celo Integration](https://docs.superfluid.finance/superfluid/networks/celo)
- [CFAv1Forwarder ABI](https://github.com/superfluid-finance/protocol-monorepo)
- [viem Documentation](https://viem.sh/)

