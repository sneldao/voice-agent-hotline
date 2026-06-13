# VOISSS Codebase Quality & Docs-Vs-Code Discrepancy Review

**Date:** 2026-06-13  
**Repo:** `sneldao/voice-agent-hotline`  
**Branch:** `main`  
**Method:** Systematic comparison of all `docs/*.md` claims against actual implementation in `app/`, `components/`, `lib/`, `contracts/`, and `tests/`.

---

## Executive Summary

The codebase is functionally impressive — a Next.js 15 voice-agent marketplace with ElevenLabs widget integration, Upstash Redis, on-chain delegation logic, and a comprehensive skill framework. However, there is a **material gap between documented architecture and actual implementation** in several critical areas. The docs describe features, contracts, and payment flows that either don't exist, are only partially implemented, or are implemented differently than claimed.

| Severity | Count | Areas |
|----------|-------|-------|
| 🔴 Critical | 6 | Payment settlement bug, fake contract addresses, invalid signature, missing auth middleware, dead MetaMask SA package, AgentToAgentChat missing |
| 🟡 Major | 10 | Redis model mismatches, ABI mismatches, tokenId placeholder, orphaned WebRTC code, revenue split faked, GET /api/agents doesn't filter status, @erc7824/nitrolite dead dependency, unused @tanstack/react-virtual, next-themes incompatible, dotenv suspicious version |
| 🟢 Minor | 8 | Dependencies in wrong section, stale .next build refs, missing tests, hardcoded voice IDs, volume binary-only, comment typos, devDependencies misplacement |

---

## 1. API Routes & Backend

### 1.1 Documented Endpoints — All Exist But Behavior Deviates

All 7 endpoints documented in `docs/AGENTIC_ARCHITECTURE.md` exist:

| Endpoint | File | Issue |
|----------|------|-------|
| `GET /api/agents` | `app/api/agents/route.ts:9-78` | **Does NOT filter by `status='active'`**. Returns all agents from `agent_index` including `pending` and `rejected`. Frontend may filter, but API contract is broken. |
| `DELETE /api/agents/:id` | `app/api/agents/[id]/route.ts:103-115` | Deletes the hash but **does NOT remove the ID from `agent_index` Set**. Deleted agents still appear in listings until the set is rebuilt. |
| `POST /api/agents/seed` | `app/api/agents/seed/route.ts:4-18` | Creates agents with `active: 'true'` immediately, bypassing the `pending` lifecycle that the architecture diagram describes. |

### 1.2 Undocumented Endpoints (~21 routes)

The codebase contains a rich API surface that is **not mentioned in any architecture doc**:

```
/api/agents/payout          /api/analytics           /api/calls
/api/calls/:id              /api/delegations         /api/disputes
/api/events                 /api/intents             /api/payments
/api/payments/settle        /api/ratings             /api/reputation
/api/sdk/config             /api/sdk/health          /api/sdk/register
/api/sdk/stats              /api/stake               /api/users/:address
/api/voice                  /api/webhooks/elevenlabs /api/webrtc/signal
```

Some of these are critical to the product (e.g., `/api/webhooks/elevenlabs`, `/api/webrtc/signal`) but absent from `AGENTIC_ARCHITECTURE.md`.

### 1.3 Agent Lifecycle — Partially Implemented

The `pending → active → rejected` flow works for **self-registration only**:

- ✅ `POST /api/agents` with `register: true` stores `status: 'pending'` (`route.ts:209-230`)  
- ✅ `PATCH /api/agents/:id` with `action: 'approve'` activates (`[id]/route.ts:36-46`)  
- ✅ `PATCH /api/agents/:id` with `action: 'reject'` rejects (`[id]/route.ts:48-58`)  
- ❌ `GET /api/agents` does not filter — any consumer gets all statuses  
- ❌ No automated transition logic; manual admin action only  
- ❌ Seeded agents skip the lifecycle entirely

### 1.4 Redis Data Structures — Model Mismatch

