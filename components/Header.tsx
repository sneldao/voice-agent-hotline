'use client';

import { useState, useRef, useEffect } from 'react';
import { Phone, Wallet, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  connected: boolean;
  userBalance: number;
  isConnecting: boolean;
  formatAddress: () => string;
  onConnect: () => void;
  onDisconnect?: () => void;
}

export function Header({
  connected,
  userBalance,
  isConnecting,
  formatAddress,
  onConnect,
  onDisconnect,
}: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50" role="banner">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25" role="img" aria-label="VOISSS logo">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">VOISSS</h1>
            <p className="text-xs text-gray-500">Voice AI agents · Powered by ElevenLabs</p>
          </div>
        </div>

        {/* Wallet */}
        <div className="flex items-center gap-2" role="group" aria-label="User wallet">
          {connected ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(prev => !prev)}
                className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center gap-2 hover:bg-gray-800 transition-colors"
                aria-label="Wallet menu"
              >
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-gray-400">{formatAddress()}</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl bg-gray-900 border border-gray-700/50 shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-800">
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="text-sm font-medium text-cyan-400">${(userBalance || 0).toFixed(2)}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    📊 Dashboard
                  </Link>
                  <button
                    onClick={() => { setShowMenu(false); onDisconnect?.(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors border-t border-gray-800"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 text-gray-400 text-xs font-medium hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
