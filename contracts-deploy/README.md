# DelegationRegistry Contract Deployment

This folder contains the deployment setup for the custom DelegationRegistry contract used by the Voice Agent Hotline project.

## Prerequisites

1. Node.js 18+ installed
2. A Celo testnet wallet with testnet CELO for gas fees
3. Private key of the deployment wallet

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment file and fill in your private key:
```bash
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
```

**IMPORTANT**: Never commit your `.env` file or private keys to version control!

## Deployment

### Celo Testnet (Alfajores)

```bash
npm run deploy:celo-testnet
```

### Celo Mainnet

```bash
npm run deploy:celo-mainnet
```

## Contract Addresses

After deployment, update the following environment variables in your main project's `.env.local` file:

```env
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=<deployed_contract_address>
```

## Verification

The deployment script automatically attempts to verify the contract on CeloScan. If verification fails, you can manually verify using:

```bash
npx hardhat verify --network celoTestnet <CONTRACT_ADDRESS>
```

## Standard ERC-8004 Contracts

The standard ERC-8004 Identity and Reputation registries are already deployed on Celo testnet:

- **IdentityRegistry**: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **ReputationRegistry**: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

These are deterministic vanity addresses deployed by the ERC-8004 team.

## Contract Functions

The DelegationRegistry contract provides the following functions:

- `createDelegation(delegate, scope)` - Create a new delegation
- `verifyDelegation(delegationId, action)` - Verify if delegation is valid for an action
- `revokeDelegation(delegationId)` - Revoke a delegation
- `getDelegation(delegationId)` - Get delegation details
- `getActiveDelegations(delegator)` - Get all active delegations for a delegator

## Security Notes

- The contract uses a simple authorization model where only the delegator can revoke their own delegations
- Delegations have expiration times to limit their validity
- The contract is upgradeable-resistant (no proxy patterns) for simplicity
- Always audit contracts before mainnet deployment