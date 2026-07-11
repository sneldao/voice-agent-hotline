'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContextNew';
import { showSuccess, showError, showCopied } from '@/lib/useToast';
import { ACTIVE_CHAIN_ID } from '@/lib/arbitrum-chain';

interface WalletConnectProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const { connected, address, chainId, balance, isConnecting, walletType, connect, disconnect, formatAddress } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const handleCopyAddress = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      showCopied();
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    onDisconnect?.();
  }, [disconnect, onDisconnect]);

  const handleConnect = useCallback(async () => {
    setShowWalletSelector(true);
  }, []);

  const handleWalletSelect = useCallback(async (walletId: string) => {
    setShowWalletSelector(false);
    try {
      await connect();
      onConnect?.();
    } catch (error) {
      console.error('Connection failed:', error);
      showError('Failed to connect wallet');
    }
  }, [connect, onConnect]);

  const isCorrectNetwork = chainId === ACTIVE_CHAIN_ID;

  const getWalletIcon = (type: string | null) => {
    switch (type) {
      case 'metamask':
        return '🦊';
      case 'walletconnect':
        return '🔗';
      default:
        return '👛';
    }
  };

  const getWalletName = (type: string | null) => {
    switch (type) {
      case 'metamask':
        return 'MetaMask';
      case 'walletconnect':
        return 'WalletConnect';
      default:
        return 'Wallet';
    }
  };

  if (connected && address) {
    return (
      <div className="p-4 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Wallet Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <span className="text-2xl">{getWalletIcon(walletType)}</span>
          </div>

          {/* Address & Chain */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {isCorrectNetwork ? 'Arbitrum' : 'Wrong Network'}
              </span>
              <span className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div className="font-mono text-sm font-medium text-white truncate">
              {formatAddress()}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{getWalletName(walletType)}</span>
              {balance && (
                <span>• {parseFloat(balance).toFixed(4)} ETH</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAddress}
              className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-gray-800 transition-colors"
              title="Copy address"
            >
              {copied ? (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleDisconnect}
              className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="Disconnect"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Wrong Network Warning */}
        {!isCorrectNetwork && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400 text-center">
              Please switch to Arbitrum (chain ID: {ACTIVE_CHAIN_ID})
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="p-4 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center border border-gray-700/50">
            <span className="text-2xl">👛</span>
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="font-medium text-white">Connect Wallet</div>
            <div className="text-xs text-gray-400">MetaMask, Rainbow, Coinbase & more</div>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        {/* Security Note */}
        <div className="mt-3 flex items-center gap-2 p-2 bg-gray-800/30 rounded-lg">
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-xs text-gray-400">
            Connected directly to your wallet. We never see your private keys.
          </p>
        </div>
      </div>

      {/* Wallet Selector Modal */}
      <WalletSelector
        isOpen={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
        onSelect={handleWalletSelect}
      />
    </>
  );
}

// Wallet selector modal
export function WalletSelector({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (walletId: string) => void;
}) {
  const wallets = [
    { id: 'metamask', name: 'MetaMask', icon: '🦊', desc: 'Most popular browser wallet' },
    { id: 'rainbow', name: 'Rainbow', icon: '🌈', desc: 'Beautiful mobile wallet' },
    { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', desc: 'Easy to use, backed by Coinbase' },
    { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', desc: 'Scan QR code with any wallet' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full mx-4 max-w-sm bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Wallet List */}
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => { onSelect(wallet.id); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/60 transition-all border border-transparent hover:border-cyan-500/30"
            >
              <span className="text-2xl">{wallet.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">{wallet.name}</div>
                <div className="text-xs text-gray-400">{wallet.desc}</div>
              </div>
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
          <p className="text-xs text-cyan-300 text-center">
            For the best experience, we recommend using MetaMask or Rainbow.
            All wallets support WalletConnect protocol.
          </p>
        </div>

        {/* Terms */}
        <p className="text-xs text-center text-gray-500 mt-4">
          By connecting, you agree to our Terms and Privacy Policy
        </p>
      </div>
    </div>
  );
}

// Balance display
export function BalanceDisplay({
  balance,
  symbol = 'USDC',
}: {
  balance: number;
  symbol?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-white">
        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className="text-sm text-gray-400">{symbol}</span>
    </div>
  );
}
