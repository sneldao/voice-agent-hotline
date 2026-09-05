# Error Resilience & CORS Architecture

How Claflin prevents — and gracefully survives — API failures like:

```
Access to fetch at 'https://api.your-claflin-app.com/api/agents?...' from origin
'https://your-claflin-app.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root cause

The browser called the Hetzner API cross-origin. Any backend restart, nginx 502,
or TLS hiccup produced a response *without* CORS headers, so the browser masked
the real problem as a CORS error (`net::ERR_FAILED`) and the UI could only show
a dead-end "Failed to fetch".

## The three layers

### 1. Same-origin proxy (eliminates the failure class)

`API_PROXY_TARGET` is set on Vercel only. `next.config.js` adds a `beforeFiles`
rewrite so the browser calls its **own origin** at `/api/*` and the Next.js
server forwards server-to-server. No browser CORS, no preflight round-trips,
first-party cookies, and ad-blockers stop flagging API calls.

- Vercel: `API_PROXY_TARGET=https://api.your-claflin-app.com` (and unset the
  legacy `NEXT_PUBLIC_API_URL`).
- Hetzner / local dev: leave it unset — local route handlers serve directly.

### 2. Central CORS proxy (`proxy.ts`, Next.js 16 convention)

For direct cross-origin hits (embedded widgets, SDK consumers):

- Every `OPTIONS /api/*` preflight is answered at the edge with `204` +
  reflected `Access-Control-Allow-Origin` + `Max-Age: 86400` — even when the
  backend is down, so outages are never *misreported* as CORS errors.
- Every API response gets CORS headers stamped centrally, so routes can't
  forget (previously only some GET handlers called `withCors()`).
- No `Access-Control-Allow-Credentials`: auth is wallet-signature based, no
  cookies. Reflecting any Origin is therefore safe; set
  `CORS_ALLOWED_ORIGINS` to restrict.

### 3. Resilient client (`lib/api-client.ts` + `lib/useSWR.ts`)

- `apiFetch()` — 12s timeout, jittered exponential backoff, retries **only**
  idempotent GETs (never replay a POST/payment), fast-fails when offline.
- `ApiError` — typed `kind` (`offline | network | timeout | http | parse`) +
  `friendlyMessage` in the Claflin broker-desk voice. Raw
  "Failed to fetch" never reaches the UI.
- SWR keeps previous data, retries with a capped outer backoff, and exposes
  `errorKind` / `isRetrying`.

## Client recovery requirements

[Product Direction](PRODUCT_DIRECTION.md) owns the target experience. Recovery should preserve the client's work, state what did and did not happen, and offer a safe next action. The current mascot, skeleton rows, and "redial" wording below are implementation descriptions, not a requirement to preserve the operator-themed presentation.

Automatic retries here concern read-only data availability. They do not authorize restarting a microphone session, replaying a paper instruction, or retrying a payment. Delayed transcripts, unsaved instructions, and unsettled call receipts must remain distinct, truthful states. Retaining stale data is not evidence that it is current.

## Current directory-era presentation

| Situation | Current presentation |
|---|---|
| First load | Skeleton rows; after 4s, "Warming up the broker desk…" |
| Cold-start failure (no cache) | `ConnectionError`: desk bell mascot, friendly headline, "Ring again" button, visible auto-redial countdown (5s→10s→20s→30s), instant retry on `online` event |
| Failure with stale data | Broker desk stays on screen + `ReconnectingBanner` ("showing the last known lines") |
| Offline | Offline copy + automatic redial the moment connectivity returns |
| Broker page network failure | Retryable `ConnectionError` — never a false "Broker not found" |
| Page crash | `app/error.tsx`: on-theme "The line went dead" with desk bell + digest ref |

Accessibility: the failure headline/message is announced once via
`role="alert"`; the per-second countdown is `aria-hidden` (screen readers get
a static "we keep redialing" note instead of being spammed).

## Previously recorded verification

The following results were recorded before the September 5 documentation alignment; they were not rerun for this docs-only change. Revalidate them when modifying the proxy or retry implementation.

- `OPTIONS /api/agents` → 204 with full CORS headers (was: no handler).
- `GET /api/agents` returning 500 **still carries** `Access-Control-Allow-Origin`.
- Proxied responses carry exactly one `Access-Control-Allow-Origin`.
- `tests/api-client.test.ts` — 17 tests for classification, retry, backoff.
