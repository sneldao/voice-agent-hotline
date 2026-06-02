// ============================================
// useSuperfluidStreaming Hook
// ============================================
// Client-side hook for Superfluid stream management.
//
// Stream creation/deletion is signed directly by the user's connected wallet.
// Stream existence checks use public Arbitrum RPC reads, with no server key.
// ============================================

'use client';

import { useState, useCallback } from 'react';
import {
  ACTIVE_CHAIN_SF,
  CFA_V1_FORWARDER,
  CFA_V1_FORWARDER_ABI,
  SUPERFLUID_TOKEN,
  RPC_URL_SF,
  SuperfluidStreamingService,
  StreamingPaymentState,
  monthlyUsdcToTokenUnits,
} from './superfluid-streaming';
import { useWallet } from './WalletContextNew';
import { createPublicClient, encodeFunctionData, http, type Address, type Hash } from 'viem';
import { enqueueRefund } from './refundQueue';

// Shared read-only instance (public RPC, no wallet needed).
const readService = new SuperfluidStreamingService();
const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN_SF,
  transport: http(RPC_URL_SF),
});

/**
 * Optional context passed to `stopStream` so that, on terminal failure, we can
 * persist a pending-refund record (the user might still be billed on-chain).
 */
export interface StopStreamContext {
  callId?: string;
  estimatedCost?: number;
}

interface UseSuperfluidStreamingReturn extends StreamingPaymentState {
  connect: () => Promise<void>;
  startStream: (recipient: string, monthlyUSDC: number, platformAddress?: string) => Promise<Hash | null>;
  stopStream: (recipient: string, platformAddress?: string, context?: StopStreamContext) => Promise<Hash | null>;
}

const STOP_STREAM_MAX_ATTEMPTS = 3;
const STOP_STREAM_BACKOFF_MS = [0, 1500, 4000];

function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  // EIP-1193 user rejection code is 4001.
  // viem / wagmi sometimes wrap as "User rejected the request".
  return /user rejected|user denied|4001/i.test(message);
}

