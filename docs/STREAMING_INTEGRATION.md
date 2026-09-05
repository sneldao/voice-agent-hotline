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
is the paid-call settlement path, not a charge on eligible trial calls or a guarantee that every settlement succeeds. Call payments are separate from paper-trade instructions.

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

## Future payment changes are gated

This is a historical implementation note, not a proposal to reintroduce streaming or subscriptions. [Product Direction](PRODUCT_DIRECTION.md) prioritizes a useful relationship with Hetty, not longer calls or protocol breadth. [ROADMAP.md](../ROADMAP.md) defines the gate: demonstrate a concrete client or operational need, then separately review consent, caps, settlement correctness, and complexity before selecting an approach. Do not revive removed integrations as a default next step.