| Documented | Actual | Verdict |
|------------|--------|---------|
| `agent:<id>` → JSON Agent object | `agent:<id>` → Redis Hash | ✅ Correct |
| `agents:list` → sorted set | `agent_index` → **plain Set** (not sorted) | ❌ Wrong name + wrong type |
| `call:<id>` → JSON call record | `call:<id>` → Redis Hash | ✅ Correct |
| `calls:agent:<id>` → list of call IDs | **Does NOT exist** | ❌ Missing |
| — | `call_index:all`, `call_index:<caller>` | 🔵 Extra / undocumented |
| — | `agents:online` → Sorted Set | 🔵 Extra / undocumented |

---

## 2. Widget & Voice Layer

### 2.1 Widget Architecture — Mostly Accurate

The `docs/WIDGET_ARCHITECTURE.md` claims are largely verified:

- ✅ `WidgetEngineProvider` wraps app in `app/layout.tsx`
- ✅ `useWidgetConversation` drives the widget instead of raw SDK
- ✅ `ActiveCall` imports `useWidgetConversation`
- ✅ Legacy `useElevenLabsConversation` and `ElevenLabsWidget` removed from source
- ✅ Signed URL mode via `/api/webrtc/signal` works

### 2.2 Critical Widget Discrepancies

| Claim | Reality | File |
|-------|---------|------|
| "`toggleMute` tries widget method, falls back to audio track manipulation" | Only tries widget methods (`setMicMuted`, `toggleMute`, `mute`, `unmute`). **No `MediaStreamTrack` fallback.** | `lib/useWidgetConversation.ts` |
| "Transcripts come from ElevenLabs webhook, not widget events" | `useWidgetConversation` attaches **20+ event listeners** expecting transcripts from the widget. `ActiveCall` renders a live transcript scroll area that **will remain empty** during the call. | `lib/useWidgetConversation.ts`, `components/ActiveCall.tsx` |
| "Connection state detected via MutationObserver" | MutationObserver is in `useWidgetConversation.ts`, **not** in `WidgetEngine.tsx`. | `lib/useWidgetConversation.ts` |
| "Old SDK plumbing removed" | `lib/webrtc-voice.ts` (~720 lines) is a complete orphaned `WebRTCVoiceService` with peer connection, ICE, data channels, metrics — **dead code, never imported**. | `lib/webrtc-voice.ts` |
| `useSignedUrl = true` is a default | The code **throws an explicit error if `!useSignedUrl`**, making signed-URL mode mandatory, not optional. | `lib/useWidgetConversation.ts` |

### 2.3 ActiveCall Component Issues

- **Audio level is hardcoded to 0** in hook state and never updated from the widget, yet a waveform animation consumes CPU rendering it (`components/ActiveCall.tsx`).
- **Volume control is binary** (`0` or `1`), not continuous 0-1 as the interface suggests.
- **Comment `#20` references "SDK flush final transcript events"** — holdover from old SDK mental model; widget does not flush events.
- **Auto-starts call 250ms after mount** without explicit user confirmation beyond tapping the agent card.

---

## 3. Payments, Blockchain & Contracts

### 3.1 ERC-8004 Contracts — Critical Gap

The docs claim three deployed ERC-8004 contracts on Arbitrum Sepolia:

| Contract | Doc Address | Reality |
|----------|-------------|---------|
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | **No contract source in repo** |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | **No contract source in repo** |
| Delegation Registry | `0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00` | Custom `DelegationRegistry.sol` exists but **does NOT implement ERC-8004** |

The addresses follow a cute pattern (`0x8004...`) but there is **no Solidity source in the repo** to verify they were deployed from this code. The actual `DelegationRegistry.sol` does not match the TypeScript ABI in `lib/erc8004.ts`.

### 3.2 ABI Mismatches in `lib/erc8004.ts`