export function useSuperfluidStreaming(): UseSuperfluidStreamingReturn {
  const { address, connect } = useWallet();
  const [state, setState] = useState<StreamingPaymentState>({ status: 'idle' });

  // --------------------------------------------------
  // Write operations – wallet-signed direct Superfluid transactions
  // --------------------------------------------------

  const startStream = useCallback(
    async (recipient: string, monthlyUSDC: number, platformAddress?: string): Promise<Hash | null> => {
      if (!address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return null;
      }
      if (!window.ethereum) {
        setState({ status: 'error', error: 'Wallet provider not available' });
        return null;
      }

      setState({ status: 'pending' });

      try {
        const eth = window.ethereum as unknown as { request: (args: { method: string; params?: any[] }) => Promise<any> };
        const monthlyAmount = monthlyUsdcToTokenUnits(monthlyUSDC);
        const totalFlowRate = SuperfluidStreamingService.calculateFlowRate(monthlyAmount);

        // Split: 80% to agent, 20% to platform (if platform address provided)
        const agentFlowRate = platformAddress
          ? (totalFlowRate * 80n) / 100n
          : totalFlowRate;
        const platformFlowRate = platformAddress
          ? totalFlowRate - agentFlowRate
          : 0n;

        // Start agent stream (80% or 100% if no platform address)
        const existingAgent = await readService.checkStream(address as Address, recipient as Address);
        const agentFn = existingAgent.exists ? 'updateFlow' : 'createFlow';
        const agentData = encodeFunctionData({
          abi: CFA_V1_FORWARDER_ABI,
          functionName: agentFn,
          args: [SUPERFLUID_TOKEN, address as Address, recipient as Address, agentFlowRate, '0x'],
        });
        const txHash = await eth.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: CFA_V1_FORWARDER, data: agentData }],
        }) as Hash;
        await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

        // Start platform stream (20%) if address provided
        if (platformAddress && platformFlowRate > 0n) {
          const existingPlatform = await readService.checkStream(address as Address, platformAddress as Address);
          const platformFn = existingPlatform.exists ? 'updateFlow' : 'createFlow';
          const platformData = encodeFunctionData({
            abi: CFA_V1_FORWARDER_ABI,
            functionName: platformFn,
            args: [SUPERFLUID_TOKEN, address as Address, platformAddress as Address, platformFlowRate, '0x'],
          });
          // Fire-and-forget — don't block on platform stream confirmation
          void eth.request({
            method: 'eth_sendTransaction',
            params: [{ from: address, to: CFA_V1_FORWARDER, data: platformData }],
          });
        }

        setState({
          status: 'streaming',
          streamId: txHash,
          txHash,
          flowRate: agentFlowRate.toString(),
          startedAt: new Date(),
        });
        return txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream start failed';
        setState({ status: 'error', error: msg });
        return null;
      }
    },
    [address]
  );

  const stopStream = useCallback(
    async (recipient: string, platformAddress?: string, context?: StopStreamContext): Promise<Hash | null> => {
      if (!address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return null;
      }
      if (!window.ethereum) {
        setState({ status: 'error', error: 'Wallet provider not available' });
        return null;
      }

      setState(prev => ({ ...prev, status: 'pending', error: undefined }));

      const eth2 = window.ethereum as unknown as { request: (args: { method: string; params?: any[] }) => Promise<any> };

      // Short-circuit: if no stream exists, nothing to stop.
      try {
        const existing = await readService.checkStream(address as Address, recipient as Address);
        if (!existing.exists) {
          setState({ status: 'stopped', stoppedAt: new Date() });
          return null;
        }
      } catch (err) {
        // RPC blip — fall through to the retry loop below; we'll let the
        // wallet attempt the deleteFlow tx anyway.
        console.warn('[Superfluid] checkStream failed, attempting stop anyway:', err);
      }

      const agentData = encodeFunctionData({
        abi: CFA_V1_FORWARDER_ABI,
        functionName: 'deleteFlow',
        args: [SUPERFLUID_TOKEN, address as Address, recipient as Address, '0x'],
      });

      let lastError: unknown = null;
      let txHash: Hash | null = null;

      for (let attempt = 1; attempt <= STOP_STREAM_MAX_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            const delay = STOP_STREAM_BACKOFF_MS[attempt - 1] ?? 4000;
            await new Promise(resolve => setTimeout(resolve, delay));
            console.warn(`[Superfluid] Retrying stopStream (attempt ${attempt}/${STOP_STREAM_MAX_ATTEMPTS})`);
            // Before re-prompting the wallet, re-check the chain in case a
            // previous attempt actually succeeded.
            try {
              const after = await readService.checkStream(address as Address, recipient as Address);
              if (!after.exists) {
                setState({ status: 'stopped', stoppedAt: new Date() });
                return null;
              }
            } catch { /* ignore and try the tx */ }
          }

          const hash = await eth2.request({
            method: 'eth_sendTransaction',
            params: [{ from: address, to: CFA_V1_FORWARDER, data: agentData }],
          }) as Hash;
          await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
          txHash = hash;
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          // Don't retry if the user explicitly rejected the wallet prompt —
          // they get to decide whether to try again from the UI.
          if (isUserRejection(err)) break;
        }
      }

      if (!txHash) {
        const msg = lastError instanceof Error ? lastError.message : 'Stream stop failed';
        // Persist a refund-owed record so the UI can prompt the user to retry
        // and so we don't silently keep billing for an orphaned stream.
        if (context?.callId) {
          enqueueRefund({
            callId: context.callId,
            recipient,
            platformAddress,
            estimatedCost: context.estimatedCost ?? 0,
            reason: msg,
          });
        }
        setState(prev => ({ ...prev, status: 'error', error: msg }));
        return null;
      }

      // Stop platform stream (20%) if it exists. Best-effort; the agent stream
      // is the one that actually drains the user's balance.
      if (platformAddress) {
        try {
          const existingPlatform = await readService.checkStream(address as Address, platformAddress as Address);
          if (existingPlatform.exists) {
            const platformData = encodeFunctionData({
              abi: CFA_V1_FORWARDER_ABI,
              functionName: 'deleteFlow',
              args: [SUPERFLUID_TOKEN, address as Address, platformAddress as Address, '0x'],
            });
            void eth2.request({
              method: 'eth_sendTransaction',
              params: [{ from: address, to: CFA_V1_FORWARDER, data: platformData }],
            });
          }
        } catch (err) {
          console.warn('[Superfluid] platform-stream stop failed (non-fatal):', err);
        }
      }

      setState({ status: 'stopped', txHash, stoppedAt: new Date() });
      return txHash;
    },
    [address]
  );

  return {
    ...state,
    connect,
    startStream,
    stopStream,
  };
}
