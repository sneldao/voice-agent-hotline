// ============================================
// Arbitrum Chain Configuration
// ============================================
// Shared chain config for Arbitrum One + Arbitrum Sepolia.
// Used by MetaMask Smart Accounts, payments, contracts.
// ============================================

import { arbitrum, arbitrumSepolia } from 'viem/chains';
import type { Address } from 'viem';

// ============================================
// Token Addresses on Arbitrum
// ============================================

/** Native USDC on Arbitrum One */
export const ARB_USDC: Address = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

/** USDT on Arbitrum One */
export const ARB_USDT: Address = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

/** Native USDC on Arbitrum Sepolia */
export const ARB_SEPOLIA_USDC: Address = '0x75faf114eafb1BDbe2Fc6eab564F18A9356ac62C';

// ============================================
// Chain selection
// ============================================

const isProduction = process.env.NODE_ENV === 'production';

export const ACTIVE_CHAIN = isProduction ? arbitrum : arbitrumSepolia;
export const ACTIVE_CHAIN_ID = isProduction ? 42161 : 421614;

export const RPC_URL =
  process.env.ARBITRUM_RPC_URL ||
  (isProduction
    ? 'https://arb1.arbitrum.io/rpc'
    : 'https://sepolia-rollup.arbitrum.io/rpc');

export const ACTIVE_USDC = isProduction ? ARB_USDC : ARB_SEPOLIA_USDC;

export const EXPLORER_URL =
  process.env.ARBITRUM_EXPLORER_URL ||
  (isProduction
    ? 'https://arbiscan.io'
    : 'https://sepolia.arbiscan.io');

// ============================================
// Chain definitions for wallet UI
// ============================================

export const arbitrumOneWallet = {
  chainId: 42161,
  name: 'Arbitrum One',
  currency: 'ETH',
  explorerUrl: 'https://arbiscan.io',
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
};

export const arbitrumSepoliaWallet = {
  chainId: 421614,
  name: 'Arbitrum Sepolia',
  currency: 'ETH',
  explorerUrl: 'https://sepolia.arbiscan.io',
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
};

// ============================================
// EIP-712 Domain for USDC transferWithAuthorization
// ============================================

export const ARB_USDC_EIP712_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 42161,
  verifyingContract: ARB_USDC,
};

export const ARB_USDC_EIP712_DOMAIN_SEPOLIA = {
  name: 'USD Coin',
  version: '2',
  chainId: 421614,
  verifyingContract: ARB_SEPOLIA_USDC,
};

// ============================================
// x402 / ERC-7710
// ============================================

export const X402_NETWORK = isProduction ? 'eip155:42161' : 'eip155:421614';

// ============================================
// Helpers
// ============================================

export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}