| ABI Claim | Contract Reality | Impact |
|-----------|-----------------|--------|
| `setRate()` exists | Not in `DelegationRegistry.sol` | Function will revert if called |
| `verifyAgent()` exists | Not in `DelegationRegistry.sol` | Function will revert if called |
| `getAgent()` returns `specialties: string[]` | Hardcoded `specialties: []` in TS with comment "Would need additional call" | Always returns empty array |
| `registerAgent` extracts `tokenId` from logs | `const tokenId = BigInt(receipt.logs.length)` — **placeholder, always wrong** | Token IDs will never be correct |
| `createDelegation` returns `delegationId` | Returns `receipt.transactionHash`, but contract computes `keccak256(abi.encodePacked(msg.sender, delegate, block.timestamp, block.difficulty))` | Returned ID will never match on-chain ID |

### 3.3 Payment Settlement — Invalid Signature Bug

Both `lib/payment-settlement.ts` and `lib/payments/x402.ts` contain a **critical bug**:

```typescript
const adjustedAuth: SignedAuthorization = {
  ...session.authorization,
  value: actualCostWei,
};
const result = await paymentSettlement.settlePayment(adjustedAuth, ...);
```

The `value` field is modified but the **signature was computed over the original `maxAuthorized` value**. Changing `value` invalidates the EIP-712 signature. On-chain execution will revert with an invalid signature error. The comment even admits: "In production, you'd use a more sophisticated partial settlement mechanism".

### 3.4 Revenue Split — Faked in Redis Only

The docs claim:  
> "Platform fee (20%) → PAYMENT_RECEIVER, Agent earnings (80%) → agent.wallet_address"

Reality:
- Only **a single `transferWithAuthorization`** is executed per settlement.
- The 80/20 split is **only logged to console and stored in Redis** (`/api/payments/settle/route.ts`).
- There is **no on-chain verification** that the txHash actually occurred with the claimed amount.
- The split is "on the roadmap" per docs, but the code partially fakes it with no security.

### 3.5 MetaMask Smart Accounts — Missing Dependency

- `@metamask/smart-accounts-kit` is **imported in `lib/metamask-smart-account.ts`** but **NOT listed in `package.json` dependencies**.
- `redeemDelegation()` **throws unconditionally**: `throw new Error('redeemDelegation: use @metamask/smart-accounts-kit/actions erc7710RedeemDelegation')`.
- The entire file is marked `'use client'` and cannot be used in server API routes anyway.

### 3.6 OneShot Relayer — Mostly Dead Code

- `lib/oneshot-relayer.ts` implements `relay`, `relayDelegation`, `relayPayment`, `getStatus`.
- **`get isConfigured()` always returns `true`** because it's "permissionless" — requests will fail at runtime if the URL is wrong.
- `relayDelegation` uses a guessed EIP-7710 encoding (`0xef0100` prefix) with no verification.
- Only actually invoked from the ElevenLabs webhook's `gasless_settle` tool.
- Endpoint assumptions (`/relay`, `/status`) may not match the real 1Shot API.

### 3.7 Superfluid vs Yellow Network

| Documented | Reality |
|------------|---------|
| "Yellow Network state channels as primary payment" | `@erc7824/nitrolite` is in `package.json` but **never imported** in any `.ts`/`.tsx` file. Zero Yellow Network code exists. |
| "Superfluid available as an alternative" | Superfluid is **fully implemented and actively used**: `lib/superfluid-streaming.ts`, `useSuperfluidStreaming.ts`, `StreamingPaymentModal.tsx`, `ActiveCall.tsx`. |

**Verdict:** Docs describe a non-existent primary payment channel and understate the actually-working Superfluid integration.

### 3.8 Call Billing API — Broken Session-Start

`POST /api/calls/:id` calls `startBilling(callSession.id)` but **never creates an authorization session first** (`authorizeCall()` is never called). `startBilling` will throw `Session not found` because the session ID does not exist in Redis.

### 3.9 Contract Directory — Only 2 Files

```
contracts/
├── DelegationRegistry.sol    # Custom, not ERC-8004
└── AgentSmartWallet.sol      # Sophisticated ERC-4337 contract, NEVER used in app
```

