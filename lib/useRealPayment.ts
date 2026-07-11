'use client';

import { useState, useCallback } from 'react';
import { apiUrl } from './api';
import { useWallet } from './WalletContextNew';
import { ARB_TOKENS, EIP712_TYPES } from './payment-settlement';
import { validateAddress } from './address';
import {
  ACTIVE_CHAIN_ID,
  ACTIVE_USDC,
  getExplorerTxUrl,
  ARB_USDC_EIP712_DOMAIN,
  ARB_USDC_EIP712_DOMAIN_SEPOLIA,
} from './arbitrum-chain';
import { splitRevenueWei, AGENT_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from './fees';
import type { Address } from 'viem';

export interface PaymentState {
  isProcessing: boolean;
  isSettled: boolean;
  mode: 'user_settled';
  txHash?: string;
  error: string | null;
  explorerUrl?: string;
  /** Gross amount settled on-chain (USDC human units) */
  amountUsdc?: number;
  /** Ledger-only agent share (not separate on-chain leg until PaymentRouter) */
  agentShareUsdc?: number;
  platformShareUsdc?: number;
  /** Single on-chain payee for this settlement */
  payee?: string;
}

export interface SettlementAttempt {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  amountUsdc?: number;
  agentShareUsdc?: number;
  platformShareUsdc?: number;
}

interface UseRealPaymentReturn {
  payment: PaymentState;
  settlePayment: (params: {
    callId: string;
    /** Preferred agent payout wallet (ledger target). On-chain payee may be platform. */
    agentAddress: Address;
    amount: bigint;
    token?: 'USDC' | 'USDT';
    agentId?: string;
  }) => Promise<SettlementAttempt>;
  resetPayment: () => void;
}

function eip712DomainForActiveChain() {
  return ACTIVE_CHAIN_ID === ARB_USDC_EIP712_DOMAIN.chainId
    ? ARB_USDC_EIP712_DOMAIN
    : ARB_USDC_EIP712_DOMAIN_SEPOLIA;
}

/**
 * Resolve the single on-chain recipient for Phase A settlement.
 * Prefer platform wallet so marketplace can ledger agent payouts;
 * fall back to agent, then env PAYMENT_RECEIVER.
 */
function resolveOnChainPayee(agentAddress: Address): Address | null {
  const platform =
    (process.env.NEXT_PUBLIC_PLATFORM_ADDRESS as Address | undefined) ||
    (process.env.NEXT_PUBLIC_PAYMENT_RECEIVER as Address | undefined);
  if (platform && validateAddress(platform)) return platform;
  if (validateAddress(agentAddress)) return agentAddress;
  return null;
}

export function useRealPayment(): UseRealPaymentReturn {
  const [payment, setPayment] = useState<PaymentState>({
    isProcessing: false,
    isSettled: false,
    mode: 'user_settled',
    error: null,
  });

  const { address } = useWallet();

  const settlePayment = useCallback(async ({
    callId,
    agentAddress,
    amount,
    token = 'USDC',
    agentId,
  }: {
    callId: string;
    agentAddress: Address;
    amount: bigint;
    token?: 'USDC' | 'USDT';
    agentId?: string;
  }): Promise<SettlementAttempt> => {
    if (!address) {
      const error = 'Wallet not connected';
      setPayment({ isProcessing: false, isSettled: false, mode: 'user_settled', error });
      return { success: false, error };
    }

    // Free / zero-cost calls: nothing to settle on-chain
    if (amount <= 0n) {
      setPayment({
        isProcessing: false,
        isSettled: true,
        mode: 'user_settled',
        error: null,
        amountUsdc: 0,
        agentShareUsdc: 0,
        platformShareUsdc: 0,
      });
      return { success: true, amountUsdc: 0, agentShareUsdc: 0, platformShareUsdc: 0 };
    }

    const payee = resolveOnChainPayee(agentAddress);
    if (!payee) {
      const error = 'No settlement payee configured (set NEXT_PUBLIC_PLATFORM_ADDRESS or agent wallet)';
      setPayment({ isProcessing: false, isSettled: false, mode: 'user_settled', error });
      return { success: false, error };
    }

    setPayment({ isProcessing: true, isSettled: false, mode: 'user_settled', error: null });

    try {
      const tokenAddress = token === 'USDC' ? ACTIVE_USDC : ARB_TOKENS.USDC;
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

      // Sign exact amount only — never mutate value/to after signing
      const domain = {
        ...eip712DomainForActiveChain(),
        verifyingContract: tokenAddress,
        chainId: ACTIVE_CHAIN_ID,
      };

      const message = {
        from: address as `0x${string}`,
        to: payee,
        value: amount.toString(),
        validAfter: '0',
        validBefore: validBefore.toString(),
        nonce,
      };

      const eth = window.ethereum as unknown as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      if (!eth?.request) {
        throw new Error('No wallet provider found. Connect a wallet that supports eth_signTypedData_v4.');
      }

      const signature = await eth.request({
        method: 'eth_signTypedData_v4',
        params: [
          address,
          JSON.stringify({
            domain: {
              name: domain.name,
              version: domain.version,
              chainId: domain.chainId,
              verifyingContract: domain.verifyingContract,
            },
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
              ],
              TransferWithAuthorization: EIP712_TYPES.TransferWithAuthorization,
            },
            primaryType: 'TransferWithAuthorization',
            message,
          }),
        ],
      });

      const sig = String(signature).slice(2);
      const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
      const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
      const v = parseInt(sig.slice(128, 130), 16);

      const txData = encodeTransferWithAuthorization({
        from: address as `0x${string}`,
        to: payee,
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
      }) as string;

      if (!txHash || !String(txHash).startsWith('0x')) {
        throw new Error('Wallet did not return a transaction hash');
      }

      const { agentShare, platformShare } = splitRevenueWei(amount);
      const amountUsdc = Number(amount) / 1e6;
      const agentShareUsdc = Number(agentShare) / 1e6;
      const platformShareUsdc = Number(platformShare) / 1e6;

      // Mirror only — not proof of settlement. Chain tx is source of truth.
      // Sign auth message for the tracking endpoint
      const authTimestamp = Math.floor(Date.now() / 1000).toString();
      const authMessage = `VOISSS auth: ${address.toLowerCase()} at ${authTimestamp}`;
      let authSignature = '';
      try {
        authSignature = await eth.request({
          method: 'personal_sign',
          params: [authMessage, address],
        }) as string;
      } catch {
        // If auth signing fails, still try to post — server will reject if auth is required
      }

      const settleHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authSignature) {
        settleHeaders['X-Wallet-Address'] = address as string;
        settleHeaders['X-Signature'] = authSignature;
        settleHeaders['X-Timestamp'] = authTimestamp;
      }

      fetch(apiUrl('/api/payments/settle'), {
        method: 'POST',
        headers: settleHeaders,
        body: JSON.stringify({
          callId,
          txHash,
          from: address,
          to: payee,
          amount: amount.toString(),
          amountUsdc,
          agentShareUsdc,
          platformShareUsdc,
          agentWallet: validateAddress(agentAddress) ? agentAddress : '',
          agentId: agentId || '',
          token,
          method: 'user_settled',
          splitMode: 'ledger', // on-chain split requires PaymentRouter
          agentSharePercent: AGENT_SHARE_PERCENT,
          platformSharePercent: PLATFORM_SHARE_PERCENT,
        }),
      }).catch(err => console.warn('[Payment] Settlement tracking failed:', err));

      const explorerUrl = getExplorerTxUrl(txHash);

      setPayment({
        isProcessing: false,
        isSettled: true,
        mode: 'user_settled',
        txHash,
        explorerUrl,
        error: null,
        amountUsdc,
        agentShareUsdc,
        platformShareUsdc,
        payee,
      });

      return {
        success: true,
        txHash,
        explorerUrl,
        amountUsdc,
        agentShareUsdc,
        platformShareUsdc,
      };
    } catch (err: unknown) {
      console.error('[Payment] Settlement error:', err);
      const e = err as { code?: number; message?: string };
      const msg = e.code === 4001 ? 'Transaction rejected by user' : (e.message || 'Payment failed');
      setPayment({ isProcessing: false, isSettled: false, mode: 'user_settled', error: msg });
      return { success: false, error: msg };
    }
  }, [address]);

  const resetPayment = useCallback(() => {
    setPayment({ isProcessing: false, isSettled: false, mode: 'user_settled', error: null });
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

  return data as `0x${string}`;
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
      const response = await fetch(apiUrl(`/api/payments/settle?callId=${callId}`));

      if (!response.ok) {
        throw new Error('Failed to fetch receipt');
      }

      const data = await response.json();

      setReceipt({
        settled: data.settled,
        txHash: data.receipt?.txHash,
        explorerUrl: data.explorerUrl,
        amount: data.receipt?.amountUsdc || data.receipt?.amount,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch receipt');
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  return { receipt, isLoading, error, refetch: fetchReceipt };
}
