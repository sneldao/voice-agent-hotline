'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { createConfig, WagmiConfig, useAccount, useConnect, useDisconnect, useNetwork, configureChains } from 'wagmi';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { celo, celoAlfajores } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { parseEther, Address, Hash, createWalletClient, custom, getAddress, http as viemHttp } from 'viem';

// Types
interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
}

interface WalletContextValue extends WalletState {
  connect: () => void;
  disconnect: () => void;
  formatAddress: () => string;
  switchChain: (chainId: number) => void;
  getWalletClient: () => ReturnType<typeof createWalletClient> | null;
}

// Celo network config
const CELO_MAINNET = {
  id: 42220,
  name: 'Celo',
  network: 'celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
    public: { http: ['https://forno.celo.org'] },
  },
} as const;

const CELO_ALFAJORES = {
  id: 44787,
  name: 'Celo Alfajores',
  network: 'celo-alfajores',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://alfajores-forno.celo-testnet.org'] },
    public: { http: ['https://alfajores-forno.celo-testnet.org'] },
  },
} as const;

const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;

// Wagmi config with Celo support (v1 API)
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [celo, celoAlfajores],
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === celo.id) return { http: 'https://forno.celo.org' };
        if (chain.id === celoAlfajores.id) return { http: 'https://alfajores-forno.celo-testnet.org' };
        return null;
      },
    }),
  ]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new MetaMaskConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
      },
    }),
  ],
});

// React Query client for wagmi
const queryClient = new QueryClient();

// Store for external wallet client access
let walletClientRef: ReturnType<typeof createWalletClient> | null = null;

function getWalletClientFromProvider(): ReturnType<typeof createWalletClient> | null {
  if (typeof window === 'undefined') return null;
  
  // Check for injected provider (MetaMask, etc.)
  const injectedProvider = (window as any).ethereum;
  if (!injectedProvider) {
    console.warn('[wallet] No injected provider found');
    return null;
  }
  
  const walletClient = createWalletClient({
    chain: ACTIVE_CHAIN,
    transport: custom(injectedProvider),
  });
  
  return walletClient;
}

// Custom hook for wallet operations
function useWalletContext() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const chainId = chain?.id;
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);

  // Update wallet client ref when address changes
  useEffect(() => {
    if (isConnected && address) {
      walletClientRef = getWalletClientFromProvider();
    } else {
      walletClientRef = null;
    }
  }, [isConnected, address]);

  const connectWallet = useCallback(() => {
    setIsConnecting(true);
    const connector = connectors[1] || connectors[0];
    if (connector) {
      connect({ connector });
    }
    setTimeout(() => setIsConnecting(false), 2000);
  }, [connect, connectors]);

  const disconnectWallet = useCallback(() => {
    walletClientRef = null;
    disconnect();
  }, [disconnect]);

  const formatAddress = useCallback(() => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const switchToChain = useCallback((targetChainId: number) => {
    // Chain switching not implemented in this version
    console.log('Switch to chain:', targetChainId);
  }, []);

  const getViemWalletClient = useCallback(() => {
    return walletClientRef;
  }, []);

  return {
    connected: isConnected,
    address: address || null,
    chainId: chainId || null,
    isConnecting,
    connect: connectWallet,
    disconnect: disconnectWallet,
    formatAddress,
    switchChain: switchToChain,
    getWalletClient: getViemWalletClient,
  };
}

// Context for app-wide access
const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProviders');
  }
  return context;
}

