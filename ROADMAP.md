# Claflin Roadmap

## Current Status: Hetty Beta

The core voice loop is complete and honest. All payment flows settle real USDC on Arbitrum. All revenue splits are ledgered accurately. No fake features remain. The product is now focused on one thing: **voice-native tokenized stock trading with a confirmation layer**, starting with the first broker, **Hetty**.

### What works today

| Capability | Status |
|---|---|
| Voice calls via ElevenLabs Conversational AI | Live |
| Per-minute billing in USDC on Arbitrum | Live |
| On-chain settlement via 1Shot relayer | Live |
| 80/20 platform/broker revenue split (Redis ledger) | Live |
| Trial calls (2-min, server-tracked, one per IP) | Live |
| Broker self-registration + admin review | Live |
| Broker earnings dashboard with per-call breakdown | Live |
| ERC-8004 identity minting (Arbitrum Sepolia) | Live |
| Admin panel with wallet-based EIP-191 auth | Live |
| Rate limiting (Redis-backed) | Live |
| Webhook tool routing (Firecrawl, Composio, Venice) | Live |
| Brand, metadata, and broker-desk UX refocused on Claflin/Hetty | Done |

### What is NOT built (and documented as such)

| Gap | Status | Why |
|---|---|---|
| Real-money order execution / broker integrations | Phase B — requires regulated brokerage or Coinbase Advanced Trade APIs | Paper-trading intent capture first; real money only after compliance + execution review |
| Atomic on-chain 80/20 split | Phase B — requires PaymentRouter contract | Redis ledger is accurate; manual withdrawal works for current volume |
| Auto-approve broker listing | Not built — manual review is intentional for quality control | Curated desk during beta |
| Multi-broker marketplace beyond Hetty | Planned | Benham, Woodhull, and Claflin Concierge are planned personas |
| Phone number inbound (PSTN) | Not built — requires telephony provider | Future channel once voice UX is proven |
| Monitoring / observability | Not built | Premature without production traffic patterns |
| Load testing | Not built | Premature without production traffic patterns |

---

## Phase 0–4 (Complete)

### Phase 0 — Honesty Baseline
- README and architecture docs updated to clarify 80/20 split is ledgered, not on-chain
- All "fake" features either removed or labeled honestly

### Phase 1 — Correct Money
- Billing cap enforcement: `min(elapsed * rate, cap)` with auto-termination
- SSOT consolidation: all hardcoded chain IDs, USDC addresses, fee constants replaced with imports from `lib/arbitrum-chain.ts` and `lib/fees.ts`
- Dead code deletion: ~3,400 lines (PaymentFlow, intent-architecture, reputation-staking, 4 fake API routes)
- Settle route secured with EIP-191 wallet signature verification
- Skills honest refusal: BookingSkill.cancel and OrderingSkill.track return honest errors instead of fake success

### Phase 2 — Operator UX Coherence
- AgentPreviewSheet restyled to broker-desk amber theme
- Billing explainer: cap → talk → approve exact USDC → tx hash
- Voice preview theater fixed: HEAD-probes audio files before showing play button

### Phase 3 — Architecture Consolidation
- In-memory rate limiter replaced with Redis-backed `RedisRateLimiter`
- Payment entrypoint unified: `lib/payments/index.ts` reexports settlement only
- Redis key naming conventions documented (`docs/REDIS_KEYS.md`)

### Phase 4 — Real Two-Sided Utility
- Trial calls: server-side tracking via `/api/free-call` (IP fingerprint, 30-day TTL, 2-min cap)
- Earnings breakdown: `/api/agents/earnings` reads split-payment ledger per call, dashboard shows per-call breakdown
- Admin wallet auth: EIP-191 signature verification for approve/reject/delete

### Phase 4b — Brand Refocus
- Product renamed from VOISSS to **Claflin**
- First broker persona defined: **Hetty** — conservative, confirmation-first, tokenized-stock specialist
- App metadata, manifest, layout, README, and error/copy surfaces updated to Claflin/Hetty
- `app/list-your-agent` reorganized to `app/list-your-broker`
- `/api/agents` still the canonical API; user-facing copy refers to brokers

---

## Next: Hetty Beta (Current Priority)

**Pause building. Get 5-10 real users through the full flow:**
1. Open broker desk → call Hetty → paper-trade a tokenized stock → confirm by voice
2. Get 2-3 real broker candidates registered and approved
3. Watch where they get stuck, what they complain about, what they try that doesn't work
4. Fix those things
5. Then decide whether real-money execution or multi-broker scale is the right next investment

---

## Phase 5 — Scale (After Beta)

Informed by real traffic patterns:
- Redis-backed session management at scale
- Additional broker personas: Benham (research), Woodhull (growth/momentum), Claflin Concierge (routing)
- Optional regulated brokerage integration for real-money US stock execution
- PaymentRouter contract for atomic 80/20 split

---

## Opportunities under evaluation

- **Coinbase / Robinhood / Alpaca API layer** for paper → real-money graduation
- **Base migration** for lower-cost settlement after execution is proven
- **ERC-8004 reputation & delegation market** for broker discovery and user delegation
