# Types Assessment — VOISSS Codebase

## Summary

The codebase has **severe type fragmentation**. The same types are defined 2–4 times across different files, with subtle inconsistencies that create confusion and potential runtime bugs. There are 3 dedicated type files (`lib/types.ts`, `lib/core/types.ts`, `lib/voice/types.ts`) plus dozens of inline redefinitions.

---

## CRITICAL: Exact Duplicates

### 1. `lib/types.ts` ↔ `lib/core/types.ts` — FULL DUPLICATE

`lib/core/types.ts` is a **copy-paste superset** of `lib/types.ts`. Every type in `lib/types.ts` exists identically in `lib/core/types.ts`, which also adds skill/delegation types plus a `UtilityFlowService` class and helper functions.

**Duplicated types (identical):**
- `AgentStatus`
- `Agent`
- `CallSession`
- `PaymentState`
- `Feedback`
- `AgentSubmission`
- `AgentRegistration`
- `ReputationScore`
- `PaymentRequirements`
- `PaymentAuthorization`

**Action:** Delete `lib/types.ts`, make `lib/core/types.ts` the canonical source. Update 6 import sites.

### 2. `EIP712Signature` + `SignedAuthorization` + `SettlementResult` — 4× DUPLICATE

Defined identically in:
- `lib/payment-settlement.ts`
- `lib/payment-settlement-serverless.ts`
- `lib/payment-client-submitted.ts`
- `lib/payment-relayer.ts`

**Action:** Extract to `lib/core/types.ts`, import in all 4 files.

### 3. `SkillType` — 4× DUPLICATE

Defined as `'book' | 'order' | 'schedule' | 'research'` in:
- `lib/types.ts` (missing, but in core/types)
- `lib/core/types.ts`
- `lib/agent-registry.ts`
- `lib/agent-skills.ts`
- `lib/utility-flows.ts`

**Action:** Single definition in `lib/core/types.ts`.

---

## HIGH: Overlapping Types with Inconsistencies

### 4. `Agent` — 5 different definitions

| File | Key differences |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | Canonical: `id, name, specialty, bio, rating, calls, rate, avatar, color, online` + optional fields |
| `lib/validation.ts` | Zod-inferred, different shape: `totalRatings` required, no `calls`, no `bio` |
| `lib/db.ts` | DB-specific: `owner, type, specialty[]`, `ratePerMinute`, `status: 'online'|'offline'|'busy'` |
| `app/marketplace/page.tsx` | UI-specific: `address, description, voiceId, capabilities[], ratePerMinute, ratingsCount, callsCompleted` |
| `app/admin/page.tsx` | Admin-specific: all optional strings, `submitted_at, approved_at, rejected_at` |

**Assessment:** The `lib/db.ts` and page-level types serve different purposes (DB schema vs API response vs UI display). The canonical `Agent` in `lib/core/types.ts` should remain the shared type. Page-level types are acceptable as local view models. `lib/db.ts` types are internal to the DB layer.

