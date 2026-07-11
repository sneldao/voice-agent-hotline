'use client';

import { User, Wallet, LogOut, ExternalLink, Flame, Trophy, Phone, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProfileSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { Button, Card, Avatar } from '@/components/ui';
import { DelegationPanel } from '@/components/DelegationPanel';
import { useStreak } from '@/lib/useStreak';
import type { UseCase } from '@/lib/useOnboarding';
import { USE_CASES } from '@/lib/useOnboarding';

interface ProfileTabProps {
  balance: number;
  address?: string | null;
  isLoading?: boolean;
  onDisconnect?: () => void;
  /** Currently selected use-case for agent personalization */
  selectedUseCase?: UseCase | null;
  /** Callback to change the use-case preference */
  onSetUseCase?: (useCase: UseCase) => void;
  /** Total USDC spent across calls with real receipts where available */
  totalSpent?: number;
}

export function ProfileTab({ balance, address, isLoading, onDisconnect, selectedUseCase, onSetUseCase, totalSpent = 0 }: ProfileTabProps) {
  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'Not connected';
  const streak = useStreak();

  if (isLoading) return <ProfileSkeleton />;

  if (!address) {
    return (
      <EmptyState
        type="calls"
        title="Wallet Not Connected"
        description="Connect your wallet to view your profile and balance"
      />
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar size="xl" online={!!address} className="bg-gradient-to-br from-cyan-500 to-blue-500">
          <User className="w-8 h-8" />
        </Avatar>
        <div>
          <h2 className="text-xl font-bold font-mono">{displayAddress}</h2>
          <button
            onClick={() => navigator.clipboard?.writeText(address)}
            className="text-xs text-amber-100/50 hover:text-amber-300 transition-colors"
          >
            Copy full address
          </button>
        </div>
      </div>

      {/* Your Interests — use-case preferences for personalization */}
      {onSetUseCase && (
        <div className="rounded-xl border border-amber-100/12 bg-gradient-to-br from-[#17100d] to-[#1f1611] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h3 className="text-sm font-bold text-amber-50">Your Interests</h3>
            <p className="text-[10px] text-amber-100/35 ml-auto">Personalizes agent recommendations</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {USE_CASES.map((uc) => {
              const isSelected = selectedUseCase === uc.id;
              return (
                <motion.button
                  key={uc.id}
                  type="button"
                  onClick={() => onSetUseCase(uc.id)}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                    isSelected
                      ? 'border-red-500/45 bg-red-500/12 shadow-sm shadow-red-500/8'
                      : 'border-amber-100/8 bg-amber-100/[0.02] hover:border-amber-100/20 hover:bg-amber-100/[0.05]'
                  }`}
                >
                  <span className="text-base">{uc.emoji}</span>
                  <span className="text-[11px] font-semibold text-amber-50 truncate">{uc.label}</span>
                </motion.button>
              );
            })}
          </div>
          {selectedUseCase && (
            <p className="mt-2 text-[10px] text-emerald-400/70 text-center">
              ✓ Personalized — agents are sorted to match your interests
            </p>
          )}
        </div>
      )}

      {/* Arbitrum On-Chain Stats */}
      {totalSpent > 0 && (
        <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-900/15 to-blue-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">⬡</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Arbitrum Network</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-cyan-200/50 uppercase tracking-wide">Total spent</p>
              <p className="text-lg font-bold text-cyan-200">${totalSpent.toFixed(2)}</p>
              <p className="text-[10px] text-cyan-200/30">USDC on voice calls</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-cyan-200/50 uppercase tracking-wide">Network</p>
              <p className="text-lg font-bold text-cyan-200">
                {process.env.NEXT_PUBLIC_ARBITRUM_CHAIN_ID === '421614' ? 'Arbitrum Testnet' : 'Arbitrum'}
              </p>
              <p className="text-[10px] text-cyan-200/30">x402 micropayments</p>
            </div>
          </div>
        </div>
      )}

      {/* Streak & Stats Card */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-100/15 bg-amber-100/5 p-4 text-center">
          <Flame className={`w-6 h-6 mx-auto mb-1 ${streak.currentStreak > 0 ? 'text-orange-400' : 'text-gray-600'}`} />
          <p className="text-2xl font-bold text-amber-50">{streak.currentStreak}</p>
          <p className="text-[10px] text-amber-100/45 uppercase tracking-wide">day streak</p>
        </div>
        <div className="rounded-xl border border-amber-100/15 bg-amber-100/5 p-4 text-center">
          <Phone className="w-6 h-6 mx-auto mb-1 text-cyan-400" />
          <p className="text-2xl font-bold text-amber-50">{streak.totalCalls}</p>
          <p className="text-[10px] text-amber-100/45 uppercase tracking-wide">total calls</p>
        </div>
        <div className="rounded-xl border border-amber-100/15 bg-amber-100/5 p-4 text-center">
          <Trophy className="w-6 h-6 mx-auto mb-1 text-amber-400" />
          <p className="text-2xl font-bold text-amber-50">{streak.longestStreak}</p>
          <p className="text-[10px] text-amber-100/45 uppercase tracking-wide">best streak</p>
        </div>
      </div>

      {/* Streak status message */}
      {streak.streakAtRisk && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <p className="text-sm text-orange-200">Your streak is at risk! Make a call today to keep it alive.</p>
        </div>
      )}
      {streak.calledToday && streak.currentStreak > 1 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-3">
          <Flame className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-200">🔥 {streak.currentStreak}-day streak! Come back tomorrow to keep it going.</p>
        </div>
      )}

      {/* Balance Card */}
      <Card variant="gradient" className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20" />
          <div className="relative p-6">
            <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
              <Wallet className="w-4 h-4" /> Balance
            </div>
            <div className="text-4xl font-bold text-white mb-4">${(balance || 0).toFixed(2)}</div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 bg-white/10 border-white/20 hover:bg-white/20"
                onClick={() => window.open('https://app.uniswap.org/#/swap?outputCurrency=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&chain=arbitrum', '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Add Funds
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Delegation Panel */}
      <DelegationPanel />

      {/* Disconnect */}
      {onDisconnect && (
        <Button
          variant="ghost"
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={onDisconnect}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect Wallet
        </Button>
      )}
    </div>
  );
}
