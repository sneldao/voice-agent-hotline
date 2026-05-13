# 🎙️ VOISSS — Voice Agent Hotline

**A hands-free AI agent marketplace you can use without ever touching a keyboard.**

VOISSS lets you browse, discover, and have live voice conversations with specialized AI agents — entirely by speaking. Built with [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai) for natural voice interaction and [Cursor](https://cursor.sh) as the AI-first development environment.

Current build status: the product UI has been redesigned as an immersive classic phone-operator switchboard. The next engineering phase is replacing the temporary SDK call path with a controlled ElevenLabs widget engine.

**Live Demo:** [voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)  
**Repo:** [github.com/sneldao/voice-agent-hotline](https://github.com/sneldao/voice-agent-hotline)

---

## The Idea

What if you could call an AI expert the same way you'd call a friend — just tap and talk? No typing, no prompts, no keyboard required.

VOISSS is a voice-first marketplace where each agent is a specialist: a doctor, a web researcher, a code reviewer, a travel planner. You speak naturally, they respond in real-time with ElevenLabs' ultra-low-latency voice AI. During the conversation, agents can take actions on your behalf — search the web, look up blockchain data, book appointments — all triggered by your voice.

---

## Hands-Free Experience

Every interaction in VOISSS is designed for zero keyboard input:

- **Browse agents** → tap to select (mobile-first UI, large touch targets)
- **Start a call** → one tap, then pure voice conversation
- **Agent actions** → speak your request, the agent executes tools mid-conversation
- **End call** → tap the hang-up button, get a spoken summary
- **Rate & review** → tap stars, no text required

The entire flow from discovery to conversation to payment works without typing a single character.

---

## ElevenLabs Integration

VOISSS uses ElevenLabs across the full stack:

| Feature | ElevenLabs API |
|---------|---------------|
| Real-time voice conversations | [Conversational AI](https://elevenlabs.io/docs/conversational-ai) |
| Agent voices | Pre-made + custom voice IDs per agent |
| Speech-to-Text (input) | Built into ConvAI — user speaks, agent understands |
| Text-to-Speech (output) | Built into ConvAI — agent responds with natural voice |
| Tool execution during calls | Webhook-based tool calls (search, book, research) |
| Conversation transcripts | Widget events or webhook reconciliation, pending widget-control spike |

### Current State

- The visible product now uses a switchboard-style UI: operator console, rotary call control, line lamps, patch-cord accents, agent line cards, and an analog in-call console.
- `VoiceRouter` no longer uses browser `SpeechRecognition`; tapping it starts the General Helper concierge line.
- `ActiveCall` still uses the legacy `useElevenLabsConversation` SDK hook while the widget controller is being built.
- The old SDK hook has a temporary `connectionType: 'webrtc'` compatibility patch so the app continues to typecheck.

### How It Works

Target widget-first flow:

```
User speaks → ElevenLabs STT → LLM processes → Tool call (if needed) → ElevenLabs TTS → User hears response
```

1. User taps "Call" on an agent (or taps the Voice Router mic)
2. App sets the `agent-id` or `signed-url` on the ElevenLabs widget and starts the conversation
3. Widget handles WebRTC connection, negotiation, and agent dispatch internally
4. User speaks naturally — ElevenLabs handles ASR, turn-taking, and TTS
5. When the agent needs to take action (web search, booking, etc.), it triggers a webhook
6. Our server executes the tool and returns a narration string
7. ElevenLabs speaks the result back to the user
8. Full transcript is captured and saved

### Key Files

- `components/VoiceRouter.tsx` — One-tap AI concierge launcher
- `components/ActiveCall.tsx` — Custom operator-style call UI; currently still backed by the legacy SDK hook
- `app/widget-probe/page.tsx` — Internal widget-control spike page
- `components/WidgetProbe.tsx` — Runtime introspection UI for the `<elevenlabs-convai>` element
- `components/ElevenLabsWidget.tsx` — Early widget wrapper/test component
- `lib/useElevenLabsConversation.ts` — Temporary SDK hook until widget parity is implemented
- `lib/useWidgetConversation.ts` — Planned hook controlling the widget engine
- `lib/agent-registry.ts` — Canonical registry mapping agents to ElevenLabs IDs + voice configs
- `app/api/webhooks/elevenlabs/route.ts` — Webhook handler for mid-conversation tool execution
- `docs/WIDGET_ARCHITECTURE.md` — Full architecture documentation

### Why the Widget?

We use the official `<elevenlabs-convai>` widget rather than the raw `@elevenlabs/client` SDK because:
- The widget reliably handles WebRTC negotiation and AI agent dispatch
- It's the same connection path used by the ElevenLabs dashboard (proven to work)
- It manages audio devices, reconnection, and error recovery internally
- Our app can control it programmatically while showing its own custom switchboard UI

### Next Voice Plumbing Steps

1. Prove widget imperative control on the real custom element.
2. Record `/widget-probe` results: methods, events, visibility mode, transcript path.
3. Replace the hardcoded visible widget with one controlled widget engine.
4. Build `useWidgetConversation`.
5. Swap `ActiveCall` from `useElevenLabsConversation` to `useWidgetConversation`.
6. Use signed URLs/session metadata if wallet-aware receipts or billing correlation require it.

---

## Built with Cursor

This entire project was developed using Cursor's AI-powered coding features:

- **AI-assisted architecture** — Cursor helped design the 4-layer agent architecture (Voice → Orchestration → Execution → Settlement)
- **Code generation** — Components, API routes, and integrations written with Cursor's AI assistance
- **Debugging** — Real-time error resolution during ElevenLabs SDK integration
- **Refactoring** — Large-scale refactors (WebRTC migration, payment system) guided by Cursor

---

## Available Voice Agents

| Agent | Voice | Specialty |
|-------|-------|-----------|
| **Dr. Maya** ⚕️ | Sarah | Evidence-based health information with safety protocols |
| **Web Researcher** 🔍 | Steve | Real-time web search & content extraction via Firecrawl |
| **Solana Sage** 🔮 | Josh | Blockchain analytics, wallet balances, transaction lookups |
| **Code Reviewer** 👨‍💻 | Antoni | GitHub operations, code reviews, architecture advice |
| **General Helper** 🤖 | Adam | Booking, ordering, scheduling — your AI concierge |
| **Tour Master** 🌍 | Rachel | Travel planning, destination research, price comparison |

Each agent has a unique ElevenLabs voice, custom system prompt, and set of tools it can invoke during conversation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Voice AI | **ElevenLabs Conversational AI**; widget-first refactor in progress |
| LLM | GPT-4 (via ElevenLabs ConvAI) |
| Tools | Firecrawl (web search/scrape), Composio (GitHub, Solana) |
| Payments | Celo stablecoins (cUSD), Superfluid streaming |
| Identity | ERC-8004 on-chain agent registry (Celo Sepolia) |
| Storage | Upstash Redis |
| Wallet | Web3Modal + WalletConnect |
| Hosting | Vercel + Hetzner VPS |

---

## Quick Start

```bash
git clone https://github.com/sneldao/voice-agent-hotline.git
cd voice-agent-hotline
npm install
cp .env.local.example .env.local
# Add your ELEVENLABS_API_KEY and other keys
npm run dev
```

Then seed agents:
```bash
curl -X POST http://localhost:3000/api/agents/seed
```

Open `http://localhost:3000`, tap any agent to start a voice call. No wallet required.

---

## Routes

| Path | Purpose |
|------|---------|
| `/` | Main app — Discover agents, make calls, view history, profile (tabbed SPA) |
| `/list-your-agent` | Developer self-registration form for listing ElevenLabs agents |
| `/dashboard` | Agent owner analytics (call counts, revenue, ratings) |
| `/admin` | Platform admin panel (approve/reject agents, manage users) |
| `/widget-probe` | Internal ElevenLabs widget-control spike page |
| `/marketplace` | Redirects to `/` (legacy) |
| `/profile` | Redirects to `/` (consolidated into main app tabs) |
| `/demo` | Redirects to `/` (legacy) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VOISSS Architecture                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: VOICE (ElevenLabs)                            │
│  ├── ConvAI WebRTC sessions                             │
│  ├── Per-agent voice IDs                                │
│  └── Real-time STT + TTS                                │
│                                                          │
│  Layer 2: ORCHESTRATION (Webhook)                       │
│  ├── Tool routing (search, book, research)              │
│  ├── Agent skill guards                                 │
│  └── Delegation verification (ERC-8004)                 │
│                                                          │
│  Layer 3: EXECUTION (Skills Framework)                  │
│  ├── Firecrawl (web research)                           │
│  ├── Composio (GitHub, Solana)                          │
│  └── Native skills (booking, scheduling)                │
│                                                          │
│  Layer 4: SETTLEMENT (Celo)                             │
│  ├── Per-second stablecoin billing                      │
│  ├── On-chain reputation (ERC-8004)                     │
│  └── Agent payout splits                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Use Cases (Hands-Free Scenarios)

- **Cooking** — Ask Dr. Maya about nutrition while your hands are covered in flour
- **Driving** — Have Tour Master plan your road trip route by voice
- **Coding** — Get a code review read aloud while you're sketching on a whiteboard
- **Accessibility** — Full app functionality for users who cannot use a keyboard
- **Walking** — Research anything on the go with Web Researcher

---

## Demo Video Script Ideas

For the viral-style video submission:

1. **Hook** (0-3s): "I built an app you never have to type in."
2. **Problem** (3-8s): Show someone frustrated typing long prompts to AI
3. **Solution** (8-30s): Open VOISSS → tap agent → have a natural conversation
4. **Wow moment** (30-45s): Agent searches the web mid-conversation and reads results back
5. **Payoff** (45-60s): Show the transcript, the on-chain payment receipt, the rating — all done without a keyboard

---

## Social Media

When posting about VOISSS:
- Tag **@cursor_ai** and **@elevenlabsio**
- Use hashtag **#ElevenHacks**
- Demo link: [voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)

---

## Environment Variables

See `.env.local.example` for the full list. Key ones:

```env
# Required
ELEVENLABS_API_KEY=your_key
ELEVENLABS_CONVERSATIONAL_ENABLED=true
UPSTASH_REDIS_REST_URL=your_url
UPSTASH_REDIS_REST_TOKEN=your_token
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id

# Agent IDs (generated by seed script)
ELEVENLABS_AGENT_SOLANA_SAGE=
ELEVENLABS_AGENT_CODE_REVIEWER=
ELEVENLABS_AGENT_GENERAL_HELPER=
ELEVENLABS_AGENT_TOUR_MASTER=
ELEVENLABS_AGENT_WEB_RESEARCHER=
ELEVENLABS_AGENT_MEDICAL_ADVISOR=
```

---

## License

MIT

---

Built with [Cursor](https://cursor.sh) + [ElevenLabs](https://elevenlabs.io) for the #ElevenHacks challenge.