**Action:** No merge needed for page-level types (they're view models). But `lib/validation.ts`'s `Agent` should be renamed to `AgentValidation` or the schema should validate against the canonical `Agent`.

### 5. `CallSession` — 4 different definitions

| File | Shape |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | `id, agentId, userWallet, startTime: Date, duration, cost, paid` |
| `lib/payments/x402.ts` | `id, agentId, userAddress, ratePerMinute, maxAuthorized, authorization, startTime, secondsBilled, totalCost, status` |
| `lib/webrtc-voice.ts` | `id, agentId, userId, peerConnection, localStream, remoteStream, dataChannel, state, startTime, metrics` |
| `lib/db.ts` | `id, agentId, userId, status, duration, cost, rating, feedback, createdAt, endedAt` |

**Assessment:** These represent genuinely different concerns (core model vs payment session vs WebRTC session vs DB record). They should have distinct names.

**Action:** Rename to `CallSession` (core), `PaymentCallSession` (payments/x402), `WebRTCCallSession` (webrtc-voice), keep `lib/db.ts` internal.

### 6. `PaymentState` — 2 different definitions

| File | Shape |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | `status: 'free'|'pending'|'active'|'completed', balance, perMinuteRate, freeMinutes, minutesUsed` |
| `lib/useRealPayment.ts` | `isProcessing, isSettled, isSimulated, mode, txHash, error, explorerUrl` |

**Assessment:** Completely different concerns. The hook's `PaymentState` is UI state, the core one is billing state.

**Action:** Rename `useRealPayment.ts`'s to `PaymentSettlementState`.

### 7. `PaymentAuthorization` — 3 different definitions

| File | Shape |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | `from, to, value, validAfter, validBefore, nonce, signature` (all strings) |
| `lib/payment-settlement.ts` | `from: Address, to: Address, value: bigint, ...nonce: 0x${string}` (typed) |
| `lib/payments/x402.ts` | `sessionId, authorizedAmount: number, expiresAt: Date` |

**Assessment:** The `lib/types.ts` version is a simplified string-based version. The `payment-settlement.ts` version is the real on-chain type. The `payments/x402.ts` version is a session-level authorization.

**Action:** Keep `payment-settlement.ts` as `EIP3009Authorization`, rename `payments/x402.ts` to `SessionAuthorization`, remove from `lib/types.ts`.

### 8. `AgentRegistration` — 3 different definitions

| File | Shape |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | `tokenId: bigint, owner, agentURI, timestamp: bigint` |
| `lib/erc8004.ts` | Same + `isVerified, ratePerMinute: bigint, specialties: string[]` |
| `lib/validation.ts` | Zod schema: `name, specialty, bio, rate, tags, voiceId, metadata` (registration form, not on-chain) |

**Action:** Keep `lib/erc8004.ts` as `ERC8004AgentRegistration`, rename `lib/validation.ts` to `AgentRegistrationForm`, remove from `lib/types.ts`.

### 9. `DelegationScope` — 3 different definitions

| File | Shape |
|---|---|
| `lib/core/types.ts` | `canBook, canOrder, canSchedule, canResearch, maxSpend?: number` |
| `lib/erc8004.ts` | Same + `maxSpend: bigint, expiresAt: bigint` |
| `components/DelegationPanel.tsx` | Same + `maxSpendUSD: number, expiresInDays: number` |

**Action:** Keep `lib/erc8004.ts` as the on-chain type, `lib/core/types.ts` as the app-level type, component type is a UI view model (acceptable).

### 10. `AgentPersonality` — 2 different definitions

| File | Shape |
|---|---|
| `lib/voice/types.ts` | `id, name, voiceId, systemPrompt, traits[]` |
| `lib/agent-voice.ts` | `id, name, specialty, rating, pricePerMinute, avatar, voiceId, speakingStyle, pace, toneModifier` |

**Action:** Rename `lib/agent-voice.ts` to `AgentVoiceProfile`.

### 11. `Rating` / `AgentRating` — 2× duplicate

| File | Shape |
|---|---|
| `lib/ratings.ts` | `Rating` with `verified, weighting`; `AgentRating` with `weightedRating, verifiedRatings` |
| `components/RatingStars.tsx` | Simplified `Rating` and `AgentRating` without verification fields |

**Action:** Component should import from `lib/ratings.ts`.

### 12. `ReputationScore` — 2 different definitions

| File | Shape |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | `agentId: bigint, average, total, distribution: {5,4,3,2,1}` |
| `lib/reputation-staking.ts` | `agentId: bigint, average, total, distribution, trend, lastUpdated, stakeWeight` |

**Action:** Keep both — the staking version extends the base. Could use `extends`.

### 13. `PaymentRequirements` — 2 different definitions

| File | Shape |
|---|---|
| `lib/types.ts` / `lib/core/types.ts` | Generic: `scheme, network, maxAmountRequired, payTo, asset, description, mimeType` |
| `lib/x402.ts` | Same shape but `network: 'celo'` literal |

**Action:** Consolidate into `lib/core/types.ts`.

---

## MEDIUM: Missing Type (`DelegationOption`)

`DelegationOption` is used in `lib/core/types.ts` and `lib/utility-flows.ts` but **never defined as an interface**. This is a compile error waiting to happen.

**Action:** Define `DelegationOption` interface in `lib/core/types.ts`.

---

## LOW: Acceptable Local Types

These are component-specific props/state types that don't need consolidation:
- All `*Props` interfaces in `components/`
- `PageState`, `PageAction` in `app/page.tsx`
- `AgentStat`, `PayoutRecord`, `StatsSummary` in `app/dashboard/page.tsx`
- `UserStats`, `CallRecord`, `ReputationData` in `app/profile/page.tsx`
- Webhook payload types in `app/api/openclaw/webhook/route.ts`
- `CircuitState`, `CircuitBreakerConfig` in `lib/circuit-breaker.ts`
- `CacheEntry`, `CacheConfig` in `lib/cache.ts`

---

## Consolidation Plan

### Phase 1: HIGH CONFIDENCE (implement now)
1. Delete `lib/types.ts` → update 6 imports to `lib/core/types.ts`
2. Extract `EIP712Signature`, `SignedAuthorization`, `SettlementResult` to `lib/core/types.ts`
3. Remove duplicate `SkillType` from `agent-registry.ts`, `agent-skills.ts`, `utility-flows.ts`
4. Define missing `DelegationOption` interface
5. Rename conflicting `PaymentState` in `useRealPayment.ts`
6. Rename conflicting `CallSession` in `webrtc-voice.ts` and `payments/x402.ts`
7. Rename conflicting `AgentPersonality` in `agent-voice.ts`
8. Remove duplicate `PaymentRequirements` from `lib/x402.ts` (import from core)
9. Remove duplicate `PaymentAuthorization` from `lib/types.ts`/`lib/core/types.ts` (the string-based version)

### Phase 2: LOWER CONFIDENCE (future)
- Align `lib/validation.ts` Agent schema with canonical Agent type
- Consider `extends` patterns for `ReputationScore` variants
- Evaluate whether `lib/db.ts` types should reference canonical types
