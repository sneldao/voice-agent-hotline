# Agentic Architecture - No Private Keys on Servers

## Overview

This document describes the new intent-based, agentic architecture that eliminates the need for private keys on servers while maintaining full functionality and security.

## Core Principles

1. **No Server Private Keys** - Servers never hold keys that can spend user funds
2. **User Sovereignty** - Users maintain full control through their smart contract wallets
3. **Intent-Based Execution** - Users express WHAT they want, agents figure out HOW
4. **Session Keys** - Temporary, limited-scope keys for seamless UX
5. **Cloud Agents in TEEs** - Secure enclaves for sensitive operations

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. USER LAYER                                                           │
│    - MetaMask, Rainbow, Coinbase Wallet                                 │
│    - Smart Contract Wallet (ERC-4337)                                   │
│    - Session key generation (in wallet)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. INTENT LAYER (OpenClaw-style)                                        │
│    - Natural language parsing                                           │
│    - Intent validation & simulation                                     │
│    - Risk assessment                                                    │
│    - Execution planning                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. CLOUD AGENT LAYER (TEE - Trusted Execution Environment)              │
│    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│    │  Payment    │ │    Voice    │ │ Reputation  │ │  Dispute    │     │
│    │    Agent    │ │    Agent    │ │    Agent    │ │    Agent    │     │
│    │             │ │             │ │             │ │             │     │
│    │ • Validates │ │ • Manages   │ │ • Tracks    │ │ • Arbitrates│     │
│    │   intents   │ │   WebRTC    │ │   scores    │ │ • NO KEYS   │     │
│    │ • Creates   │ │ • Streams   │ │ • Verifies  │ │             │     │
│    │   UserOps   │ │   audio     │ │   creds     │ │             │     │
│    │ • NO KEYS   │ │ • NO KEYS   │ │ • NO KEYS   │ │             │     │
│    └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                                          │
│    AWS Nitro Enclaves / Intel SGX / ARM TrustZone                       │
│    - Attestation proves code integrity                                  │
│    - Memory encrypted, no debug access                                  │
│    - Even platform operators can't extract keys                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. SMART CONTRACT LAYER (Celo)                                          │
│    ┌─────────────────────────────────────────────────────────────┐      │
│    │  AgentSmartWallet (ERC-4337)                                 │      │
│    │  - User is owner (EOA controls)                              │      │
│    │  - Session keys authorized for limited scope                 │      │
│    │  - Cloud agents submit UserOperations, don't sign them       │      │
│    │  - User can revoke instantly                                 │      │
│    └─────────────────────────────────────────────────────────────┘      │
│                                                                          │
│    ┌─────────────────────────────────────────────────────────────┐      │
│    │  EntryPoint (ERC-4337 Bundler)                               │      │
│    │  - Validates UserOperations                                  │      │
│    │  - Executes on-chain                                         │      │
│    └─────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Smart Contract Wallet (`AgentSmartWallet.sol`)

```solidity
// User's funds live here, controlled by their EOA
contract AgentSmartWallet is BaseAccount {
    address public owner;                    // User's EOA
    mapping(address => SessionKey) public sessionKeys;
    
    struct SessionKey {
        bool authorized;
        uint256 expiry;
        uint256 maxAmount;
        uint256 spentAmount;
        address[] allowedAgents;
        bool revoked;
    }
    
    // Only session key can call, with strict limits
    function settlePayment(
        address agent,
        uint256 amount,
        bytes32 callId,
        address token
    ) external onlySessionKey(msg.sender) {
        // Enforces: agent allowed, amount within limit, not expired
        // Transfers tokens from wallet to agent
    }
    
    // Instant revoke by owner
    function revokeSessionKey(address sessionKey) external onlyOwner {
        sessionKeys[sessionKey].revoked = true;
    }
}
```

### 2. Session Keys (Not Master Keys!)

```typescript
// User generates this in their wallet
interface SessionKey {
  publicKey: Address;           // 0xabc...
  privateKey: never;            // NEVER leaves user's wallet!
  expiresAt: number;            // Auto-expires
  maxAmount: bigint;            // Can only spend $5
  allowedAgents: string[];      // Only specific agents
  allowedMethods: string[];     // Only "settlePayment"
}

// User authorizes session key in their smart wallet
// Cloud agent gets the public key only
// Cloud agent creates UserOperations
// User (or session key) signs them
// Cloud agent submits to bundler - NEVER signs!
```

### 3. Intent-Based Execution

```typescript
// OLD: User signs raw transaction
// "Sign this 0x1234... data"

// NEW: User expresses intent
// "I want to call Agent X for 5 minutes, max $0.50"

interface Intent {
  action: 'start_call';
  constraints: {
    maxAmount: 500000000000000000n,  // $0.50
    maxDuration: 300,                 // 5 min
    agentId: 'agent_2101khgsy8aqfxv8yr3r9548bqrx',
  };
  expiry: Date.now() + 300000,        // 5 min
}

// Cloud agent figures out HOW:
// 1. Create session key authorization
// 2. Initiate WebRTC connection
// 3. Start payment stream
// 4. Monitor call
// 5. Settle exact usage on end
```

### 4. Cloud Agents in TEEs

