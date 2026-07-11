# VOISSS Roadmap

## Current Status: Beta-ready

The core product loop is complete and honest. All payment flows settle real USDC on Arbitrum. All revenue splits are ledgered accurately. No fake features remain.

### What works today

| Capability | Status |
|---|---|
| Voice calls via ElevenLabs Conversational AI | Live |
| Per-minute billing in USDC on Arbitrum | Live |
| On-chain settlement via 1Shot relayer | Live |
| 80/20 platform/agent revenue split (Redis ledger) | Live |
| Trial calls (2-min, server-tracked, one per IP) | Live |
| Agent self-registration + admin review | Live |
| Agent earnings dashboard with per-call breakdown | Live |
| ERC-8004 identity minting (Arbitrum Sepolia) | Live |
| Admin panel with wallet-based EIP-191 auth | Live |
| Rate limiting (Redis-backed) | Live |
| Webhook tool routing (Firecrawl, Composio, Venice) | Live |

### What is NOT built (and documented as such)

| Gap | Status | Why |
|---|---|---|
| Atomic on-chain 80/20 split | Phase B — requires PaymentRouter contract | Redis ledger is accurate; manual withdrawal works for current volume |
| Auto-approve agent listing | Not built — manual review is intentional for quality control | Curated marketplace during beta |
| Agent-to-agent communication | Planned | ERC-8004 delegation registry enables this architecturally |
| Phone number inbound (PSTN) | Not built — requires telephony provider | See Circle marketplace opportunity below |
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
- AgentPreviewSheet restyled to switchboard amber theme
- Billing explainer: cap → talk → approve exact USDC → tx hash
- Voice preview theater fixed: HEAD-probes audio files before showing play button

### Phase 3 — Architecture Consolidation
- In-memory rate limiter replaced with Redis-backed `RedisRateLimiter`
- Payment entrypoint unified: `lib/payments/index.ts` re-exports settlement only
- Redis key naming conventions documented (`docs/REDIS_KEYS.md`)

### Phase 4 — Real Two-Sided Utility
- Trial calls: server-side tracking via `/api/free-call` (IP fingerprint, 30-day TTL, 2-min cap)
- Earnings breakdown: `/api/agents/earnings` reads split-payment ledger per call, dashboard shows per-call breakdown
- Admin wallet auth: EIP-191 signature verification for approve/reject/delete

---

## Next: Beta Test (Current Priority)

**Pause building. Get 5-10 real users through the full flow:**
1. Find agent → trial call → connect wallet → paid call
2. Get 2-3 real agents registered and approved
3. Watch where they get stuck, what they complain about, what they try that doesn't work
4. Fix those things
5. Then decide whether Scale or PaymentRouter is the right next investment

---

## Phase 5 — Scale (After Beta)

Informed by real traffic patterns:
- Redis-backed session management at scale
- Webhook idempotency (dedup by event ID)
- Monitoring / observability (Datadog or Grafana)
- Load testing

## Phase B — On-Chain Split (When Volume Justifies It)

- `PaymentRouter` contract: atomic 80/20 split at settlement
- Auto-split payouts: no manual withdrawal needed
- Currently the Redis ledger is honest and sufficient for beta volume

---

## Opportunities Under Evaluation

### Circle Agent Stack

Three concrete integrations identified:

**1. Circle Agent Wallets (agent treasury)**
- Each agent gets a Circle-controlled wallet with spending policies
- Agent earnings could auto-flow to their Circle wallet instead of manual withdrawal
- Gas-sponsored transactions — no ETH needed for agent operations
- 2-of-2 MPC: agent can't run off with funds, user retains custody
- Docs: https://developers.circle.com/agent-stack/agent-wallets

**2. Circle Gateway Nanopayments (x402 seller)**
- VOISSS could sell API access to agents via x402 — other AI agents pay per-call in USDC
- `@circle-fin/x402-batching` middleware: one line per route, returns 402 if unpaid
- This turns VOISSS from a consumer app into an agent-to-agent service marketplace
- Gasless, sub-cent USDC payments, batched settlement
- Docs: https://developers.circle.com/gateway/nanopayments/quickstarts/seller

**3. Circle Services Marketplace (phone numbers without Twilio)**
- The marketplace at https://agents.circle.com/services lists third-party services agents can procure
- Potential to acquire phone numbers without Twilio verification friction
- Would enable PSTN inbound calls — users call a real number, reach an agent
- This is the missing piece for "hotline" to be literal, not just browser-based

#### Marketplace exploration results (July 2026)

Tested with Circle Agent Wallet `0xdd6204dd1b7e0311e184dbe458dcc268715ea061` (mainnet, funded with $4 USDC on Base, wallet deployed via zero-value self-transfer).

**Two telephony providers found:**

