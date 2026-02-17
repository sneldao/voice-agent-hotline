# Celo Development Guidelines

## Overview
This project builds on Celo - a mobile-first, EVM-compatible blockchain optimized for stablecoin payments.

## Key Principles

### Payment Tokens
- **cUSD** (0x765DE816845861e75A25fCA122bb6898B8B1282a) - Primary stablecoin
- **USDC** (0xcebA9300f2b948710d2653dD7B07f33A8B32118C) - Alternative stablecoin
- **CELO** (0x471EcE3750Da237f93B8E339c536898b6AEDf5c7) - Gas token

### Network Configuration
```typescript
// Celo Mainnet
const CELO_MAINNET = {
  chainId: 42220,
  rpc: 'https://forno.celo.org',
  explorer: 'https://celoscan.io'
};

// Celo Alfajores (Testnet)
const CELO_TESTNET = {
  chainId: 44787,
  rpc: 'https://alfajores-forno.celo-testnet.org',
  explorer: 'https://alfajores.celoscan.io'
};
```

### Smart Contract Patterns

#### 1. ERC-4337 Account Abstraction
```solidity
// User-controlled smart wallet with session keys
contract AgentSmartWallet {
    address public owner;
    mapping(address => SessionKey) public sessionKeys;
    
    struct SessionKey {
        bool authorized;
        uint256 expiry;
        uint256 maxAmount;
        uint256 spentAmount;
        bool revoked;
    }
}
```

#### 2. Gasless Payments (EIP-3009)
```solidity
// transferWithAuthorization for gasless UX
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;
```

#### 3. x402 Payment Protocol
- Pay-per-use micropayments
- Session-based authorization
- Automatic settlement

## Development Workflow

### 1. Local Testing
```bash
# Use Alfajores testnet
export CELO_RPC_URL=https://alfajores-forno.celo-testnet.org

# Get testnet CELO from faucet
# https://faucet.celo.org
```

### 2. Contract Deployment
```bash
# Using Foundry
forge create AgentSmartWallet \
  --rpc-url $CELO_RPC_URL \
  --constructor-args <entrypoint> <owner>

# Verify on CeloScan
forge verify-contract <address> AgentSmartWallet \
  --rpc-url $CELO_RPC_URL
```

### 3. Testing Payments
```typescript
// Test payment flow
const payment = await x402Payments.settlePayment({
  from: userAddress,
  to: agentAddress,
  value: parseEther('0.10'), // $0.10
  token: CELO_TOKENS.cUSD
});
```

## Security Best Practices

### Session Keys
- Always set expiry (max 1 hour recommended)
- Limit maxAmount per session
- Allow instant revocation
- Only authorize specific agents

### Payment Validation
```typescript
// Verify before settling
const isValid = await verifyAuthorization({
  from: authorization.from,
  to: authorization.to,
  value: authorization.value,
  validBefore: authorization.validBefore,
  nonce: authorization.nonce
});
```

### Replay Protection
- Track used nonces in contract
- Check authorizationState before execution
- Reject expired authorizations

## Common Issues

### 1. Gas Estimation
Celo uses different gas pricing. Use:
```typescript
const gasEstimate = await publicClient.estimateGas({
  account,
  to,
  value,
  // Don't specify gasPrice - let wallet handle it
});
```

### 2. Token Decimals
cUSD and USDC use 18 decimals (not 6 like Ethereum USDC):
```typescript
const amount = parseUnits('1.50', 18); // 1.50 cUSD
```

### 3. RPC Rate Limits
Forno has rate limits. For production:
- Use dedicated node (QuickNode, Alchemy)
- Implement request batching
- Cache read operations

## Resources
- [Celo Docs](https://docs.celo.org)
- [ERC-4337 on Celo](https://docs.celo.org/developer/erc-4337)
- [CeloScan Explorer](https://celoscan.io)
- [Celo Faucet](https://faucet.celo.org)
