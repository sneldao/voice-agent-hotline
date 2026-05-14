'use client';

import { motion } from 'framer-motion';
import { Wallet, ArrowRight, Flame } from 'lucide-react';
import { Button } from './ui/Button';
import { Mascot } from './Mascot';

interface PostCallPromptProps {
  /** Whether to show the wallet connect prompt (user doesn't have wallet) */
  showWalletPrompt: boolean;
  /** Current streak count */
  streakCount: number;
  /** Whether this was the user's first call */
  isFirstCall: boolean;
  /** Callback to connect wallet */
  onConnect: () => void;
  /** Callback to dismiss */
  onDismiss: () => void;
}

/**
 * Post-call Vox prompt shown in the CallSummary.
 * Encourages wallet connection after free calls and celebrates streaks.
 */
export function PostCallPrompt({
  showWalletPrompt,
  streakCount,
  isFirstCall,
  onConnect,
  onDismiss,
}: PostCallPromptProps) {
  if (!showWalletPrompt && streakCount <= 1 && !isFirstCall) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.5 }}
      className="rounded-2xl border border-amber-100/15 bg-gradient-to-br from-[#1a100d] to-[#120d0a] p-5 mb-6"
    >
      <div className="flex items-start gap-4">
        <Mascot
          mood={showWalletPrompt ? 'happy' : 'celebrating'}
          size={64}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          {showWalletPrompt ? (
            <>
              <h3 className="text-base font-bold text-amber-50">
                {isFirstCall ? 'Nice first call!' : 'That was great!'}
              </h3>
              <p className="mt-1 text-sm text-amber-100/60 leading-relaxed">
                Connect your Caller ID to keep your call history, unlock all agents, and build your streak.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={onConnect}
                  size="sm"
                  className="bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Get Caller ID
                </Button>
                <Button onClick={onDismiss} variant="ghost" size="sm">
                  Later
                </Button>
              </div>
            </>
          ) : streakCount > 1 ? (
            <>
              <h3 className="text-base font-bold text-amber-50 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                {streakCount}-day streak!
              </h3>
              <p className="mt-1 text-sm text-amber-100/60">
                {streakCount >= 7
                  ? "You're on fire! A whole week of voice calls."
                  : streakCount >= 3
                    ? 'Keep it going! Come back tomorrow to extend your streak.'
                    : "Nice consistency! One more day and you'll hit a 3-day streak."}
              </p>
            </>
          ) : isFirstCall ? (
            <>
              <h3 className="text-base font-bold text-amber-50">
                First call complete! 🎉
              </h3>
              <p className="mt-1 text-sm text-amber-100/60">
                Come back tomorrow to start building your streak. Daily callers unlock badges.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
