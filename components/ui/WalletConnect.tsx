'use client';

import { useState, useCallback } from 'react';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { 
  Wallet, 
  LogOut, 
  Check, 
  ChevronRight,
  Shield,
  Zap
} from './Toast';
import { showSuccess, showError, showCopied } from '@/lib/useToast';

interface WalletConnectProps {
  connected?: boolean;
  address?: string;
  balance?: number;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletConnect({ 
  connected = false, 
  address, 
  balance = 0,
  onConnect, 
  onDisconnect 
}: WalletConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    showCopied();
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      onConnect();
      showSuccess('Wallet connected successfully!');
    } catch (error) {
      showError('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  if (connected && address) {
    return (
      <div className="p-4 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Wallet Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-white" />
          </div>

          {/* Address & Balance */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Connected</span>
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
            <div className="font-mono text-sm font-medium text-white truncate">
              {formatAddress(address)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-cyan-400">${balance.toFixed(2)}</span>
              <span className="text-xs text-gray-500">Balance</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={copyAddress}
              className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-gray-800 transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={onDisconnect}
              className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="Disconnect"
            >
              <LogOut className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-700/50 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center border border-gray-700/50">
          <Wallet className="w-6 h-6 text-gray-400" />
        </div>

        {/* Text */}
        <div className="flex-1">
          <div className="font-medium text-white">Connect Wallet</div>
          <div className="text-xs text-gray-400">Start making calls</div>
        </div>

        {/* connect Button */}
        <Button
          onClick={handleConnect}
          isLoading={isConnecting}
          className="bg-gradient-to-r from-cyan-500 to-blue-500"
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </Button>
      </div>
    </div>
  );
}

// Wallet selector for connecting
export function WalletSelector({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (wallet: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const wallets = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      description: 'Most popular wallet',
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: '🔵',
      description: 'Easy to use',
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      icon: '🌈',
      description: 'Beautiful & simple',
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: '🛡️',
      description: 'Mobile favorite',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full mx-4 max-w-sm bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl p-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Wallet List */}
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => setSelected(wallet.id)}
              className={`
                w-full flex items-center gap-4 p-4 rounded-xl transition-all
                ${selected === wallet.id
                  ? 'bg-cyan-500/10 border-cyan-500/50 border'
                  : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/60'
                }
              `}
            >
              <span className="text-2xl">{wallet.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">{wallet.name}</div>
                <div className="text-xs text-gray-400">{wallet.description}</div>
              </div>
              {selected === wallet.id && (
                <Check className="w-5 h-5 text-cyan-400" />
              )}
            </button>
          ))}
        </div>

        {/* Security Note */}
        <div className="flex items-center gap-2 mt-6 p-3 bg-gray-800/30 rounded-xl">
          <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-xs text-gray-400">
            We never ask for your seed phrase. Always verify you're on the official site.
          </p>
        </div>

        {/* Connect Button */}
        <Button
          onClick={() => {
            if (selected) {
              onSelect(selected);
              onClose();
            }
          }}
          disabled={!selected}
          className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-500"
          size="lg"
        >
          Connect {selected ? wallets.find(w => w.id === selected)?.name : ''}
        </Button>

        <p className="text-xs text-center text-gray-500 mt-4">
          By connecting, you agree to our{' '}
          <span className="text-cyan-400 hover:underline cursor-pointer">Terms</span>
          {' '}and{' '}
          <span className="text-cyan-400 hover:underline cursor-pointer">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}

// Balance display component
export function BalanceDisplay({
  balance,
  symbol = 'USDC',
  showLabel = true,
}: {
  balance: number;
  symbol?: string;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-white">
        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {showLabel && (
        <span className="text-sm text-gray-400">{symbol}</span>
      )}
    </div>
  );
}
