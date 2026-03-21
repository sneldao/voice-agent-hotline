// ============================================
// WDK Wallet Integration
// ============================================
// Self-custodial multi-chain wallet provider using Tether's WDK
// Supports: Celo, Plasma, Stable, and any EVM chain
// Docs: https://docs.wallet.tether.io

import type { Address, Hash } from 'viem';

// ============================================
// Configuration
// ============================================

export interface WDKChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  usdtAddress: Address;
  /** CAIP-2 network identifier for x402 */
  x402Network: string;
  /** Token metadata for EIP-712 signing */
  tokenMeta: { name: string; version: string; decimals: number };
}

export const WDK_CHAINS: Record<string, WDKChainConfig> = {
  celo: {
    chainId: 42220,
    name: 'Celo',
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    usdtAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as Address, // cUSD on Celo
    x402Network: 'eip155:42220',
    tokenMeta: { name: 'Celo Dollar', version: '1', decimals: 18 },
  },
  plasma: {
    chainId: 9745,
    name: 'Plasma',
    rpcUrl: 'https://rpc.plasma.to',
    usdtAddress: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb' as Address, // USD₮0 on Plasma
    x402Network: 'eip155:9745',
    tokenMeta: { name: 'USDT0', version: '1', decimals: 6 },
  },
  stable: {
    chainId: 988,
    name: 'Stable',
    rpcUrl: 'https://rpc.stable.xyz',
    usdtAddress: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736' as Address, // USD₮0 on Stable
    x402Network: 'eip155:988',
    tokenMeta: { name: 'USDT0', version: '1', decimals: 6 },
  },
};

// ============================================
// Types
// ============================================

export interface WDKAccount {
  address: Address;
  getBalance: () => Promise<bigint>;
  getTokenBalance: (token: Address) => Promise<bigint>;
  sendTransaction: (params: { to: Address; value: bigint }) => Promise<{ hash: Hash }>;
  signTypedData: (params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    message: Record<string, unknown>;
  }) => Promise<string>;
  signAuthorization: (params: {
    spender: Address;
    value: bigint;
    token: Address;
  }) => Promise<{ v: number; r: `0x${string}`; s: `0x${string}`; nonce: `0x${string}` }>;
  transfer: (params: { to: Address; amount: bigint; token: Address }) => Promise<{ hash: Hash }>;
  dispose: () => void;
}

// ============================================
// WDK Wallet Manager
// ============================================

let WDKClass: any = null;
let WalletManagerEvmClass: any = null;

async function loadWDK() {
  if (WDKClass) return;
  const wdkModule = await import('@tetherto/wdk');
  WDKClass = wdkModule.default || wdkModule;
  const evmModule = await import('@tetherto/wdk-wallet-evm');
  WalletManagerEvmClass = evmModule.default || evmModule;
}

/**
 * Create a WDK instance with wallets registered for specified chains.
 * @param seedPhrase - BIP-39 mnemonic. In production, load from secure storage.
 * @param chains - Chain keys to register (defaults to configured chains).
 */
export async function createWDKWallets(
  seedPhrase: string,
  chains: string[] = ['celo']
): Promise<{
  getAccount: (chain: string, index?: number) => Promise<WDKAccount>;
  getAddress: (chain: string, index?: number) => Promise<Address>;
  getSupportedChains: () => string[];
  dispose: () => void;
}> {
  await loadWDK();

  const wdk = new WDKClass(seedPhrase);

  for (const chainKey of chains) {
    const config = WDK_CHAINS[chainKey];
    if (!config) {
      console.warn(`[WDK] Unknown chain: ${chainKey}, skipping`);
      continue;
    }
    wdk.registerWallet(chainKey, WalletManagerEvmClass, {
      provider: config.rpcUrl,
    });
  }

  return {
    async getAccount(chain: string, index = 0): Promise<WDKAccount> {
      const account = await wdk.getAccount(chain, index);
      const address = await account.getAddress();

      return {
        address: address as Address,
        async getBalance() {
          return account.getBalance();
        },
        async getTokenBalance(token: Address) {
          // ERC-20 balanceOf via the account
          const { createPublicClient, http } = await import('viem');
          const config = WDK_CHAINS[chain];
          const client = createPublicClient({
            transport: http(config?.rpcUrl || 'https://forno.celo.org'),
          });
          return client.readContract({
            address: token,
            abi: [{
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: 'balance', type: 'uint256' }],
            }],
            functionName: 'balanceOf',
            args: [address],
          });
        },
        async sendTransaction(params) {
          return account.sendTransaction(params);
        },
        async signTypedData(params) {
          return account.signTypedData(params);
        },
        async signAuthorization(params) {
          if (account.signAuthorization) {
            return account.signAuthorization(params);
          }
          throw new Error('signAuthorization not available on this account');
        },
        async transfer(params) {
          return account.transfer(params);
        },
        dispose() {
          account.dispose();
        },
      };
    },

    async getAddress(chain: string, index = 0): Promise<Address> {
      const account = await wdk.getAccount(chain, index);
      return account.getAddress();
    },

    getSupportedChains(): string[] {
      return Object.keys(WDK_CHAINS);
    },

    dispose() {
      wdk.dispose();
    },
  };
}

/**
 * Generate a new BIP-39 seed phrase.
 */
export async function generateSeedPhrase(): Promise<string> {
  await loadWDK();
  return WDKClass.getRandomSeedPhrase();
}

/**
 * Get USD₮ token balance for an address on a specific chain.
 */
export async function getUSDTBalance(
  address: Address,
  chainKey: string = 'celo'
): Promise<{ balance: bigint; decimals: number; formatted: string }> {
  const config = WDK_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);

  const { createPublicClient, http, formatUnits } = await import('viem');
  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });

  const balance = await client.readContract({
    address: config.usdtAddress,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: 'balance', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [address],
  });

  return {
    balance: balance as bigint,
    decimals: config.tokenMeta.decimals,
    formatted: formatUnits(balance as bigint, config.tokenMeta.decimals),
  };
}
