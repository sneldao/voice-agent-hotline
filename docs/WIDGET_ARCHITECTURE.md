# Widget-First Architecture Plan

## Status

Current phase: **Widget engine implemented, pending browser verification**.

The app now uses a controlled `<elevenlabs-convai>` widget engine:
- `components/WidgetEngine.tsx` provides a global `WidgetEngineProvider` that mounts a single offscreen widget element and exposes imperative control via React context.
- `lib/useWidgetConversation.ts` is the new conversation hook — same interface as the old `useElevenLabsConversation` but drives the widget instead of the raw SDK.
- `components/ActiveCall.tsx` now uses `useWidgetConversation` instead of the legacy SDK hook.
- `app/layout.tsx` wraps the app in `<WidgetEngineProvider>` — no more hardcoded visible widget.
- The legacy `useElevenLabsConversation` hook is retained for reference/fallback but is no longer imported by ActiveCall.
- `app/widget-probe/page.tsx` and `components/WidgetProbe.tsx` remain as the internal runtime probe for verifying widget behavior.

Next phase: open `/widget-probe` in a real browser, verify which events fire, then confirm the full call flow works end-to-end through the new hook.

---

## Context

We discovered that ElevenLabs' `Conversation.startSession()` SDK method fails with "negotiation timed out" on our domain, but the official `<elevenlabs-convai>` widget works perfectly. The widget uses the same underlying infrastructure but handles WebRTC negotiation, token management, and agent dispatch internally.

**Decision:** Rebuild the voice layer around the widget instead of the raw SDK.

---

## Current State (broken)

```
User taps agent → useElevenLabsConversation hook → Conversation.startSession({ agentId })
                                                    ↓
                                              LiveKit room connects
                                              Mic track published
                                              AI agent never joins ← FAILS HERE
                                              Negotiation times out
```

## Target State (widget-first)

```
User taps agent → Widget controller sets agent-id → widget.startConversation()
                                                    ↓
                                              Widget handles everything internally
                                              AI agent joins and speaks ← WORKS
                                              Our UI observes state via widget events
```

---

## Architecture

### Layer 1: Widget Instance (global, visually suppressed)

A single `<elevenlabs-convai>` element lives in the layout/provider. It is the actual voice engine. We control it programmatically while the custom VOISSS UI remains the visible experience.

Important: do **not** assume `display: none` is safe. First prove the widget can start, capture audio, emit state, and end while visually suppressed. Prefer an offscreen or zero-opacity mounted container if the widget needs layout/audio lifecycle hooks.

```tsx
// In layout or a global provider
<elevenlabs-convai
  id="voisss-widget"
  agent-id=""           // Set dynamically before starting
  className="sr-only-widget-engine"
/>
```

### Layer 2: Widget Controller Hook

A new `useWidgetConversation` hook that:
- Finds the widget DOM element
- Sets `agent-id` attribute when starting a call
- Calls `widget.startConversation()` / `widget.endConversation()`
- Tracks duration, cost, and connection state
- Exposes the same interface as the old `useElevenLabsConversation` hook

```ts
interface WidgetConversationReturn {
  state: ConversationState;
  transcripts: TranscriptMessage[];
  isMuted: boolean;
  startConversation: () => Promise<boolean>;
  endConversation: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
}
```

### Layer 3: Agent Selection (unchanged)

The existing flow stays the same:
- User taps agent card → `handleSelectAgent` → opens preview or starts call
- VoiceRouter mic → connects to General Helper
- Agent ID mapping resolves registry keys to ElevenLabs agent IDs

### Layer 4: ActiveCall UI (unchanged)

The `ActiveCall` component keeps its new operator-console UI (duration, waveform, mute, end call). It should use the new hook instead of the old SDK hook once widget control is proven.

