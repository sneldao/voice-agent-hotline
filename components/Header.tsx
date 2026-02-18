'use client';

import { Phone, Wallet, Bell, Info } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface HeaderProps {
  connected: boolean;
  userBalance: number;
  isConnecting: boolean;
  formatAddress: () => string;
  onConnect: () => void;
}

export function Header({
  connected,
  userBalance,
  isConnecting,
  formatAddress,
  onConnect,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50" role="banner">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25" role="img" aria-label="Voice Hotline logo">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg">Voice Hotline</h1>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-[10px] font-bold text-white">
                💰 REAL-WORLD PAYMENTS
              </span>
            </div>
            <p className="text-xs text-gray-500">AI-Powered Voice Agents</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2" role="group" aria-label="User wallet and notifications">
          {connected ? (
            <Tooltip content={`Balance: $${(userBalance || 0).toFixed(2)} • First minute free on all calls`} position="bottom">
              <div className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center gap-2 cursor-help">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-400">${(userBalance || 0).toFixed(2)}</span>
                <span className="text-xs text-gray-500">{formatAddress()}</span>
              </div>
            </Tooltip>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="px-4 py-1.5 rounded-full bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
          <Tooltip content="Notifications" position="bottom">
            <button
              className="w-10 h-10 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center hover:bg-gray-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-400" />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