- `AgentSmartWallet.sol` is not imported, deployed, or referenced anywhere.
- No Identity contract source.
- No Reputation contract source.

---

## 4. Frontend & Components

### 4.1 Missing Components

| Documented Component | Status | Evidence |
|---------------------|--------|----------|
| `AgentToAgentChat` | **❌ Does NOT exist** | Searched all `.ts`, `.tsx`, `.md` files — only referenced in `docs/AGENTIC_ARCHITECTURE.md` |

### 4.2 `AgentToAgentChat` Claim

> "The `AgentToAgentChat` component enables agents to communicate with each other for complex multi-step tasks. This uses the ERC-8004 Delegation Registry..."

Reality: **No such component exists.** No agent-to-agent communication code exists anywhere.

### 4.3 DelegationPanel

✅ `components/DelegationPanel.tsx` (~446 lines) is a full, well-implemented ERC-8004 delegation UI with permission toggles, risk-based coloring, spend sliders, and expiry controls. It correctly falls back when `NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS` is not set. This is a high-quality component that matches its documented intent.

### 4.4 DiscoverTab / AgentPreviewSheet

✅ Both components are clean, functional, and match the operator-console UI described in the widget architecture doc. No discrepancies.

### 4.5 Performance Docs Gap

`docs/PERFORMANCE.md` documents planned optimizations that are **not actually implemented**:

| Optimization | Status |
|-------------|--------|
| `@tanstack/react-virtual` for virtual scrolling | **Dependency present but never imported** |
| `next-pwa` / service worker caching | **Not installed, not used** |
| `web-vitals` package | **Not installed, not used** |
| Code splitting with `dynamic()` imports | **Not used** |

---

## 5. Deployment, Infrastructure & Security Docs

### 5.1 `docs/DEPLOYMENT.md` — Accurate with Minor Gaps

| Claim | Status | Evidence |
|-------|--------|----------|
| Vercel auto-deploys from `main` | ✅ Accurate | Standard Vercel Git integration |
| Hetzner VPS on port 3042, ~52 MB | ✅ Accurate | `ecosystem.config.js`, `scripts/deploy.sh` |
| Dual-deployment architecture (Vercel frontend → Hetzner API) | ✅ Accurate | `NEXT_PUBLIC_API_URL` routing pattern |
| Shared Upstash Redis instance | ✅ Accurate | `lib/redis.ts` uses same URL |
| Env vars listed for Vercel Dashboard | ⚠️ **Missing vars** | Docs omit `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_PAYMENTS_ENABLED`, `NEXT_PUBLIC_X402_ENABLED`, `NEXT_PUBLIC_PAYMENT_SETTLEMENT_ENABLED`, `AGENT_NOTIFICATION_WEBHOOK_URL`, `AGENT_WALLET` which all exist in `ecosystem.config.js` |
| Seed agents via `curl POST /api/agents/seed` | ⚠️ **Unprotected** | No auth middleware on seed endpoint (`app/api/agents/seed/route.ts:4-18`) |

### 5.2 `docs/HETZNER_DEPLOYMENT.md` — Accurate and Operational

| Claim | Status | Evidence |
|-------|--------|----------|
| `make deploy` runs `scripts/deploy-hetzner.sh` | ✅ Accurate | `Makefile` |
| `scripts/deploy.sh` does git pull → build → clean → restart | ⚠️ **Partially misleading** | Docs reference `scripts/deploy.sh` but `Makefile` calls `scripts/deploy-hetzner.sh` (local build + rsync). `scripts/deploy.sh` is a **server-side fallback** that builds ON the server. Two different scripts with different flows. |
| Cleanup saves ~1.2 GB | ✅ Accurate | `scripts/cleanup-standalone.sh` removes `.next/{cache,server,static,types,trace}` |
| PM2 ecosystem config reads `.env.hetzner` | ✅ Accurate | `ecosystem.config.js` has `loadEnv('/opt/voice-hotline/.env.hetzner')` |
| Nginx reverse proxy config provided | ✅ Accurate | Docs include working config |
| Redis connectivity test with `curl /ping` | ✅ Accurate | Standard Upstash REST API |