---

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| Voice engine | `Conversation.startSession()` | `<elevenlabs-convai>` widget |
| Connection management | Our code (broken) | Widget internal (works) |
| Hook | `useElevenLabsConversation` | `useWidgetConversation` (same interface) |
| Layout | Hardcoded visible test widget | Single controlled widget engine + script |
| ActiveCall | Uses old hook | Uses new hook after parity |
| VoiceRouter | Calls `onCallAgent` | Same — just triggers the widget |

## What Stays The Same

- Agent registry and ID mapping
- Redis agent data
- DiscoverTab UI
- AgentPreviewSheet
- VoiceRouter (one-tap concierge)
- ActiveCall UI (operator console, duration, controls, transcript)
- Payment settlement
- Call history

---

## Implementation Steps

1. **Spike widget control** — use `/widget-probe` to verify methods/events on the real custom element:
   - dynamic `agent-id` or `signed-url`
   - start conversation
   - end conversation
   - mute/unmute if exposed
   - state/connection events
   - transcript events or webhook-only transcript fallback
   - behavior when visually suppressed
2. **Record the probe results** in this document: detected methods, observed events, usable visibility mode, and transcript strategy.
3. **Replace the hardcoded layout widget** with a single controlled widget engine.
4. **Create `useWidgetConversation` hook** with the same public shape `ActiveCall` expects where possible.
5. **Update `ActiveCall` to use `useWidgetConversation`**.
6. **Decide transcript source of truth**:
   - widget events if reliable
   - ElevenLabs webhook reconciliation if widget events are incomplete
7. **Add signed-url/session metadata** if wallet-aware call history, usage tracking, or billing correlation is needed.
8. **Remove old `useElevenLabsConversation` and `/api/webrtc/signal`** only after widget parity.
9. **Test end-to-end** — tap agent → operator UI opens → widget starts → voice works → call ends → receipt/transcript persists.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Widget doesn't expose enough events for our UI | Prefer official events; use webhook reconciliation for transcripts; MutationObserver is last resort |
| Widget fails when `display: none` | Keep it mounted but visually suppressed/offscreen instead of display-none |
| Widget doesn't support programmatic mute/volume | Hide unsupported controls or fall back only if we can access media safely |
| Multiple simultaneous widgets needed | Only one call at a time — swap agent-id between calls |
| Public `agent-id` limits tracking | Move to signed-url flow with call/session metadata |

---

## Progress Log

- **2026-05-13:** Browser `SpeechRecognition` router issue identified. Direction changed to delegate voice handling to ElevenLabs.
- **2026-05-13:** Voice Router simplified to one-tap concierge launcher.
- **2026-05-13:** Switchboard UI redesign implemented across discovery, router, agent cards, header, nav, and active-call screens.
- **2026-05-13:** Internal `/widget-probe` page added to inspect the widget runtime contract before building `useWidgetConversation`.
- **2026-05-13:** Current verification passed: `npm run typecheck`, `npm test`, `npm run build`.
- **2026-05-13:** Widget engine implemented: `WidgetEngineProvider` (global controlled widget), `useWidgetConversation` hook, `ActiveCall` swapped to widget hook, hardcoded layout widget removed.

---

## Timeline Estimate

The old 45-minute estimate was too optimistic because the widget control/event contract still needs proof. Treat the next phase as:
- 30-60 minutes for the widget control spike
- 1-2 hours for `useWidgetConversation` plus `ActiveCall` swap if events are clean
- additional time if transcript, mute, or signed-url behavior needs server-side reconciliation

---

## Alternative Considered: Signed URL Flow

The widget also supports `signed-url` attribute for authenticated sessions. If we need per-user auth later:

```
Backend: GET /api/get-signed-url?agentId=X → calls ElevenLabs API → returns signed URL
Frontend: widget.setAttribute('signed-url', url) → widget.startConversation()
```

This would let us track usage per wallet address and correlate ElevenLabs conversations with VOISSS call IDs. Public `agent-id` may be enough for a demo, but signed URLs are preferred before relying on receipts, billing, or per-user analytics.