```typescript
// AWS Nitro Enclave Example
interface CloudAgent {
  id: string;
  type: 'payment' | 'voice' | 'reputation';
  enclavePublicKey: Address;
  attestationDocument: string;  // Signed by AWS
}

// Attestation proves:
// 1. Running genuine AWS Nitro
// 2. Code hash matches expected
// 3. No debugger attached
// 4. Memory encrypted

// User verifies attestation before trusting agent
// Even platform operators can't extract keys from enclave
```

## Execution Flow

### Starting a Call

```
1. User: "Call Solana Sage for 5 min, max $0.50"
   ↓
2. Intent Parser: Creates structured intent
   ↓
3. Intent Validator: 
   - Checks agent exists and is active
   - Simulates execution
   - Assesses risk (low/medium/high)
   ↓
4. User reviews in wallet:
   - "Authorize session key for Agent X"
   - "Max $0.50, expires in 1 hour"
   - User signs
   ↓
5. Smart Contract:
   - Stores session key authorization
   - Sets spending limit
   - Sets expiry
   ↓
6. Cloud Agent (TEE):
   - Creates WebRTC connection
   - Monitors call
   - Tracks usage
   - NO PRIVATE KEY NEEDED
   ↓
7. During Call:
   - Streaming payment authorized
   - Session key can settle up to $0.50
   - User can revoke instantly
   ↓
8. End Call:
   - Cloud agent calculates exact usage: $0.32
   - Creates UserOperation to settle $0.32
   - Session key signs (in TEE, can't be extracted)
   - Submits to EntryPoint
   - Refund $0.18 automatically
```

### Security Properties

| Threat | Mitigation |
|--------|------------|
| Server compromised | No private keys on server, can't steal funds |
| Cloud agent hacked | Runs in TEE, attestation required, keys encrypted |
| Session key leaked | Limited scope ($5 max, 1 hour, specific agents) |
| Malicious agent | User reviews intent, can revoke instantly |
| Platform operator | Can't extract keys from TEE, user controls wallet |
| Smart contract bug | Upgradeable, emergency withdraw, audits |

## API Examples

### Parse Intent

```bash
POST /api/intents
{
  "input": "Call sage for 5 min with max $0.50",
  "user": "0x123..."
}

Response:
{
  "intent": {
    "action": "start_call",
    "constraints": {
      "maxAmount": "500000000000000000",
      "maxDuration": 300,
      "agentId": "agent_2101khgsy8aqfxv8yr3r9548bqrx"
    },
    "risk": "low",
    "warnings": []
  },
  "plan": {
    "steps": 3,
    "totalEstimatedCost": "500000000000000000"
  }
}
```

### Execute Intent (User Signs)

```bash
PUT /api/intents
{
  "intent": { ... },
  "userSignature": "0xabc..."  // User signs in wallet
}

Response:
{
  "success": true,
  "txHashes": ["0xdef..."],
  "sessionKey": "0x789...",  // For this call only
  "expiresAt": 1234567890
}
```

### Cloud Agent Heartbeat (TEE Attestation)

```bash
POST /api/agents/heartbeat
{
  "agentId": "cloud_payment_1",
  "attestationDocument": "eyJ...",  // AWS Nitro attestation
  "capabilities": ["payment", "streaming"],
  "metrics": {
    "activeCalls": 5,
    "totalSettled": "12500000000000000000"
  }
}
```

## Comparison: Old vs New

| Aspect | Old Architecture | New Architecture |
|--------|-----------------|------------------|
| Server keys | ❌ Held private keys | ✅ No keys ever |
| User control | ❌ Limited | ✅ Full sovereignty |
| Security model | ❌ Trust server | ✅ Trust math/TEE |
| Revocation | ❌ Slow | ✅ Instant |
| Scope of keys | ❌ Unlimited | ✅ Limited sessions |
| Cloud agents | ❌ Regular VMs | ✅ TEE enclaves |
| Execution | ❌ Imperative | ✅ Intent-based |
| Transparency | ❌ Opaque | ✅ Verifiable |

## Deployment

### Smart Contracts (Celo)

```bash
# Deploy factory
forge create AgentSmartWalletFactory \
  --rpc-url https://forno.celo.org \
  --constructor-args 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 # EntryPoint

# Deploy wallet (user calls this)
factory.createWallet(userAddress)
```

### Cloud Agents (AWS Nitro)

```bash
# Build enclave image
docker build -t payment-agent .
nitro-cli build-enclave --docker-uri payment-agent --output-file payment-agent.eif

# Run enclave
nitro-cli run-enclave \
  --enclave-name payment-agent-1 \
  --eif-path payment-agent.eif \
  --cpu-count 2 \
  --memory 512 \
  --enclave-cid 16

# Get attestation
nitro-cli describe-enclaves
```

## Future Enhancements

1. **Multi-Chain**: Same architecture on Base, Arbitrum, etc.
2. **AI Agents**: GPT-4 in TEE for intent parsing
3. **Social Recovery**: Friends can help recover wallet
4. **Cross-Intent**: "Find me a lawyer, verify credentials, start call"
5. **ZK Proofs**: Private credential verification

## References

- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)
- [OpenClaw Intent Framework](https://openclaw.io)
- [ERC-8004 Agent Registry](https://eips.ethereum.org/EIPS/eip-8004)
