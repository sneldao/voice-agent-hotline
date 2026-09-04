# Claflin Architecture

## Overview

The platform is a voice-native broker desk where:
- **Users** connect a wallet, browse brokers, and call Hetty (the first Claflin broker)
- **Brokers** are ElevenLabs Conversational AI instances with on-chain ERC-8004 identity
- **Developers** can self-register their own brokers via `/list-your-broker`

Voice transport note: the agent lifecycle below is still the correct product architecture. The voice connection uses the official `<elevenlabs-convai>` widget engine, controlled programmatically via `useWidgetConversation`. See `docs/WIDGET_ARCHITECTURE.md` for details.

---

## Agent Lifecycle

```
Developer submits via /list-your-broker
        │
        ▼
POST /api/agents  { register: true }
        │
        ▼
Redis: broker stored as status="pending"
        │
        ▼
Admin reviews → PATCH /api/agents/:id  { action: "approve" | "reject" }
        │
        ▼ (approved)
status="active" → appears in GET /api/agents
        │
        ▼
User calls broker → ElevenLabs Conversational AI session
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
  rate: number;              // per-minute rate in USDC
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

## Stats Endpoint

```
GET /api/agents/stats
```

Returns aggregate platform statistics:

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

---

## ERC-8004 On-Chain Identity

Each agent can have an on-chain identity via ERC-8004 contracts on Arbitrum. The contracts must be deployed first, then configured via environment variables:

| Registry | Env Variable | Purpose |
|---|---|---|
| Identity | `NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS` | Agent identity NFT |
| Reputation | `NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS` | Call count, ratings |
| Delegation | `NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS` | Agent-to-agent delegation |

Enable via env:
```env
NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x...
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x...
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0x...
```

Note: The ERC-8004 contracts ARE deployed on Arbitrum Sepolia (chain
421614). The addresses configured in `.env.local.example` point at
those deployed instances. The Identity and Reputation contracts are
ERC-8004 reference deployments; the Delegation Registry is this
project's `DelegationRegistry.sol` (in `contracts/`). To redeploy
the Delegation Registry, see `contracts/` and the Hardhat config that
shipped with the original deploy.

---

## Payment Flow

```
User connects wallet (MetaMask Smart Accounts Kit)
        │
        ▼
User selects agent → sees per-minute rate in USDC
        │
        ▼
Call starts → ElevenLabs Conversational AI session opens through the voice engine
        │
        ▼
Per-minute billing via x402 transferWithAuthorization (EIP-3009)
        │
        ▼
Call ends → settlement on Arbitrum via 1Shot Permissionless Relayer (gasless)
        │
        ├─► Single on-chain USDC transfer to platform wallet (Phase A)
        └─► 80/20 split ledgered in Redis for agent payout accounting
```

Revenue split is tracked in `lib/payment-settlement.ts` and
`app/api/payments/settle/route.ts`. In Phase A (current), a single
on-chain USDC transfer goes to the platform wallet; the 80/20 split is
ledgered in Redis for agent payout accounting — it is NOT an atomic
on-chain dual transfer. Atomic on-chain 80/20 split requires a
PaymentRouter contract (planned, Phase B). The agent's earnings
destination comes from the agent's `wallet_address` field in Redis.

Per-call earnings breakdown is available via `/api/agents/earnings`,
which reads the `split-payment:{callId}` ledger entries and enriches
them with settlement tx hashes. The developer dashboard surfaces this
as an expandable per-call list with trial/ledgered/settled status.

See [`ROADMAP.md`](../ROADMAP.md) for the full phase status and
opportunities under evaluation (Circle Agent Stack, Robinhood Chain).

---

## Agent-to-Agent Communication

Agent-to-agent communication is planned for future development. The ERC-8004 Delegation Registry (when deployed) will enable agents to act on behalf of users for complex multi-step tasks.

---

## Redis Data Structure

```
agent:<id>          → JSON Agent object
agents:list         → sorted set of agent IDs
call:<id>           → JSON call record
calls:agent:<id>    → list of call IDs for an agent
user:<address>      → JSON user profile
```
