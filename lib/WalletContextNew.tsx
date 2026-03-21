'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { apiUrl } from './api';
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react';
import { BrowserProvider, formatEther, Contract, ethers } from 'ethers';

// Type for injected Ethereum provider
type EthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
};

// Celo chain configuration
const celo = {
  chainId: 42220,
  name: 'Celo',
  currency: 'CELO',
  explorerUrl: 'https://celoscan.io',
  rpcUrl: 'https://forno.celo.org',
};

const celoTestnet = {
  chainId: 44787,
  name: 'Celo Testnet',
  currency: 'CELO',
  explorerUrl: 'https://sepolia.celoscan.io',
  rpcUrl: 'https://alfajores-forno.celo-testnet.org',
};

// Initialize Web3Modal
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const metadata = {
  name: 'VOISSS - Voice Agent Hotline',
  description: 'Talk to verified AI agents. Pay per second.',
  url: 'https://voisss-agent-hotline.vercel.app',
  icons: ['https://voisss-agent-hotline.vercel.app/logo.png'],
};

// Determine which chain to use based on environment
const isProduction = process.env.NODE_ENV === 'production';
const chains = isProduction ? [celo] : [celo, celoTestnet];
const defaultChain = isProduction ? celo : celoTestnet;

const ethersConfig = defaultConfig({
  metadata,
  defaultChainId: defaultChain.chainId,
});

// Only create Web3Modal if projectId is provided
let web3Modal: ReturnType<typeof createWeb3Modal> | null = null;

if (projectId) {
  web3Modal = createWeb3Modal({
    ethersConfig,
    chains,
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#06b6d4', // cyan-500
      '--w3m-border-radius-master': '12px',
    },
  });
}

interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  walletType: 'metamask' | 'walletconnect' | null;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  formatAddress: () => string;
  switchChain: (chainId: number) => Promise<void>;
  getProvider: () => BrowserProvider | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    balance: null,
    isConnecting: false,
    walletType: null,
  });
  
  const initialized = useRef(false);
  const providerRef = useRef<BrowserProvider | null>(null);

  // Check for existing connection on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialized.current) {
      initialized.current = true;
      
      const checkConnection = async () => {
        try {
          // Check if Web3Modal is initialized and has an existing connection
          if (web3Modal && web3Modal.getIsConnected()) {
            const address = web3Modal.getAddress();
            const chainId = web3Modal.getChainId();
            
            if (address) {
              setWallet({
                connected: true,
                address,
                chainId: chainId != null ? Number(chainId) : null,
                balance: null,
                isConnecting: false,
                walletType: 'walletconnect',
              });
              
              // Set up provider
              providerRef.current = web3Modal.getWalletProvider()
                ? new BrowserProvider(web3Modal.getWalletProvider() as any)
                : null;
            }
          } else if (window.ethereum) {
            // Check for MetaMask/injected wallet
            const eth = window.ethereum as unknown as EthereumProvider;
            const accounts = await eth.request({ method: 'eth_accounts' });
            const chainId = await eth.request({ method: 'eth_chainId' });
            
            if (accounts.length > 0) {
              setWallet({
                connected: true,
                address: accounts[0],
                chainId: parseInt(chainId, 16),
                balance: null, // Will be fetched separately
                isConnecting: false,
                walletType: 'metamask',
              });
              
              // Set up provider
              providerRef.current = new BrowserProvider(window.ethereum as any);
              
              // Fetch balance
              const balance = await providerRef.current!.getBalance(accounts[0]);
              setWallet(prev => ({ ...prev, balance: formatEther(balance) }));
            }
          }
        } catch (error) {
          console.error('Failed to check connection:', error);
        }
      };
      
      checkConnection();

      // Listen for account changes (injected wallets)
      if (window.ethereum) {
        const eth = window.ethereum as unknown as EthereumProvider;
        eth.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            setWallet({
              connected: false,
              address: null,
              chainId: null,
              balance: null,
              isConnecting: false,
              walletType: null,
            });
            providerRef.current = null;
          } else {
            setWallet(prev => ({ ...prev, address: accounts[0] }));
          }
        });

        eth.on('chainChanged', (chainId: string) => {
          setWallet(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));
        });
      }

      // Listen for Web3Modal events
      if (web3Modal) {
        web3Modal.subscribeEvents((event) => {
          if (event.data.event === 'MODAL_CLOSE') {
            setWallet(prev => ({ ...prev, isConnecting: false }));
          } else if (event.data.event === 'CONNECT_SUCCESS') {
            const address = web3Modal.getAddress();
            const chainId = web3Modal.getChainId();
            
            if (address) {
              setWallet({
                connected: true,
                address,
                chainId: chainId != null ? Number(chainId) : null,
                balance: null,
                isConnecting: false,
                walletType: 'walletconnect',
              });
              
              providerRef.current = web3Modal.getWalletProvider()
                ? new BrowserProvider(web3Modal.getWalletProvider() as any)
                : null;
            }
          } else if (event.data.event === 'DISCONNECT_SUCCESS') {
            setWallet({
              connected: false,
              address: null,
              chainId: null,
              balance: null,
              isConnecting: false,
              walletType: null,
            });
            providerRef.current = null;
          }
        });
      }
    }
  }, []);

  const connect = useCallback(async () => {
    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      // First try to connect with injected wallet (MetaMask, etc.)
      if (window.ethereum) {
        try {
          const eth = window.ethereum as unknown as EthereumProvider;
          const accounts = await eth.request({ method: 'eth_requestAccounts' });
          const chainId = await eth.request({ method: 'eth_chainId' });

          providerRef.current = new BrowserProvider(window.ethereum as any);
          const balance = await providerRef.current.getBalance(accounts[0]);

          setWallet({
            connected: true,
            address: accounts[0],
            chainId: parseInt(chainId, 16),
            balance: formatEther(balance),
            isConnecting: false,
            walletType: 'metamask',
          });
          return;
        } catch (injectedError) {
          console.log('Injected wallet connection failed, trying WalletConnect...', injectedError);
        }
      }

      // If no injected wallet or connection failed, use WalletConnect
      if (web3Modal) {
        await web3Modal.open();
        // Connection will be handled by the event listener
      } else {
        throw new Error('No wallet provider available. Please install MetaMask or configure WalletConnect.');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      setWallet(prev => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    
    setWallet({
      connected: false,
      address: null,
      chainId: null,
      balance: null,
      isConnecting: false,
      walletType: null,
    });
    providerRef.current = null;
  }, [wallet.walletType]);

  const formatAddress = useCallback(() => {
    if (!wallet.address) return '';
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet.address]);

  const switchChain = useCallback(async (chainId: number) => {
    if (wallet.walletType === 'walletconnect' && web3Modal) {
      await web3Modal.switchNetwork(chainId);
    } else if (window.ethereum) {
      const eth = window.ethereum as unknown as EthereumProvider;
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } catch (error: any) {
        // Chain not added, try to add it
        if (error.code === 4902) {
          const chain = chains.find(c => c.chainId === chainId);
          if (chain) {
            try {
              await eth.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${chain.chainId.toString(16)}`,
                  chainName: chain.name,
                  nativeCurrency: { name: chain.currency, symbol: chain.currency, decimals: 18 },
                  rpcUrls: [chain.rpcUrl],
                  blockExplorerUrls: [chain.explorerUrl],
                }],
              });
            } catch (addError) {
              console.error('Failed to add chain:', addError);
            }
          }
        } else {
          console.error('Failed to switch chain:', error);
        }
      }
    }
  }, [wallet.walletType]);

  const getProvider = useCallback(() => {
    return providerRef.current;
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...wallet,
        connect,
        disconnect,
        formatAddress,
        switchChain,
        getProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Helper to sign messages
export async function signMessage(message: string): Promise<string> {
  if (!window.ethereum) throw new Error('No wallet');
  const eth = window.ethereum as unknown as EthereumProvider;
  const accounts = await eth.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) throw new Error('Not connected');
  return await eth.request({ method: 'personal_sign', params: [message, accounts[0]] });
}

// Helper to send transactions
export async function sendTransaction(to: string, value: string): Promise<string> {
  if (!window.ethereum) throw new Error('No wallet');
  const eth = window.ethereum as unknown as EthereumProvider;
  const accounts = await eth.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) throw new Error('Not connected');
  return await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from: accounts[0], to, value: ethers.parseEther(value).toString(16) }],
  });
}

// ERC-8004 Delegation helper
export async function createDelegation(
  userAddress: string,
  scope: {
    canBook?: boolean;
    canOrder?: boolean;
    canSchedule?: boolean;
    canResearch?: boolean;
    maxSpendUSD?: number;
    expiresInDays?: number;
  }
): Promise<{ success: boolean; delegationId?: string; error?: string }> {
  try {
    const response = await fetch(apiUrl('/api/delegations'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress,
        scope: {
          canBook: scope.canBook ?? false,
          canOrder: scope.canOrder ?? false,
          canSchedule: scope.canSchedule ?? false,
          canResearch: scope.canResearch ?? false,
          maxSpendUSD: scope.maxSpendUSD ?? 10,
          expiresInDays: scope.expiresInDays ?? 30,
        },
      }),
    });

    const result = await response.json();
    
    if (!response.ok || result.error) {
      throw new Error(result.error || `Failed to create delegation: ${response.statusText}`);
    }

    return {
      success: true,
      delegationId: result.delegationId,
    };
  } catch (error) {
    console.error('Error creating delegation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}