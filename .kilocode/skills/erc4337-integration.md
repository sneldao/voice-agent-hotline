# ERC-4337 Account Abstraction Integration

## Overview
This project uses ERC-4337 (Account Abstraction) to enable:
- Session keys with limited scope
- Gasless transactions for users
- Smart contract wallets
- No server private keys

## Architecture

```
User EOA (Owner)
    │
    ├─→ Smart Contract Wallet (AgentSmartWallet)
    │       ├─ Session Key 1 (expires: 1hr, max: $5)
    │       ├─ Session Key 2 (expires: 1hr, max: $10)
    │       └─ ...
    │
    └─→ Can: Authorize, Revoke, Emergency Withdraw

Session Key (Cloud Agent in TEE)
    │
    ├─→ Can: settlePayment() up to limit
    ├─→ Can: startCall() with authorized agents
    └─→ Cannot: Exceed limits, Access other keys
```

## Key Components

### 1. Smart Contract Wallet
```solidity
contract AgentSmartWallet is BaseAccount {
    address public owner;
    IEntryPoint public immutable entryPoint;
    
    struct SessionKey {
        bool authorized;
        uint256 expiry;
        uint256 maxAmount;
        uint256 spentAmount;
        address[] allowedAgents;
        bool revoked;
    }
    
    // Only session key can call
    modifier onlySessionKey(address key) {
        SessionKey storage sk = sessionKeys[key];
        require(sk.authorized && !sk.revoked);
        require(block.timestamp < sk.expiry);
        _;
    }
}
```

### 2. Session Key Lifecycle

#### Creation (User Action)
```typescript
// User creates session key in their wallet
const sessionKey = await walletClient.writeContract({
  address: smartWalletAddress,
  abi: AgentSmartWalletABI,
  functionName: 'authorizeSessionKey',
  args: [
    sessionKeyAddress,    // Public key only
    parseEther('5'),      // Max $5
    3600,                 // 1 hour expiry
    [agent1, agent2]      // Allowed agents
  ]
});
```

#### Usage (Cloud Agent)
```typescript
// Cloud agent creates UserOperation
const userOp = {
  sender: smartWalletAddress,
  target: tokenContract,
  callData: encodeFunctionData({
    functionName: 'transfer',
    args: [agent, amount]
  }),
  signature: await sessionKey.sign(userOpHash) // In TEE
};

// Submit to EntryPoint
await entryPoint.handleOps([userOp], beneficiary);
```

#### Revocation (Instant)
```typescript
// User can revoke anytime
await walletClient.writeContract({
  address: smartWalletAddress,
  functionName: 'revokeSessionKey',
  args: [sessionKeyAddress]
});
```

### 3. UserOperation Structure
```typescript
interface UserOperation {
  sender: Address;           // Smart wallet address
  nonce: bigint;             // Anti-replay
  initCode: Hex;             // For wallet creation
  callData: Hex;             // Actual transaction
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;     // For gasless txs
  signature: Hex;            // Session key signature
}
```

## Integration Patterns

### Pattern 1: Intent-Based Execution
```typescript
// User expresses intent
const intent = {
  action: 'start_call',
  agentId: 'agent_123',
  maxAmount: parseEther('0.50'),
  duration: 300 // 5 min
};

// Cloud agent creates execution plan
const plan = {
  steps: [
    { type: 'authorize_session', amount: intent.maxAmount },
    { type: 'start_webrtc', agentId: intent.agentId },
    { type: 'settle_on_end', callId: 'call_123' }
  ]
};

// User signs intent (not individual txs)
const signature = await walletClient.signTypedData({
  domain: { name: 'AgentSmartWallet', version: '1', chainId: 42220 },
  types: { Intent: [{ name: 'action', type: 'string' }, ...] },
  message: intent
});
```

