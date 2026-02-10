'use client';

import { useState, useCallback } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { 
  CreditCard, 
  Wallet, 
  Check, 
  X, 
  Clock, 
  Zap,
  Shield,
  AlertCircle
} from './Toast';
import { showSuccess, showError, showWarning } from '@/lib/useToast';

// x402 Payment State
interface PaymentState {
  authorized: boolean;
  amount: number;
  balance: number;
  perSecondRate: number; // in cents
}

interface PaymentFlowProps {
  amount: number;           // Total call cost
  perMinuteRate: number;    // Rate per minute in cents
  onPaymentAuthorize: () => void;
  onPaymentComplete: () => void;
  onError: (error: string) => void;
}

export function PaymentFlow({ 
  amount, 
  perMinuteRate, 
  onPaymentAuthorize, 
  onPaymentComplete,
  onError 
}: PaymentFlowProps) {
  const [state, setState] = useState<PaymentState>({
    authorized: false,
    amount: 0,
    balance: 2.50, // Demo balance
    perSecondRate: perMinuteRate / 60,
  });
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Authorize payment for the call
  const handleAuthorize = useCallback(async () => {
    setIsAuthorizing(true);
    
    try {
      // In production, this would be a real x402 request
      // x402://{payer}/{amount}
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API
      
      // Demo: authorize for expected amount
      setState(prev => ({
        ...prev,
        authorized: true,
        amount: amount,
      }));
      
      showSuccess('Payment authorized!');
      onPaymentAuthorize();
    } catch (err) {
      showError('Payment authorization failed');
      onError('Failed to authorize payment');
    } finally {
      setIsAuthorizing(false);
    }
  }, [amount, onPaymentAuthorize, onError]);

  // Complete payment after call
  const handleComplete = useCallback(async () => {
    try {
      // Calculate actual time and finalize payment
      const actualCost = state.amount; // In production, calculate from call duration
      
      // x402 settlement
      // await x402.settle(paymentId, actualCost)
      
      showSuccess(`Payment complete: $${(actualCost / 100).toFixed(2)}`);
      onPaymentComplete();
      
      setState(prev => ({
        ...prev,
        authorized: false,
        amount: 0,
        balance: prev.balance - actualCost,
      }));
    } catch (err) {
      showError('Settlement failed');
    }
  }, [state.amount, onPaymentComplete]);

  // Add funds
  const handleAddFunds = useCallback(async () => {
    const TOP_UP_AMOUNT = 5.00; // $5
    
    try {
      // In production: x402.deposit({ amount: TOP_UP_AMOUNT })
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setState(prev => ({
        ...prev,
        balance: prev.balance + TOP_UP_AMOUNT,
      }));
      
      showSuccess(`Added $${TOP_UP_AMOUNT.toFixed(2)} to balance`);
    } catch (err) {
      showError('Top-up failed');
    }
  }, []);

  // Per-second billing display
  const getPerSecondRate = () => {
    const rate = state.perSecondRate;
    return `$${(rate / 100).toFixed(4)}/sec`;
  };

  const getPerMinuteRate = () => {
    const rate = perMinuteRate;
    return `$${(rate / 100).toFixed(2)}/min`;
  };

  // Not authorized yet - show payment form
  if (!state.authorized) {
    return (
      <div className="space-y-4">
        {/* Payment Authorization Card */}
        <Card className="p-6 bg-gradient-to-br from-gray-800/80 to-gray-900/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Authorize Payment</h3>
              <p className="text-sm text-gray-400">x402 micropayments</p>
            </div>
          </div>

          {/* Rate Info */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">Per-second billing</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-cyan-400">{getPerSecondRate()}</span>
              <span className="text-xs text-gray-500 block">({getPerMinuteRate()})</span>
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">Current Balance</span>
            </div>
            <span className="text-lg font-bold text-white">${state.balance.toFixed(2)}</span>
          </div>

          {/* Insufficient balance warning */}
          {state.balance < amount && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-300">
                Insufficient balance. Add funds to continue.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleAddFunds}
              className="flex-1"
            >
              <Zap className="w-4 h-4 mr-2" />
              Add $5
            </Button>
            <Button
              onClick={handleAuthorize}
              isLoading={isAuthorizing}
              disabled={state.balance < amount}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              {isAuthorizing ? 'Authorizing...' : 'Authorize'}
            </Button>
          </div>
        </Card>

        {/* Security Note */}
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <Shield className="w-4 h-4 text-green-400" />
          <p className="text-xs text-gray-400">
            Payments are secured by x402 protocol. You're only charged for time used.
          </p>
        </div>
      </div>
    );
  }

  // Authorized - show call in progress
  return (
    <Card className="p-4 bg-gradient-to-r from-green-500/10 to-cyan-500/10 border-green-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
            <Check className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-400">Payment Authorized</p>
            <p className="text-xs text-gray-400">
              {getPerSecondRate()} • Up to ${(amount / 100).toFixed(2)}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={handleComplete}
          size="sm"
        >
          End Call
        </Button>
      </div>
    </Card>
  );
}

// Delegation Payment with Approval Flow
interface DelegationPaymentProps {
  action: string;           // "Book appointment"
  amount: number;            // Estimated cost
  maxAmount: number;         // User's spending limit
  onApprove: () => void;
  onDeny: () => void;
}

export function DelegationPayment({
  action,
  amount,
  maxAmount,
  onApprove,
  onDeny,
}: DelegationPaymentProps) {
  const [approved, setApproved] = useState(false);

  const handleApprove = () => {
    setApproved(true);
    onApprove();
  };

  if (approved) {
    return (
      <Card className="p-4 bg-green-500/10 border-green-500/30">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-400">Approved</p>
            <p className="text-xs text-gray-400">Agent can proceed with: {action}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
      <div className="flex items-center gap-3 mb-3">
        <Shield className="w-5 h-5 text-yellow-400" />
        <div>
          <p className="text-sm font-medium text-yellow-400">Action Requires Approval</p>
          <p className="text-xs text-gray-400">{action}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg mb-3">
        <span className="text-sm text-gray-400">Estimated cost</span>
        <span className="font-bold text-white">${(amount / 100).toFixed(2)}</span>
      </div>

      {amount > maxAmount && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-xs text-red-300">
            Exceeds your ${(maxAmount / 100).toFixed(2)} limit
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={onDeny}
          className="flex-1"
        >
          <X className="w-4 h-4 mr-2" />
          Deny
        </Button>
        <Button
          onClick={handleApprove}
          disabled={amount > maxAmount}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
        >
          <Check className="w-4 h-4 mr-2" />
          Approve
        </Button>
      </div>
    </Card>
  );
}
