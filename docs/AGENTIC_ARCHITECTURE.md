# Agentic Architecture

## Overview

The platform is a voice agent marketplace where:
- **Users** connect a wallet, browse agents, and pay per minute via Celo stablecoins
- **Agents** are ElevenLabs Conversational AI instances with on-chain ERC-8004 identity
- **Developers** can self-register their own agents via `/list-your-agent`
- **OpenClaw** acts as the platform's social agent, posting updates and milestones

Voice transport note: the agent lifecycle below is still the correct product architecture. The voice connection uses the official `<elevenlabs-convai>` widget engine, controlled programmatically via `useWidgetConversation`. See `docs/WIDGET_ARCHITECTURE.md` for details.

---

## Agent Lifecycle

```
Developer submits via /list-your-agent
        │
        ▼
POST /api/agents  { register: true }
        │
        ▼
Redis: agent stored as status="pending"
        │
        ▼
Admin reviews → PATCH /api/agents/:id  { action: "approve" | "reject" }
        │
        ▼ (approved)
status="active" → appears in GET /api/agents
        │
        ▼
User calls agent → ElevenLabs Conversational AI session
        │
        ├─ Controlled via `<elevenlabs-convai>` widget engine (implemented)
        └─ `useWidgetConversation` hook drives shadow DOM button + signed URLs
        │
        ▼
Call ends → POST /api/webhooks/elevenlabs
        │
        ├─► Redis: increment call count, store rating
        └─► ERC-8004 Reputation Registry updated on-chain
```

---

## Agent Data Model

```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  specialty?: string;
  rate: number;              // per-minute rate in cUSD
  avatar: string;            // emoji
  active: boolean;
  status: 'active' | 'pending' | 'rejected';
  elevenlabs_agent_id?: string;
  wallet_address?: string;   // developer earnings destination
  erc8004_id?: string;       // on-chain identity token
  totalCalls: number;
  rating: number;
  online: boolean;
}
```

---

## API Reference

### Agent CRUD

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/agents` | Public | List all active agents |
| POST | `/api/agents` | Admin or developer | Create (admin) or register (`register: true`) |
| GET | `/api/agents/:id` | Public | Get single agent |
| PATCH | `/api/agents/:id` | Admin | Approve or reject pending agent |
| DELETE | `/api/agents/:id` | Admin | Remove agent |
| POST | `/api/agents/seed` | Admin | Seed default agents into Redis |

### Self-Registration

```bash
POST /api/agents
Content-Type: application/json

{
  "name": "My Agent",
  "description": "What this agent does",
  "category": "finance",
  "rate": 0.10,
  "elevenlabs_agent_id": "agent_abc123",
  "wallet_address": "0x...",
  "register": true
}
```

Response: `{ "message": "Registration submitted for review", "agent": { ... } }`

### Admin Approval

```bash
PATCH /api/agents/:id
Content-Type: application/json

{ "action": "approve" }   # or "reject"
```

---

## OpenClaw Integration

OpenClaw is the platform's social agent — it posts updates, milestones, and style tips on Twitter/X and Farcaster.

### Stats Endpoint

```
GET /api/agents/stats
```

Returns aggregate data for OpenClaw to use in weekly posts:

```json
{
  "summary": {
    "totalAgents": 4,
    "totalCalls": 127,
    "avgRating": 4.2,
    "topAgent": { "name": "Code Reviewer", "totalCalls": 54 }
  },
  "agents": [ ... ]
}
```

### Webhook Endpoint

```
POST /api/openclaw/webhook
x-openclaw-secret: <OPENCLAW_WEBHOOK_SECRET>
Content-Type: application/json
```

Supported event types:

#### `call.completed`
Increments call count in Redis and returns a draft social post.

```json
{
  "event": "call.completed",
  "agentId": "agent_abc123",
  "duration": 240,
  "userId": "0x..."
}
```

#### `agent.milestone`
Returns a milestone celebration draft.

```json
{
  "event": "agent.milestone",
  "agentId": "agent_abc123",
  "milestone": "100 calls"
}
```

#### `social.draft`
Returns platform-specific content drafts for a given topic.

```json
{
  "event": "social.draft",
  "topic": "weekly-stats"
}
```

Available topics: `weekly-stats`, `new-agent`, `erc8004`, `how-it-works`

### Security

Set `OPENCLAW_WEBHOOK_SECRET` in your environment. The webhook validates the `x-openclaw-secret` header on every request. If the secret is unset, validation is skipped (development only).

---

## ERC-8004 On-Chain Identity

Each agent has an on-chain identity via the ERC-8004 contracts deployed on Celo Sepolia:

| Registry | Address | Purpose |
|---|---|---|
| Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | Agent identity NFT |
| Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | Call count, ratings |
| Delegation | `0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00` | Agent-to-agent delegation |

Enable via env:
```env
NEXT_PUBLIC_ERC8004_ENABLED=true
```

---

## Payment Flow

```
User connects wallet (Web3Modal + WalletConnect)
        │
        ▼
User selects agent → sees per-minute rate in cUSD
        │
        ▼
Call starts → ElevenLabs Conversational AI session opens through the voice engine
        │
        ▼
Per-minute billing via Yellow Network state channels
        │
        ▼
Call ends → final settlement on Celo
        │
        ├─► Platform fee (20%) → PAYMENT_RECEIVER
        └─► Agent earnings (80%) → agent.wallet_address (roadmap)
```

Current state: all payments route to `PAYMENT_RECEIVER`. Per-agent earnings split is on the roadmap.

---

## Agent-to-Agent Communication

The `AgentToAgentChat` component enables agents to communicate with each other for complex multi-step tasks. This uses the ERC-8004 Delegation Registry to verify that one agent has permission to act on behalf of another.

---

## Redis Data Structure

```
agent:<id>          → JSON Agent object
agents:list         → sorted set of agent IDs
call:<id>           → JSON call record
calls:agent:<id>    → list of call IDs for an agent
user:<address>      → JSON user profile
```
