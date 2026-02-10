'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// Types for Ethereum
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  selectedAddress: string | null;
  chainId: string | null;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  formatAddress: () => string;
  switchChain: (chainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Celo chain info
const CELO_CHAIN = {
  id: 42220,
  name: 'Celo',
  rpcUrl: 'https://forno.celo.org',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  blockExplorer: 'https://explorer.celo.org',
};

export function Providers({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    isConnecting: false,
  });

  // Check for existing connection on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const checkConnection = async () => {
        try {
          const accounts = await window.ethereum!.request({ method: 'eth_accounts' });
          const chainId = await window.ethereum!.request({ method: 'eth_chainId' });
          
          if (accounts.length > 0) {
            setWallet({
              connected: true,
              address: accounts[0],
              chainId: parseInt(chainId, 16),
              isConnecting: false,
            });
          }
        } catch (error) {
          console.error('Failed to check connection:', error);
        }
      };
      
      checkConnection();

      // Listen for account changes
      window.ethereum!.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          setWallet({ connected: false, address: null, chainId: null, isConnecting: false });
        } else {
          setWallet(prev => ({ ...prev, address: accounts[0] }));
        }
      });

      window.ethereum!.on('chainChanged', (chainId: string) => {
        setWallet(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));
      });
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' });
      const chainId = await window.ethereum!.request({ method: 'eth_chainId' });

      setWallet({
        connected: true,
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        isConnecting: false,
      });
    } catch (error) {
      console.error('Failed to connect:', error);
      setWallet(prev => ({ ...prev, isConnecting: false }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({
      connected: false,
      address: null,
      chainId: null,
      isConnecting: false,
    });
  }, []);

  const formatAddress = useCallback(() => {
    if (!wallet.address) return '';
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet.address]);

  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum) return;

    try {
      // Try to switch
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902 && chainId === CELO_CHAIN.id) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${CELO_CHAIN.id.toString(16)}`,
              chainName: CELO_CHAIN.name,
              nativeCurrency: CELO_CHAIN.nativeCurrency,
              rpcUrls: [CELO_CHAIN.rpcUrl],
              blockExplorerUrls: [CELO_CHAIN.blockExplorer],
            }],
          });
        } catch (addError) {
          console.error('Failed to add Celo network:', addError);
        }
      } else {
        console.error('Failed to switch chain:', error);
      }
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...wallet,
        connect,
        disconnect,
        formatAddress,
        switchChain,
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
  
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  if (accounts.length === 0) throw new Error('Not connected');
  
  return await window.ethereum.request({
    method: 'personal_sign',
    params: [message, accounts[0]],
  });
}

// Helper to send transactions
export async function sendTransaction(to: string, value: string): Promise<string> {
  if (!window.ethereum) throw new Error('No wallet');
  
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  if (accounts.length === 0) throw new Error('Not connected');
  
  return await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to,
      value,
    }],
  });
}
