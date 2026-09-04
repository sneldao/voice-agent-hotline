'use client';

import { useState, useRef, useEffect } from 'react';
import { PhoneCall, Wallet, LogOut, ChevronDown, Radio, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  connected: boolean;
  userBalance: number;
  isConnecting: boolean;
  formatAddress: () => string;
  onConnect: () => void;
  onDisconnect?: () => void;
  /** Navigate to the Profile tab (used by the Interests dropdown item) */
  onNavigateToProfile?: () => void;
}

export function Header({
  connected,
  userBalance,
  isConnecting,
  formatAddress,
  onConnect,
  onDisconnect,
  onNavigateToProfile,
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
    <header className="sticky top-0 z-50 border-b border-amber-100/15 bg-[#120d0a]/88 backdrop-blur-xl" role="banner">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="signal-scan flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100/25 bg-red-950/50 shadow-lg shadow-red-950/30" role="img" aria-label="Claflin logo">
            <PhoneCall className="h-5 w-5 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-amber-50">Claflin</h1>
              {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                  Demo
                </span>
              )}
              {process.env.NEXT_PUBLIC_ARBITRUM_CHAIN_ID === '421614' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' && (
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
                  Testnet
                </span>
              )}
            </div>
            <p className="hidden text-xs text-amber-100/45 sm:flex sm:items-center sm:gap-1.5">
              <Radio className="h-3 w-3 text-emerald-300" />
              Your broker is on the line
                </p>
              </div>
            </div>

        {/* Wallet */}
        <div className="flex items-center gap-2" role="group" aria-label="User wallet">
          {connected ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(prev => !prev)}
                className="flex items-center gap-2 rounded-full border border-amber-100/20 bg-black/25 px-3 py-1.5 transition-colors hover:bg-amber-100/10"
                aria-label="Wallet menu"
              >
                <Wallet className="h-4 w-4 text-amber-200" />
                <span className="text-xs text-amber-100/65">{formatAddress()}</span>
                <ChevronDown className="h-3 w-3 text-amber-100/40" />
              </button>
              {showMenu && (
                <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-amber-100/20 bg-[#17100d] shadow-xl">
                  <div className="border-b border-amber-100/10 px-3 py-2">
                    <p className="text-xs text-amber-100/45">Balance</p>
                    <p className="text-sm font-medium text-amber-200">${(userBalance || 0).toFixed(2)}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setShowMenu(false)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-amber-100/70 transition-colors hover:bg-amber-100/10"
                  >
                    📊 Dashboard
                  </Link>
                  <Link
                    href="/list-your-broker"
                    onClick={() => setShowMenu(false)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-amber-100/70 transition-colors hover:bg-amber-100/10"
                  >
                    🎙️ List Broker
                  </Link>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onNavigateToProfile?.();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-amber-100/70 transition-colors hover:bg-amber-100/10"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Interests
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); onDisconnect?.(); }}
                    className="flex w-full items-center gap-2 border-t border-amber-100/10 px-3 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
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
              className="rounded-full border border-amber-100/20 bg-black/25 px-3 py-1.5 text-xs font-bold text-amber-100/65 transition-colors hover:bg-amber-100/10 hover:text-amber-50 disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Sign In'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