**Key discrepancy:** The docs conflate two deploy scripts:
- `make deploy` → `scripts/deploy-hetzner.sh` (local build + rsync — **preferred**)
- `scripts/deploy.sh` (server-side build — **fallback**)

The docs only describe the server-side fallback but label `make deploy` as running it.

### 5.3 `docs/SECURITY_ARCHITECTURE_COMPARISON.md` — Accurate Claims, Implementation Lags Behind

| Claim | Status | Evidence |
|-------|--------|----------|
| "Zero payment private keys on the server" | ✅ Accurate | `useRealPayment.ts` signs client-side; server only has `FACILITATOR_PRIVATE_KEY` for identity minting |
| "User has full control over transaction timing and approval" | ✅ Accurate | EIP-3009 `transferWithAuthorization` is user-signed |
| `FACILITATOR_PRIVATE_KEY` is the only server key | ✅ Accurate | Confirmed in `.env.local` and `ecosystem.config.js` |
| "Admin endpoints … add auth middleware before exposing publicly" | ❌ **Not implemented** | `PATCH /api/agents/:id`, `DELETE /api/agents/:id`, `POST /api/agents/seed` have **NO auth middleware** (`app/api/agents/[id]/route.ts`, `app/api/agents/seed/route.ts`) |
| "Seed endpoint should be restricted to internal/admin use" | ❌ **Not restricted** | `POST /api/agents/seed` is completely open |
| "MetaMask Smart Accounts Kit" for wallet connection | ⚠️ **Partially dead** | `lib/metamask-smart-account.ts` imports `@metamask/smart-accounts-kit` which is **NOT in `package.json`** |
| Env vars stored in `.env.local` / Vercel dashboard, not committed | ✅ Accurate | `.gitignore` excludes `.env`, `.env.local`, `.env.hetzner` |
| `ecosystem.config.js` not committed | ⚠️ **Actually IS committed** | `ecosystem.config.js` exists in repo root and **IS tracked by git**. It does NOT contain secrets (reads from `.env.hetzner`), but the doc explicitly says it is "not committed" which is false. |

**Critical security gap:** The security doc correctly identifies that admin endpoints need auth middleware, but the code has not added it. This is a documented-known-risk that remains unmitigated.

---

## 6. Code Quality Issues

### 5.1 Dead / Orphaned Code

| File | Lines | Issue |
|------|-------|-------|
| `lib/webrtc-voice.ts` | ~720 | Complete `WebRTCVoiceService` class. Never imported by any widget-layer component. |
| `lib/x402.ts` | ~95 | Standalone `X402Payments` class. Not imported anywhere; the app uses `lib/payments/x402.ts` instead. |
| `contracts/AgentSmartWallet.sol` | — | Sophisticated ERC-4337 contract. Never referenced in the app. |
| `lib/metamask-smart-account.ts` | — | Entirely unimplemented; `redeemDelegation` throws unconditionally. |

### 5.2 Dependency Issues

| Package | Issue |
|---------|-------|
| `@erc7824/nitrolite` | In `dependencies`, never imported |
| `@tanstack/react-virtual` | In `dependencies`, never imported |
| `@metamask/smart-accounts-kit` | **Imported but NOT in `package.json`** — will fail at runtime |
| `undici` | In `dependencies`; Next.js already bundles it |
| `dotenv` | Version `^17.3.1` is suspicious (latest stable is 16.x) |
| `lucide-react` | `^0.263.1` is very outdated (current ~0.460+) |
| `next-themes` | `^0.2.1` likely incompatible with Next.js 16 / React 19 |
| `@types/*`, `typescript`, `autoprefixer`, `postcss`, `tsx` | All in `dependencies` — should be in `devDependencies` |

### 5.3 Type & Logic Bugs

