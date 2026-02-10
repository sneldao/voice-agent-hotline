'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { showWalletConnected, showError } from '@/lib/useToast';

interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number;
  chainId: number | null;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  formatAddress: () => string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    balance: 0,
    chainId: null,
  });

  const connect = useCallback(async () => {
    try {
      // Simulate wallet connection for demo
      // In production, use wagmi or viem
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockAddress = '0x' + Array.from(new Array(40)).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      setWallet({
        connected: true,
        address: mockAddress,
        balance: 2.50,
        chainId: 42220, // Celo mainnet
      });
      
      showWalletConnected(mockAddress);
    } catch (error) {
      showError('Failed to connect wallet');
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({
      connected: false,
      address: null,
      balance: 0,
      chainId: null,
    });
  }, []);

  const formatAddress = useCallback(() => {
    if (!wallet.address) return '';
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet.address]);

  return (
    <WalletContext.Provider
      value={{
        ...wallet,
        connect,
        disconnect,
        formatAddress,
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
