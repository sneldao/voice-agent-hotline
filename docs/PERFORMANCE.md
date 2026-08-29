# Performance Notes

## Current hot spots

After the directory rewrite and live-activity ticker, the perf-sensitive
surfaces are:

1. **Marketplace directory** (`components/DiscoverTab.tsx` + `components/DirectoryRow.tsx`)
2. **Active call** (`components/ActiveCall.tsx` + the cost ticker)
3. **Live activity polling** (`components/LiveActivity.tsx` + `/api/activity/live`)

The patterns below are what the codebase actually relies on to keep
these fast.

---

## 1. Marketplace directory

### Staggered reveal

`DirectoryRow` has a `revealDelay` prop. `DiscoverTab` passes
`Math.min(idx, 8) * 70` so the first 9 rows animate in over ~600ms
and rows past 9 are not staggered (capped to prevent long delays on
large directories).

```tsx
// components/DiscoverTab.tsx
{agents.map((agent, idx) => (
  <DirectoryRow
    key={agent.id}
    agent={agent}
    revealDelay={Math.min(idx, 8) * 70}
    ...
  />
))}
```

The animation is a CSS keyframe (`@keyframes directory-row-reveal`)
that runs once on mount — no JS per frame, no `requestAnimationFrame`
loop, so a 50-row directory costs the same as a 9-row one.

### Dial code count-up

Each row's dial code counts up from 000 to the agent's deterministic
3-digit code on first mount, using `lib/useCountUp.ts`. The hook uses
a single `requestAnimationFrame` per row, 720ms duration, easeOutCubic.
For large directories this would be N concurrent RAFs — fine for the
current ~5 agents, but if the directory grows past ~20, the count-up
should be replaced with a CSS-only clip-path reveal.

`useCountUp` respects `prefers-reduced-motion` and short-circuits to
the final value if the user opts out.

### Search debouncing

`app/page.tsx` debounces search and category changes together with a
300ms timer. Without the debounce, every keystroke triggers a SWR
refetch against `/api/agents`. The debounce + `page` reset (back to 1)
are co-located in one `useEffect` to avoid split-state.

---

## 2. Active call

### Live cost ticker

`components/CostPanel.tsx` animates a progress bar and a status
message on every tick (typically once per second). The animation is
CSS-driven (`transition: width 0.4s ease, background-position 0.4s ease`),
and the status messages use `AnimatePresence mode="wait"` to crossfade
when the threshold (low / critical / empty) changes — this avoids
the FLIP-style layout shift you'd get from `v-if`-ing them in place.

The ticker never causes a re-render of `ActiveCall` itself — it's a
memoized child that receives `liveCost` as a prop.

### Transcript rendering

Transcripts come from the ElevenLabs webhook (`app/api/webhooks/elevenlabs/route.ts`)
and are streamed to the client via SWR. The `ActiveCall` component
debounces the transcript fetch to 2s so a long call doesn't hammer
the API on every transcript chunk.

---

## 3. Live activity polling

`LiveActivity` and `DiscoverTab` both poll `/api/activity/live` every
30 seconds. The endpoint is a single Redis pipeline fetch of
`call_index:all` followed by `hgetall` for each session — no
aggregation work, no sorted-set updates, no per-call write amplification.

The 30s interval is a tradeoff: shorter feels more "live" but
generates more API traffic and Redis reads. 30s is the right default
for the directory ticker; if the product grows a chatty "5 people
are calling right now" feature, the interval should drop to 10s
and the endpoint should cache for 5s at the edge.

The component **fails soft**: if the fetch errors, the ticker just
stays hidden. We never block the marketplace on the activity
endpoint.

---

## Patterns we use to keep things fast

| Pattern | Where | Why |
|---|---|---|
| `React.memo` on list items | `DirectoryRow`, `Stars`, `AgentCardSkeleton` (when used) | Prevents re-renders when a sibling row's state changes |
| `useMemo` for derived data | Directory counts, persona lookups in `lib/agent-personas.ts` | Avoids recomputing on every render |
| `useCallback` on event handlers | `onSelect`, `onVoicePreview`, `onLoadMore` | Stable references so memoized children don't re-render |
| Single-poll, multi-consumer | `LiveActivity` and `DiscoverTab` both read the same endpoint on independent intervals | Simpler than a shared SWR cache; refresh is cheap |
| `AnimatePresence mode="wait"` | Cost panel status messages, onboarding steps | Crossfade without layout shift |
| `transition` not `animation` | Directory row hover, cost bar, header wallet chip | GPU-accelerated, easier to interrupt |

---

## Patterns we explicitly avoid

- **Skeleton-card grids** — replaced with a single "switchboard warming up" placeholder (`components/Skeletons.tsx`). One moment is more memorable than five.
- **Per-frame JS animations** — count-up and stagger are CSS-driven or RAF-throttled. The only `requestAnimationFrame` in the codebase is in `useCountUp`, and it's debounced to the row's mount.
- **Real-time revalidation on tab focus** — would re-trigger the directory's 300ms-debounced search fetch every time the user tabs back. Disabled in `app/page.tsx`.
- **Long polling / WebSocket for activity** — overkill for a 30s ticker; the poll is two HTTP requests per minute per tab.

---

## Agentic UI surfaces

Two new surfaces follow the same CSS-driven performance rules as the rest
of the app; neither introduces per-frame JS:

1. **ConnectionState** (`components/ConnectionState.tsx`) — replaces bare
   spinners at the directory, tab, and agent-page loading points. Uses a
   CSS-only signal pulse (`cs-pulse-ring`, `cs-pulse-dot` keyframes) and a
   shimmering label; the live elapsed timer is a `setInterval` at 100ms
   that only touches one text node. Respects `prefers-reduced-motion`.

2. **AgentTrace** (`components/AgentTrace.tsx`) — the post-call "Trace" tab
   in `CallSummary`. Reads `GET /api/calls/[id]/trace`, which is a single
   Redis `lrange` of `trace:{callId}` (capped at 100 entries). Expand and
   collapse are `grid-template-rows` transitions; row entry uses the shared
   `fade-up` keyframe. Fails soft: no key or Redis outage returns an empty
   step list and the component renders an honest "no trace" state.

   The hook (`lib/useAgentTrace.ts`) sets `errorRetryCount: 0` and
   `dedupingInterval: 5000` so repeated opens of the summary don't hammer
   the endpoint.

Webhook instrumentation (`recordToolTrace`) is fail-soft by construction:
the trace write is wrapped in try/catch and runs after the narration is
computed, so a Redis hiccup can never delay or break the spoken reply.

---

## Monitoring

The repo doesn't ship a perf-monitoring integration. Recommended
additions when scale demands them:

- **Vercel Analytics** for web vitals on the Vercel deployment
- **A lightweight `/api/health` probe** that returns p50/p95 latency
  for the Upstash read path (would need to be added to the API
  surface, currently absent)
- **React DevTools Profiler** to find re-render hot spots during
  development