| Provider | Network | x402 type | Number cost | AI call cost | AI engine |
|---|---|---|---|---|---|
| BlockRun.AI | Polygon | Circle Gateway (batched) | $5/month | $0.54/call | Bland.ai |
| StablePhone | Base | Vanilla x402 | $20/month | $0.54/call | Bland.ai |

**BlockRun.AI endpoints (https://nano.blockrun.ai):**
- `POST /api/v1/phone/numbers/buy` — $5 USDC, provision US/CA number, 30-day lease, wallet-bound
- `POST /api/v1/phone/numbers/list` — $0.001 USDC, list wallet-owned numbers
- `POST /api/v1/phone/numbers/renew` — $5 USDC, extend 30 days
- `POST /api/v1/phone/numbers/release` — free, release back to Twilio pool
- `POST /api/v1/phone/lookup` — $0.01 USDC, carrier identification
- `POST /api/v1/phone/lookup/fraud` — $0.05 USDC, fraud signals (SIM swap, call forwarding)
- `POST /api/v1/voice/call` — $0.54 USDC, outbound AI call via Bland.ai (requires wallet-owned "from" number)

**StablePhone endpoints (https://stablephone.dev):**
- `POST /api/call` — $0.54 USDC, outbound AI call (Bland.ai powered)
- `POST /api/number` — $20 USDC, buy US/CA number, 30-day lease
- `POST /api/number/topup` — $15 USDC, extend 30 days
- `GET /api/numbers` — free (SIWX auth), list wallet-owned numbers
- `GET /api/call/{call_id}` — free (SIWX auth), poll call status + transcript + recording
- `POST /api/lookup` — $0.05 USDC, iMessage/FaceTime/carrier lookup

**Critical limitations discovered:**
- Both services are **outbound-only** — no documented inbound call webhooks
- Both enforce **US/CA numbers only** (`^\+1\d{10}$` pattern) for AI calls
- Neither exposes Twilio's inbound webhook configuration (would be needed for VOISSS hotline)
- Both use Bland.ai as the AI voice engine, not ElevenLabs — different voice quality and agent config

**Circle Agent Wallet findings:**
- Wallet must be "deployed" on-chain before signing x402 payments — activated via zero-value self-transfer
- Gas-sponsored by Circle (no ETH needed for transactions)
- Same wallet address across all chains (BASE, ARB, MATIC, ETH, OP, AVAX, UNI)
- Circle CLI balance display can be stale — verify via direct RPC (`eth_call` on USDC contract)
- Supports Arbitrum One (chain 42161) — VOISSS could use Circle wallets natively

**Integration path for VOISSS PSTN (not yet implemented):**
1. Buy a number via BlockRun.AI ($5/month on Polygon) or StablePhone ($20/month on Base)
2. For inbound: need Twilio webhook config (not exposed by either marketplace service) OR build direct Twilio integration
3. For outbound AI calls: use BlockRun.AI/StablePhone's `/api/voice/call` endpoint ($0.54/call)
4. Bridge: Twilio inbound webhook → VOISSS backend → ElevenLabs Conversational AI (for inbound) or BlockRun/StablePhone API (for outbound)
5. Billing: x402 per-call payment from caller's wallet, or platform-subsidized for trial

**Recommended next step:** Build a direct Twilio + ElevenLabs inbound bridge for VOISSS, using the marketplace services only for outbound AI calls where the x402 payment flow is valuable. The marketplace phone number procurement is cheaper than direct Twilio ($5 vs ~$1.15/month) but the lack of inbound webhook access is a dealbreaker for a hotline product.

### Robinhood Chain

Robinhood Chain is an Arbitrum Nitro L2 — same stack as Arbitrum One. Potential considerations:
- FCFS transaction ordering (no priority gas auctions) — better for payment routing
- ERC-4337 account abstraction first-class — could simplify wallet onboarding
- Stock token RWA infrastructure — agents could trade tokenized equities
- Built on Arbitrum Dedicated Blockchains — same EVM compatibility, viem/ethers work unchanged
- Docs: https://docs.robinhood.com/chain/

**Open question for mentors:** Does it make sense to deploy on Robinhood Chain in addition to Arbitrum One, or is that spreading too thin for a beta-stage product?

---

## Test Coverage

107 tests, all passing:
- Fee math invariants (12 tests): 80/20 split, bigint precision, edge cases
- Agent listing rules (12 tests): status filtering, self-registration, admin lifecycle
- Agent registry (5 tests): 7 agents, required fields, specialty lookup
- Agent skills (8 tests): skill execution, permission validation
- Auth (8 tests): EIP-191 verification, replay protection, admin auth
- Payment (varies): settlement flow, signature mutation prevention
- Webhook (varies): tool routing, ElevenLabs integration