### Pattern 2: Streaming Payments
```typescript
// Authorize streaming for call duration
const streamingAuth = {
  ratePerMinute: parseEther('0.10'),  // $0.10/min
  maxDuration: 600,                    // 10 min max
  agent: agentAddress,
  sessionKey: sessionKeyAddress
};

// Cloud agent settles every minute
async function settleMinute(callId: string, minute: number) {
  const amount = streamingAuth.ratePerMinute;
  
  await smartWallet.settlePayment(
    streamingAuth.agent,
    amount,
    callId,
    CELO_TOKENS.cUSD
  );
  
  // Check remaining balance
  const remaining = await smartWallet.getRemainingSessionBalance(
    streamingAuth.sessionKey
  );
  
  if (remaining < streamingAuth.ratePerMinute) {
    // End call gracefully
  }
}
```

### Pattern 3: Batch Operations
```solidity
// Execute multiple operations atomically
function executeBatch(
    address[] calldata targets,
    bytes[] calldata data,
    uint256[] calldata values
) external onlyOwner {
    for (uint i = 0; i < targets.length; i++) {
        (bool success, ) = targets[i].call{value: values[i]}(data[i]);
        require(success, "Batch call failed");
    }
}
```

## Security Considerations

### 1. Session Key Scope
```typescript
// Good: Limited scope
const sessionKey = {
  maxAmount: parseEther('5'),     // $5 max
  expiry: Date.now() + 3600000,   // 1 hour
  allowedAgents: [agent1],         // Specific agent only
  allowedMethods: ['settlePayment'] // Specific method
};

// Bad: Unlimited scope
const badSessionKey = {
  maxAmount: parseEther('10000'), // Too high
  expiry: Date.now() + 86400000,  // Too long
  allowedAgents: '*',              // Any agent
  allowedMethods: '*'              // Any method
};
```

### 2. Replay Protection
```solidity
mapping(bytes32 => bool) public usedNonces;

function settlePaymentWithAuthorization(
    PaymentAuthorization calldata auth,
    bytes calldata signature
) external {
    // Check nonce not used
    require(!usedNonces[auth.callId], "Already used");
    usedNonces[auth.callId] = true;
    
    // Verify signature
    // ...
}
```

### 3. Emergency Procedures
```solidity
// Owner can always revoke
function emergencyRevokeAll() external onlyOwner {
    // Revoke all active session keys
    for (uint i = 0; i < activeSessionKeys.length; i++) {
        sessionKeys[activeSessionKeys[i]].revoked = true;
    }
}

// Emergency withdraw
function emergencyWithdraw(address token) external onlyOwner {
    uint256 balance = IERC20(token).balanceOf(address(this));
    IERC20(token).transfer(owner, balance);
}
```

## Testing

### Unit Tests
```typescript
// Test session key authorization
describe('SessionKey', () => {
  it('should authorize session key', async () => {
    const tx = await wallet.authorizeSessionKey(
      sessionKey.address,
      parseEther('5'),
      3600,
      [agent1]
    );
    
    const sk = await wallet.sessionKeys(sessionKey.address);
    expect(sk.authorized).to.be.true;
    expect(sk.maxAmount).to.equal(parseEther('5'));
  });
  
  it('should enforce spending limits', async () => {
    // Try to exceed limit
    await expect(
      wallet.connect(sessionKey).settlePayment(
        agent1,
        parseEther('10'), // Over $5 limit
        callId,
        cUSD
      )
    ).to.be.revertedWith('Exceeds session limit');
  });
});
```

### Integration Tests
```typescript
// Full payment flow
describe('Payment Flow', () => {
  it('should settle payment with session key', async () => {
    // 1. Authorize session
    // 2. Create UserOperation
    // 3. Submit to EntryPoint
    // 4. Verify payment settled
    // 5. Verify session balance updated
  });
});
```

## Resources
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [EntryPoint Contract](https://etherscan.io/address/0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
- [Account Abstraction on Celo](https://docs.celo.org/developer/erc-4337)
- [UserOp.js Library](https://github.com/eth-infinitism/account-abstraction)
