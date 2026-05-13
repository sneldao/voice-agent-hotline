# Widget-First Architecture Plan

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

### Layer 1: Widget Instance (hidden, global)

A single `<elevenlabs-convai>` element lives in the layout, hidden from view. It's the actual voice engine. We control it programmatically.

```tsx
// In layout or a global provider
<elevenlabs-convai
  id="voisss-widget"
  agent-id=""           // Set dynamically before starting
  style={{ display: 'none' }}  // Hidden — our UI replaces it
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

The `ActiveCall` component keeps its current UI (duration, waveform, mute, end call). It just uses the new hook instead of the old one.

---

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| Voice engine | `Conversation.startSession()` | `<elevenlabs-convai>` widget |
| Connection management | Our code (broken) | Widget internal (works) |
| Hook | `useElevenLabsConversation` | `useWidgetConversation` (same interface) |
| Layout | No widget | Hidden widget element + script |
| ActiveCall | Uses old hook | Uses new hook (drop-in) |
| VoiceRouter | Calls `onCallAgent` | Same — just triggers the widget |

## What Stays The Same

- Agent registry and ID mapping
- Redis agent data
- DiscoverTab UI
- AgentPreviewSheet
- VoiceRouter (one-tap concierge)
- ActiveCall UI (duration, controls, transcript)
- Payment settlement
- Call history

---

## Implementation Steps

1. **Add widget script + hidden element to layout** (~5 min)
2. **Create `useWidgetConversation` hook** with same interface as old hook (~30 min)
3. **Update `ActiveCall` to use new hook** (swap import, ~5 min)
4. **Remove old `useElevenLabsConversation` hook** (cleanup)
5. **Test end-to-end** — tap agent → widget starts → voice works
6. **Remove the visible floating widget** (it was just for testing)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Widget doesn't expose enough events for our UI | Use MutationObserver on widget DOM + polling for state |
| Widget styling conflicts with our UI | Keep it `display: none` — we only use it as an audio engine |
| Widget doesn't support programmatic mute/volume | Fall back to Web Audio API on the output stream |
| Multiple simultaneous widgets needed | Only one call at a time — swap agent-id between calls |

---

## Timeline

~45 minutes total for a working implementation. The key insight is that the widget is a black box that handles the hard part (WebRTC + agent dispatch), and we just need to control it programmatically while showing our own UI.

---

## Alternative Considered: Signed URL Flow

The widget also supports `signed-url` attribute for authenticated sessions. If we need per-user auth later:

```
Backend: GET /api/get-signed-url?agentId=X → calls ElevenLabs API → returns signed URL
Frontend: widget.setAttribute('signed-url', url) → widget.startConversation()
```

This would let us track usage per wallet address. But for the hackathon demo, public agent-id is sufficient.