| File | Line / Area | Issue |
|------|-------------|-------|
| `lib/erc8004.ts` | `registerAgent()` | `tokenId = BigInt(receipt.logs.length)` — placeholder, never correct |
| `lib/erc8004.ts` | `createDelegation()` | Returns `transactionHash` as `delegationId` — never matches contract's `keccak256` hash |
| `lib/erc8004.ts` | `checkCeloConnection()` | Actually checks **Arbitrum**, not Celo. Copy-paste error. |
| `lib/payment-settlement.ts` | `formatEther` / `parseEther` | Used for **USDC** amounts; USDC has 6 decimals, not 18. Yields wrong values. |
| `lib/payments/x402.ts` | `endCall()` | Submits authorization with modified `value` — **invalidates signature** |
| `app/api/calls/[id]/route.ts` | `POST` | Calls `startBilling()` with unregistered session ID — throws `Session not found` |
| `app/api/agents/[id]/route.ts` | `DELETE` | Does not remove agent ID from `agent_index` Set |
| `app/api/payments/settle/route.ts` | Entire route | Tracking-only; does not verify txHash on-chain |
| `lib/metamask-smart-account.ts` | `createSmartAccountSession()` | Uses `@metamask/smart-accounts-kit` which is **missing from package.json** |
| `lib/erc8004.ts` | `DelegationScope` in `types.ts` | `maxSpend: number` (not bigint/wei), but contract uses `uint256` |

### 5.4 Security Concerns

| Issue | File | Detail |
|-------|------|--------|
| Admin endpoints unprotected | `app/api/agents/[id]/route.ts` | `PATCH`, `DELETE`, `POST /seed` have no auth middleware. Anyone can approve/reject agents. |
| Payment verification missing | `app/api/payments/settle/route.ts` | Accepts any `txHash` without `eth_getTransactionReceipt` check. |
| In-memory payment sessions | `app/api/payments/route.ts` | `Map<string, ...>` is in-memory only; data lost on serverless cold start. |
| Rate limit bypass | `app/api/agents/route.ts` | Registration rate-limit is IP-based (easy to bypass with proxies). |

### 5.5 Test Coverage

Only **2 test files** exist:

```
tests/agent-registry.test.ts   (2,952 bytes)
tests/agent-skills.test.ts     (3,414 bytes)
```

**No tests for:**
- Payment settlement (`lib/payments/x402.ts`, `payment-settlement.ts`)
- ERC-8004 contract interactions (`lib/erc8004.ts`)
- Webhook handler (`app/api/webhooks/elevenlabs/route.ts`)
- Venice AI (`lib/venice-ai.ts`)
- Composio (`lib/composio.ts`)
- Firecrawl (`lib/firecrawl.ts`)
- OneShot relayer (`lib/oneshot-relayer.ts`)
- Superfluid streaming (`lib/superfluid-streaming.ts`)
- Any React components
- Any API routes

Test runner: `tsx --test tests/*.test.ts` (Node.js built-in runner).

---

## 6. What Actually Works Well

Despite the discrepancies, several parts of the codebase are solid:

1. **Widget engine** (`components/WidgetEngine.tsx`): Clean React context provider, well-structured shadow-DOM interaction, health check diagnostics.
2. **Webhook orchestrator** (`app/api/webhooks/elevenlabs/route.ts`): Comprehensive tool routing to Composio, Venice AI, native skills, Firecrawl, and on-chain reputation.
3. **Agent skills framework** (`lib/agent-skills.ts`): 900+ lines of well-structured skill logic with validation and error handling.
4. **DelegationPanel UI** (`components/DelegationPanel.tsx`): Full-featured delegation UI with proper fallbacks.
5. **Venice AI, Composio, Firecrawl integrations**: All three services are properly implemented and wired into the webhook handler.
6. **Redis persistence**: Consistent key naming and pipeline usage for atomic operations.
7. **EIP-3009 client-side signing** (`useRealPayment.ts`): Users can sign `transferWithAuthorization` via MetaMask directly — this is the most real part of the payment flow.
8. **CORS & rate-limiting**: Present on most public-facing routes.

---

## 7. Recommendations

### Immediate (High Risk)

