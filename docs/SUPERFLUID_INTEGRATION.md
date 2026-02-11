# Superfluid Streaming Integration Guide

## Overview

VOISSS now supports **real-time streaming payments** via Superfluid x402 for pay-per-second voice calls.

## How It Works

### Traditional x402 (Per-Call)
```
Call starts → Authorize payment → Pay per minute → End call
```

### Superfluid Streaming (Per-Second)
```
Grant ACL (one-time) → Start stream → Pay per second continuously → End call → Stream stops
```

## Benefits

| Feature | Traditional | Streaming |
|---------|-------------|-----------|
| Billing | Per minute | Per second |
| Overpay risk | High | None |
| Cancel anytime | No (prepaid) | Yes (instant) |
| Perfect for | Short calls | Long conversations |

## Integration

### 1. Initialize Streaming Service

```typescript
import { SuperfluidStreamingService } from './lib/superfluid-streaming';

const service = new SuperfluidStreamingService(userAddress, walletClient);
```

### 2. Grant ACL Permissions (One-Time)

```typescript
await service.grantPermissions(facilitatorAddress);
```

### 3. Start Streaming Call

```typescript
const result = await service.startStream({
  recipient: agentAddress,
  monthlyAmount: '1000000000000000000', // 1 USDC/month
  account: userAddress,
});
```

### 4. Stop Streaming

```typescript
await service.stopStream(agentAddress);
```

## Configuration

### Base Mainnet

```typescript
const SUPERFLUID_CONFIG = {
  usdcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  usdcxToken: '0xd04383398dd2426297da660f9cca3d439af9ce1b',
  cfaV1Forwarder: '0xcfA132E353cB4E3180835bd80aA1126F87b751Ee',
};
```

## Rate Calculation

```typescript
// 1 USDC/minute = 1 * 60 * 24 * 30 = 43200 USDC/month
// Flow rate = monthlyAmount / (30 days * 24 hours * 60 minutes * 60 seconds)
```

## Flow Rate Formula

```
flowRate = monthlyUSDC / 2,592,000 seconds per month
```

Example: 43200 USDC/month = 0.0167 USDC/second

## Production Checklist

- [ ] Deploy Superfluid facilitator
- [ ] Configure CFAV1 Forwarder permissions
- [ ] Set up USDC → USDCx wrapping infrastructure
- [ ] Add streaming option to payment UI
- [ ] Test with small amounts
- [ ] Monitor stream health

## Related Files

- `lib/superfluid-streaming.ts` - Core service
- `lib/useSuperfluidStreaming.ts` - React hook
- `components/StreamingPaymentModal.tsx` - UI component

## References

- [x402-superfluid](https://x402.superfluid.org/)
- [Superfluid Docs](https://docs.superfluid.finance/)
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)
