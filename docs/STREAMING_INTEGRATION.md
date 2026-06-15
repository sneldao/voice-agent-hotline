# Streaming Payment Integrations

> **Status:** Inactive. The streaming infrastructure (Superfluid + WDK)
> shipped before the project migrated to x402 on Arbitrum. The code
> remains in the repo for reference but is not wired into the active
> payment path.

## Why

The current payment model is **x402 USDC on Arbitrum** with gasless
settlement via the 1Shot Permissionless Relayer — see
`lib/payment-settlement.ts` and `app/api/payments/`. This is the
documented model in `docs/AGENTIC_ARCHITECTURE.md#payment-flow` and
is what every call actually settles through.

Superfluid and the WDK (Tether Wallet Development Kit) were the
earlier Celo-era experiments. They are no longer on the active path:

- `lib/superfluid-streaming.ts` — CFAv1Forwarder helpers, Celo-only
- `lib/useSuperfluidStreaming.ts` — React hook wrapping the helpers
- `components/StreamingPaymentModal.tsx` — UI for starting/stopping a
  Superfluid stream

The WDK packages are still listed in `package-lock.json` for legacy
reasons but are not imported anywhere. A future cleanup pass can
remove them.

## If You Want Streaming Back

If the product needs subscription or continuous-stream use cases
later, the right move is not to revive this code. The x402 model
already supports per-call micro-billing; adding a session-key /
delegated-streaming layer on top of x402 is the cleaner path. The
`StreamingPaymentModal` component can be re-tasked at that point
without depending on Superfluid or the Celo contract set.
