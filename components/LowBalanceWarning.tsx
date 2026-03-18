'use client';

import { AlertCircle, Wallet, X } from 'lucide-react';
import { Button } from './ui/Button';

interface LowBalanceWarningProps {
  isOpen: boolean;
  balance: number;
  requiredAmount: number;
  title?: string;
  description?: string;
  balanceLabel?: string;
  requiredLabel?: string;
  assetSymbol?: string;
  onAddFunds: () => void;
  onClose: () => void;
  onGoHome: () => void;
}

export function LowBalanceWarning({ 
  isOpen, 
  balance, 
  requiredAmount, 
  title = 'Insufficient Balance',
  description = 'Add funds to your wallet to continue with this call. Your balance is too low to cover the estimated cost.',
  balanceLabel = 'Current Balance',
  requiredLabel = 'Required',
  assetSymbol,
  onAddFunds, 
  onClose,
  onGoHome 
}: LowBalanceWarningProps) {
  if (!isOpen) return null;

  const shortfall = requiredAmount - balance;
  const formatAmount = (amount: number) => assetSymbol
    ? `${amount.toFixed(2)} ${assetSymbol}`
    : `$${amount.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl animate-scaleUp">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-2">
            {title}
          </h2>

          {/* Balance Info */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">{balanceLabel}</span>
              <span className="text-lg font-bold text-red-400">{formatAmount(balance)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">{requiredLabel}</span>
              <span className="text-lg font-bold text-white">{formatAmount(requiredAmount)}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Shortfall</span>
                <span className="text-lg font-bold text-orange-400">{formatAmount(shortfall)}</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-400 mb-6">
            {description}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={onAddFunds}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold py-3"
            >
              <Wallet className="w-5 h-5 mr-2" />
              Add Funds
            </Button>
            
            <Button
              onClick={onGoHome}
              variant="secondary"
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 border border-gray-700"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