function WalletProviderInner({ children }: { children: ReactNode }) {
  const wallet = useWalletContext();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProviderInner>
          {children}
        </WalletProviderInner>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

// Helper component for UI
export function WalletConnectButton() {
  const { connected, address, isConnecting, connect, disconnect, formatAddress } = useWallet();
  
  if (connected) {
    return (
      <button
        onClick={disconnect}
        className="px-4 py-2 rounded-full bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        {formatAddress()}
      </button>
    );
  }
  
  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="px-4 py-2 rounded-full bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors disabled:opacity50"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

// ============================================
// REAL Transaction Functions using viem
// ============================================

export async function sendTransaction(to: string, value: string): Promise<string> {
  const walletClient = getWalletClientFromProvider();
  if (!walletClient) {
    throw new Error('Wallet not connected or no provider');
  }

  if (!walletClient.account) {
    throw new Error('Wallet account not available');
  }

  try {
    const hash = await walletClient.sendTransaction({
      account: walletClient.account,
      to: getAddress(to),
      value: parseEther(value),
      chain: ACTIVE_CHAIN,
    });
    console.log('[wallet] Transaction sent:', hash);
    return hash;
  } catch (error) {
    console.error('[wallet] Transaction failed:', error);
    throw error;
  }
}

export async function signMessage(message: string): Promise<string> {
  const walletClient = getWalletClientFromProvider();
  if (!walletClient) {
    throw new Error('Wallet not connected or no provider');
  }

  if (!walletClient.account) {
    throw new Error('Wallet account not available');
  }

  try {
    const signature = await walletClient.signMessage({
      account: walletClient.account,
      message,
    });
    console.log('[wallet] Message signed:', signature);
    return signature;
  } catch (error) {
    console.error('[wallet] SignMessage failed:', error);
    throw error;
  }
}

export async function writeContract(args: {
  address: Address;
  abi: any[];
  functionName: string;
  args: any[];
}): Promise<Hash> {
  const walletClient = getWalletClientFromProvider();
  if (!walletClient) {
    throw new Error('Wallet not connected or no provider');
  }

  if (!walletClient.account) {
    throw new Error('Wallet account not available');
  }

  try {
    const hash = await walletClient.writeContract({
      account: walletClient.account,
      ...args,
      chain: ACTIVE_CHAIN,
    });
    console.log('[wallet] Contract write:', hash);
    return hash;
  } catch (error) {
    console.error('[wallet] Contract write failed:', error);
    throw error;
  }
}

// ============================================
// ERC-8004 Delegation using ERC8004Service
// ============================================

export async function createDelegation(
  delegateAddress: string,
  scope: {
    canBook?: boolean;
    canOrder?: boolean;
    canSchedule?: boolean;
    canResearch?: boolean;
    maxSpend?: bigint;
    expiresAt?: bigint;
  }
): Promise<{ success: boolean; delegationId?: string; error?: string }> {
  try {
    const { erc8004Service } = await import('./erc8004');
    
    const walletClient = getWalletClientFromProvider();
    if (!walletClient) {
      return { success: false, error: 'Wallet not connected' };
    }
    
    // Check ERC-8004 configuration
    const config = erc8004Service.checkConfiguration();
    if (!config.configured) {
      return { 
        success: false, 
        error: `ERC-8004 contracts not configured. Missing: ${config.missingContracts?.join(', ')}` 
      };
    }
    
    // Create wrapper matching ERC8004Service interface
    if (!walletClient.account) {
      return { success: false, error: 'Wallet account not available' };
    }
    
    const walletWrapper = {
      account: { address: walletClient.account.address },
      writeContract: async (args: any) => walletClient.writeContract({
        account: walletClient.account,
        ...args,
        chain: ACTIVE_CHAIN,
      }),
    };
    
    const result = await erc8004Service.createDelegation(
      walletWrapper,
      getAddress(delegateAddress) as Address,
      {
        canBook: scope.canBook || false,
        canOrder: scope.canOrder || false,
        canSchedule: scope.canSchedule || false,
        canResearch: scope.canResearch || false,
        maxSpend: scope.maxSpend || BigInt(0),
        expiresAt: scope.expiresAt || BigInt(Date.now() + 30 * 24 * 60 * 60),
      }
    );
    
    if (result.success && result.delegationId) {
      return {
        success: true,
        delegationId: result.delegationId.toString(),
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to create delegation',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export for use in other modules
export function getViemClient() {
  return getWalletClientFromProvider();
}

export type { WalletState, WalletContextValue };