1. **Fix payment settlement signature bug** — do not modify `value` on a signed authorization. Either settle the full authorized amount or implement proper partial settlement with re-signing.
2. **Add auth middleware** to admin endpoints (`PATCH /api/agents/:id`, `DELETE`, `POST /seed`) before public deployment.
3. **Remove or implement `AgentToAgentChat`** — or remove the reference from `docs/AGENTIC_ARCHITECTURE.md`.
4. **Add `@metamask/smart-accounts-kit` to `package.json`** or remove `lib/metamask-smart-account.ts`.
5. **Remove `@erc7824/nitrolite` from dependencies** or implement Yellow Network state channels.
6. **Fix `GET /api/agents`** to filter by `status='active'` or document that filtering is client-side.
7. **Fix `DELETE /api/agents/:id`** to also remove from `agent_index` Set.

### Short Term

8. **Move dev dependencies** (`@types/*`, `typescript`, `autoprefixer`, `postcss`, `tsx`) to `devDependencies`.
9. **Fix `dotenv` version** — `^17.3.1` is likely invalid; use `^16.4.x`.
10. **Upgrade `lucide-react`** and `next-themes` to compatible versions.
11. **Remove dead code**: `lib/webrtc-voice.ts`, `lib/x402.ts`, `contracts/AgentSmartWallet.sol` (or use them).
12. **Fix `lib/erc8004.ts` tokenId extraction** — parse event logs properly instead of `receipt.logs.length`.
13. **Fix `lib/erc8004.ts` delegationId** — compute the same keccak256 hash as the contract or read it from the `DelegationCreated` event.
14. **Fix USDC decimal handling** in `payment-settlement.ts` — use 6 decimals, not `formatEther`/`parseEther`.

### Medium Term

15. **Add tests**: webhook handler, payment settlement, ERC-8004 interactions, React components.
16. **Consolidate payment flow**: either use `/api/payments` (with Redis persistence) or `useRealPayment.ts`, not both with different semantics.
17. **Document the ~21 undocumented API endpoints** or remove unused ones.
18. **Align Redis data model docs** with actual keys used (`agent_index`, not `agents:list`).
19. **Either implement `@tanstack/react-virtual`** or remove it from dependencies.
20. **Implement on-chain tx verification** in `/api/payments/settle` before crediting agent revenue.

---

## Appendix A: File Inventory

### Docs
```
docs/AGENTIC_ARCHITECTURE.md
docs/WIDGET_ARCHITECTURE.md
docs/DEPLOYMENT.md
docs/HETZNER_DEPLOYMENT.md
docs/PERFORMANCE.md
docs/SECURITY_ARCHITECTURE_COMPARISON.md
docs/SUPERFLUID_INTEGRATION.md
```

### Key Implementation Files Referenced
```
app/api/agents/route.ts
app/api/agents/[id]/route.ts
app/api/agents/seed/route.ts
app/api/agents/stats/route.ts
app/api/agents/payout/route.ts
app/api/calls/[id]/route.ts
app/api/payments/route.ts
app/api/payments/settle/route.ts
app/api/delegations/route.ts
app/api/webhooks/elevenlabs/route.ts
app/api/webrtc/signal/route.ts
components/WidgetEngine.tsx
components/ActiveCall.tsx
components/VoiceRouter.tsx
components/DelegationPanel.tsx
components/WidgetProbe.tsx
lib/useWidgetConversation.ts
lib/erc8004.ts
lib/payment-settlement.ts
lib/payments/x402.ts
lib/oneshot-relayer.ts
lib/metamask-smart-account.ts
lib/superfluid-streaming.ts
lib/webrtc-voice.ts
lib/x402.ts
lib/db-seed.ts
lib/redis.ts
lib/types.ts
contracts/DelegationRegistry.sol
contracts/AgentSmartWallet.sol
package.json
```

---

*Review generated by systematic docs-vs-code comparison across 4 parallel exploration agents. All file paths and line numbers are current as of 2026-06-13 on `main` branch.*