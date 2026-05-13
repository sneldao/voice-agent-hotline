# Documentation

## Guides

| Document | Purpose |
|----------|---------|
| [Widget Architecture](./WIDGET_ARCHITECTURE.md) | Voice layer design — widget-first approach |
| [Agentic Architecture](./AGENTIC_ARCHITECTURE.md) | Agent lifecycle, tools, ERC-8004 identity |
| [Deployment](./DEPLOYMENT.md) | Vercel deployment, env vars, troubleshooting |
| [Hetzner VPS](./HETZNER_DEPLOYMENT.md) | Standalone PM2 server setup, Nginx, automation |
| [Security](./SECURITY_ARCHITECTURE_COMPARISON.md) | User-settled payments, no server keys |
| [Performance](./PERFORMANCE.md) | React optimizations, memory, memoization |
| [Superfluid](./SUPERFLUID_INTEGRATION.md) | Streaming payments with viem |

## Hackathon

| Document | Purpose |
|----------|---------|
| [ElevenHacks Submission](./submission/ELEVENHACKS.md) | Video scripts, social templates, scoring strategy |
| [Submission Index](./submission/README.md) | Active + past hackathon submissions |

## Key Decisions

- **Widget over SDK:** The ElevenLabs `<elevenlabs-convai>` widget handles WebRTC negotiation reliably where the raw `@elevenlabs/client` SDK's `Conversation.startSession()` fails with negotiation timeouts. See [WIDGET_ARCHITECTURE.md](./WIDGET_ARCHITECTURE.md).
- **Registry as source of truth:** All agent configuration lives in `lib/agent-registry.ts`. Redis is a cache seeded from the registry. ElevenLabs agents are never created programmatically.
- **Demo mode:** `NEXT_PUBLIC_DEMO_MODE=true` skips wallet requirements for the hackathon video.

See the root [README](../README.md) for project overview, features, and quick start.
