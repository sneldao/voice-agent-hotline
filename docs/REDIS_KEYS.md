# Redis Key Naming Conventions

Single source of truth for all Redis keys in the VOISSS system.

## Naming rules

1. **Namespace prefix** — every key starts with a domain namespace (`agent:`, `call:`, `payment:`, etc.)
2. **Colon separator** — segments separated by `:`, never dots or slashes
3. **Entity ID** — append the entity ID after the namespace (`agent:agent_123`, `call:call_456`)
4. **Index sets** — `{namespace}_index` or `{namespace}_index:{subkey}` for collections
5. **TTL** — all ephemeral keys (sessions, rate limits, signal sessions) must have a TTL set via `setex` or `expire`
6. **No nested JSON** — store fields as hash keys, not JSON blobs (except for list/stream data)

## Key registry

### Agents

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `agent:{agentId}` | Hash | none | Agent record (name, status, rate, wallet_address, etc.) |
| `agent_index` | Set | none | Set of all agent IDs |
| `agent_index:external` | Set | none | Set of externally-registered agent IDs |
| `agents:online` | Sorted Set | none | Online agents sorted by timestamp |

### Calls

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `call:{callId}` | Hash | none | Call record (agentId, caller, status, cost, duration) |
| `call_index:all` | Set | none | Set of all call IDs |
| `call_index:{callerAddress}` | Set | none | Calls by a specific caller |

### Payments

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `payment-session:{sessionId}` | Hash | none | x402 billing session (agentId, userAddress, secondsBilled, totalCost) |
| `payment_session_index` | Set | none | Set of all payment session IDs |
| `payment-ledger:{callId}` | Hash | none | Billing ledger entry for a call |
| `payment-receipt:{callId}` | Hash | none | On-chain settlement receipt (txHash, amount, blockNumber) |
| `payment_receipt_index` | Set | none | Set of all receipt callIds |
| `split-payment:{callId}` | Hash | none | 80/20 split ledger (agentAmount, platformAmount) |
| `settlement:{callId}` | Hash | none | Settlement tracking record (txHash, from, to, amount) |
| `payouts:{agentId}` | List | none | Pending payout records for an agent |

### Rate limiting

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `ratelimit:api:{identifier}` | String (JSON) | windowMs | Generic API rate limit counter |
| `ratelimit:auth:{identifier}` | String (JSON) | 15min | Auth attempt rate limit |
| `ratelimit:sensitive:{identifier}` | String (JSON) | 1hr | Sensitive action rate limit |
| `ratelimit:ratings:read:{ip}` | String (JSON) | 1min | Ratings read rate limit |
| `ratelimit:ratings:write:{ip}` | String (JSON) | 1min | Ratings write rate limit |
| `ratelimit:register:{ip}` | String (counter) | 1hr | Agent registration rate limit |

### Users

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `user:{userId}` | Hash | none | User record |
| `user:by:address:{address}` | String | none | Lookup: wallet address → userId |
| `user:{userId}:agents` | Set | none | Agents owned by user |
| `user:{userId}:sessions` | Set | none | Sessions for user |
| `user:{userId}:delegations` | Set | none | Delegations for user |

### Sessions

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `session:{sessionId}` | Hash | none | Session record |
| `session_index:all` | Set | none | Set of all session IDs |
| `signal_session:{callId}` | Hash | 60s | WebRTC signal session (ephemeral) |

### Delegations

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `delegation:{delegationId}` | Hash | none | ERC-8004 delegation record |

### Transcripts

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `transcript:{conversationId}` | List | none | Transcript messages (capped at 200) |
| `transcript:{conversationId}` | Pub/Sub | — | Real-time transcript channel for SSE |

### Tool traces

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `trace:{callId}` | List | none | Per-call tool-execution trace (each entry a JSON `{id,label,detail,icon,status,timestamp}`; capped at 100, newest-first). Written by the ElevenLabs webhook and read by `GET /api/calls/[id]/trace` for the post-call "Trace" tab. |

### Events

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `events:list` | List | none | System event log (capped at 1000) |
| `events:summary` | Hash | none | Event counters by type |

### Agent SDK

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `apikey:{apiKey}` | String | none | API key → agentId mapping |
| `verification:{agentId}` | String | TTL | Verification token for agent registration |

## Adding a new key

1. Check this document for an existing namespace
2. Use the pattern `{namespace}:{id}` or `{namespace}_index` for collections
3. Add the key to the table above
4. Set a TTL if the key is ephemeral
5. Use `hset`/`hgetall` for structured data, not JSON strings
