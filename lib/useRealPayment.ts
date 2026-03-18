'use client';

import { useState, useCallback } from 'react';
import { useWallet, signMessage } from './WalletContext';
import { paymentSettlement, CELO_TOKENS } from './payment-settlement';
import { validateAddress } from './address';
import type { Address } from 'viem';

export interface PaymentState {
  isProcessing: boolean;
  isSettled: boolean;
  isSimulated: boolean;
  mode: 'x402_direct' | 'superfluid_stream';
  txHash?: string;
  error: string | null;
  explorerUrl?: string;
}

export interface SettlementAttempt {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  isSimulated?: boolean;
  error?: string;
}

interface UseRealPaymentReturn {
  payment: PaymentState;
  settlePayment: (params: {
    callId: string;
    agentAddress: Address;
    amount: bigint;
    token?: 'cUSD' | 'USDC';
  }) => Promise<SettlementAttempt>;
  resetPayment: () => void;
}

export function useRealPayment(): UseRealPaymentReturn {
  const [payment, setPayment] = useState<PaymentState>({
    isProcessing: false,
    isSettled: false,
    isSimulated: false,
    mode: 'x402_direct',
    error: null,
  });

  const { address } = useWallet();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const settlePayment = useCallback(async ({
    callId,
    agentAddress,
    amount,
    token = 'cUSD',
  }: {
    callId: string;
    agentAddress: Address;
    amount: bigint;
    token?: 'cUSD' | 'USDC';
  }): Promise<SettlementAttempt> => {
    if (!address) {
      setPayment({
        isProcessing: false,
        isSettled: false,
        isSimulated: false,
        mode: 'x402_direct',
        error: 'Wallet not connected',
      });
      return { success: false, error: 'Wallet not connected' };
    }

    if (!validateAddress(agentAddress)) {
      setPayment({
        isProcessing: false,
        isSettled: false,
        isSimulated: false,
        mode: 'x402_direct',
        error: 'Agent payout address is not configured',
      });
      return { success: false, error: 'Agent payout address is not configured' };
    }

    setPayment({
      isProcessing: true,
      isSettled: false,
      isSimulated: false,
      mode: 'x402_direct',
      error: null,
    });

    try {
      // Check if facilitator wallet is configured
      if (!paymentSettlement.isConfigured()) {
        if (!isDemoMode) {
          setPayment({
            isProcessing: false,
            isSettled: false,
            isSimulated: false,
            mode: 'x402_direct',
            error: 'Settlement not configured. Set FACILITATOR_PRIVATE_KEY to enable on-chain payments.',
          });
          return {
            success: false,
            error: 'Settlement not configured. Set FACILITATOR_PRIVATE_KEY to enable on-chain payments.',
          };
        }

        // Explicit demo mode: simulate settlement without fake tx hashes
        console.warn('[Payment] Demo mode enabled: simulating settlement');
        await new Promise(resolve => setTimeout(resolve, 1200));

        setPayment({
          isProcessing: false,
          isSettled: true,
          isSimulated: true,
          mode: 'x402_direct',
          error: null,
        });

        return { success: true, isSimulated: true };
      }

      // Real on-chain settlement
      const tokenAddress = token === 'USDC' ? CELO_TOKENS.USDC : CELO_TOKENS.cUSD;

      // Create authorization (user signs)
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

      const authorization = {
        from: address as Address,
        to: agentAddress,
        value: amount,
        validAfter: 0n,
        validBefore,
        nonce,
      };

      // Sign the authorization
      const message = JSON.stringify(authorization);
      const signature = await signMessage(message);

      // Parse signature into v, r, s
      const sig = signature.slice(2);
      const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
      const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
      const v = parseInt(sig.slice(128, 130), 16);

      const signedAuthorization = {
        ...authorization,
        signature: { v, r, s },
      };

      // Call settlement API
      const response = await fetch('/api/payments/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization: signedAuthorization,
          callId,
          token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment settlement failed');
      }

      const result = await response.json();

      if (result.success) {
        setPayment({
          isProcessing: false,
          isSettled: true,
          isSimulated: false,
          mode: 'x402_direct',
          txHash: result.receipt.txHash,
          explorerUrl: result.explorerUrl,
          error: null,
        });
        return {
          success: true,
          txHash: result.receipt.txHash,
          explorerUrl: result.explorerUrl,
        };
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setPayment({
        isProcessing: false,
        isSettled: false,
        isSimulated: false,
        mode: 'x402_direct',
        error: err.message || 'Payment failed',
      });
      return { success: false, error: err.message || 'Payment failed' };
    }
  }, [address, signMessage, isDemoMode]);

  const resetPayment = useCallback(() => {
    setPayment({
      isProcessing: false,
      isSettled: false,
      isSimulated: false,
      mode: 'x402_direct',
      error: null,
    });
  }, []);

  return { payment, settlePayment, resetPayment };
}

// Hook for checking payment receipt
export function usePaymentReceipt(callId?: string) {
  const [receipt, setReceipt] = useState<{
    settled: boolean;
    txHash?: string;
    explorerUrl?: string;
    amount?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!callId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/payments/settle?callId=${callId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch receipt');
      }

      const data = await response.json();
      
      setReceipt({
        settled: data.settled,
        txHash: data.receipt?.txHash,
        explorerUrl: data.explorerUrl,
        amount: data.receipt?.amount,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  return { receipt, isLoading, error, refetch: fetchReceipt };
}
