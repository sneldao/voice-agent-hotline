'use client';

import { useState, useCallback } from 'react';
import { useWallet, signMessage } from './WalletContext';
import { CELO_TOKENS } from './payment-settlement';
import { validateAddress } from './address';
import { getExplorerTxUrl } from './superfluid-streaming';
import type { Address } from 'viem';

// EIP-3009 transferWithAuthorization ABI (subset for user-settled calls)
const EIP3009_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

export interface PaymentState {
  isProcessing: boolean;
  isSettled: boolean;
  isSimulated: boolean;
  mode: 'user_settled' | 'superfluid_stream' | 'yellow_channel';
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
    mode: 'user_settled',
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
      setPayment({ isProcessing: false, isSettled: false, isSimulated: false, mode: 'user_settled', error: 'Wallet not connected' });
      return { success: false, error: 'Wallet not connected' };
    }

    if (!validateAddress(agentAddress)) {
      setPayment({ isProcessing: false, isSettled: false, isSimulated: false, mode: 'user_settled', error: 'Agent payout address is not configured' });
      return { success: false, error: 'Agent payout address is not configured' };
    }

    setPayment({ isProcessing: true, isSettled: false, isSimulated: false, mode: 'user_settled', error: null });

    try {
      if (isDemoMode) {
        console.warn('[Payment] Demo mode: simulating settlement');
        await new Promise(resolve => setTimeout(resolve, 1200));
        setPayment({ isProcessing: false, isSettled: true, isSimulated: true, mode: 'user_settled', error: null });
        return { success: true, isSimulated: true };
      }

      const tokenAddress = token === 'USDC' ? CELO_TOKENS.USDC : CELO_TOKENS.cUSD;
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

      // Step 1: Sign EIP-712 transferWithAuthorization
      const domain = {
        name: token === 'USDC' ? 'USD Coin' : 'Celo Dollar',
        version: '2',
        chainId: 42220,
        verifyingContract: tokenAddress,
      };

      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      const message = {
        from: address as `0x${string}`,
        to: agentAddress as `0x${string}`,
        value: amount,
        validAfter: 0n,
        validBefore,
        nonce,
      };

      const eth = window.ethereum as unknown as { request: (args: { method: string; params?: any[] }) => Promise<any> };
      const signature = await eth.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify({ domain, types, primaryType: 'TransferWithAuthorization', message })],
      });

      const sig = (signature as string).slice(2);
      const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
      const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
      const v = parseInt(sig.slice(128, 130), 16);

      // Step 2: User submits transferWithAuthorization directly on-chain via their wallet
      const txData = encodeTransferWithAuthorization({
        from: address as `0x${string}`,
        to: agentAddress as `0x${string}`,
        value: amount,
        validAfter: 0n,
        validBefore,
        nonce,
        v,
        r,
        s,
      });

      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: tokenAddress,
          data: txData,
          value: '0x0',
        }],
      });

      // Step 3: Notify server of settlement (for tracking only)
      fetch('/api/payments/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          txHash,
          from: address,
          to: agentAddress,
          amount: amount.toString(),
          token,
          method: 'user_settled',
        }),
      }).catch(err => console.warn('[Payment] Settlement tracking failed:', err));

      const explorerUrl = getExplorerTxUrl(txHash as `0x${string}`);

      setPayment({
        isProcessing: false,
        isSettled: true,
        isSimulated: false,
        mode: 'user_settled',
        txHash: txHash as string,
        explorerUrl,
        error: null,
      });

      return { success: true, txHash: txHash as string, explorerUrl };

    } catch (err: any) {
      console.error('[Payment] Settlement error:', err);
      const msg = err.code === 4001 ? 'Transaction rejected by user' : (err.message || 'Payment failed');
      setPayment({ isProcessing: false, isSettled: false, isSimulated: false, mode: 'user_settled', error: msg });
      return { success: false, error: msg };
    }
  }, [address, isDemoMode]);

  const resetPayment = useCallback(() => {
    setPayment({ isProcessing: false, isSettled: false, isSimulated: false, mode: 'user_settled', error: null });
  }, []);

  return { payment, settlePayment, resetPayment };
}

/**
 * Encode transferWithAuthorization function call data.
 * ABI-encodes: transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)
 */
function encodeTransferWithAuthorization(params: {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}): `0x${string}` {
  const selector = '0xe3ee160e'; // transferWithAuthorization selector

  const pad32 = (hex: string): string => hex.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const pad32Num = (n: bigint): string => n.toString(16).padStart(64, '0');

  const data = [
    selector,
    pad32(params.from),
    pad32(params.to),
    pad32Num(params.value),
    pad32Num(params.validAfter),
    pad32Num(params.validBefore),
    pad32(params.nonce),
    pad32Num(BigInt(params.v)),
    pad32(params.r),
    pad32(params.s),
  ].join('');

  return `0x${data}`;
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
