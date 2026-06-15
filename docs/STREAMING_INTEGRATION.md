# Streaming Payment Integrations

> **Status:** Removed. The streaming infrastructure (Superfluid + WDK)
> shipped before the project migrated to x402 on Arbitrum. The code
> was deleted once the x402 path was proven out — see commit history
> for the `chore: remove Superfluid + WDK dead code` series.

## Current Payment Model

The active payment model is **x402 USDC on Arbitrum** with gasless
settlement via the 1Shot Permissionless Relayer — see
`lib/payment-settlement.ts` and `app/api/payments/`. This is the
documented model in `docs/AGENTIC_ARCHITECTURE.md#payment-flow` and
is what every call settles through.

## Why the Streaming Path Was Removed

Superfluid (CFAv1Forwarder / USDCx) and the WDK (Tether Wallet
Development Kit) were the earlier Celo-era experiments. They were
deleted because:

1. **No callers** — `useSuperfluidStreaming`, `StreamingPaymentModal`,
   and `SuperfluidStreamingService` were never reached in the active
   call flow once x402 took over.
2. **Wrong chain** — the contracts are Celo-only and the project
   settled on Arbitrum.
3. **Wrong model** — per-second streaming required pre-funding and
   facet control; per-call x402 settlement is simpler and
   non-custodial.
4. **Dead dependencies** — `@tetherto/wdk` + `@tetherto/wdk-wallet-evm`
   + `@tetherto/wdk-failover-provider` and their native `sodium-native`
   / `require-addon` chain were adding build warnings for code that
   nothing imported.

Removed in this cleanup:

- `lib/superfluid-streaming.ts`
- `lib/useSuperfluidStreaming.ts`
- `components/StreamingPaymentModal.tsx`
- `CFA_V1_FORWARDER` and `SUPERFLUID_USDCX` exports from
  `lib/arbitrum-chain.ts`
- The WDK / sodium-native / require-addon `ignoreWarnings` blocks in
  `next.config.js`
- `NEXT_PUBLIC_FACILITATOR_ADDRESS` and the WDK env-var block in
  `.env.local.example`
- WDK packages from `pnpm-lock.yaml`
- The `superfluid_stream` mode from `useRealPayment.ts`
  (`PaymentState.mode` is now `'user_settled'` only)
- The `paymentMode === 'streaming'` / `streamingPreflight` branches
  in `ActiveCall.tsx`

## If You Want Streaming Back

If the product needs subscription or continuous-stream use cases
later, the right move is not to revive the deleted code. The x402
model already supports per-call micro-billing; adding a session-key /
delegated-streaming layer on top of x402 (or pulling in a 2025+
protocol like Superfluid's SuperVNet) is the cleaner path.
