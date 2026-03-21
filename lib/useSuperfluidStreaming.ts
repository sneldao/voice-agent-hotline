// ============================================
// useSuperfluidStreaming Hook
// ============================================
// Client-side hook for Superfluid stream management.
//
// Stream creation/deletion is signed directly by the user's connected wallet.
// Stream existence checks use public Celo RPC reads, with no server key.
// ============================================

'use client';

import { useState, useCallback } from 'react';
import {
  ACTIVE_CHAIN,
  CFA_V1_FORWARDER,
  CFA_V1_FORWARDER_ABI,
  SUPERFLUID_TOKEN,
  RPC_URL,
  SuperfluidStreamingService,
  StreamingPaymentState,
  monthlyUsdcToTokenUnits,
} from './superfluid-streaming';
import { useWallet } from './WalletContextNew';
import { createPublicClient, encodeFunctionData, http, type Address, type Hash } from 'viem';

// Shared read-only instance (public RPC, no wallet needed).
const readService = new SuperfluidStreamingService();
const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(RPC_URL),
});

interface UseSuperfluidStreamingReturn extends StreamingPaymentState {
  connect: () => Promise<void>;
  startStream: (recipient: string, monthlyUSDC: number) => Promise<Hash | null>;
  stopStream: (recipient: string) => Promise<Hash | null>;
}

export function useSuperfluidStreaming(): UseSuperfluidStreamingReturn {
  const { address, connect } = useWallet();
  const [state, setState] = useState<StreamingPaymentState>({ status: 'idle' });

  // --------------------------------------------------
  // Write operations – wallet-signed direct Superfluid transactions
  // --------------------------------------------------

  const startStream = useCallback(
    async (recipient: string, monthlyUSDC: number): Promise<Hash | null> => {
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
        const monthlyAmount = monthlyUsdcToTokenUnits(monthlyUSDC);
        const flowRate = SuperfluidStreamingService.calculateFlowRate(monthlyAmount);
        const existing = await readService.checkStream(address as Address, recipient as Address);
        const functionName = existing.exists ? 'updateFlow' : 'createFlow';
        const data = encodeFunctionData({
          abi: CFA_V1_FORWARDER_ABI,
          functionName,
          args: [SUPERFLUID_TOKEN, address as Address, recipient as Address, flowRate, '0x'],
        });
        const eth = window.ethereum as unknown as { request: (args: { method: string; params?: any[] }) => Promise<any> };
        const txHash = await eth.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: CFA_V1_FORWARDER,
            data,
          }],
        }) as Hash;
        await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

        setState({
          status: 'streaming',
          streamId: txHash,
          txHash,
          flowRate: flowRate.toString(),
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
    async (recipient: string): Promise<Hash | null> => {
      if (!address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return null;
      }
      if (!window.ethereum) {
        setState({ status: 'error', error: 'Wallet provider not available' });
        return null;
      }

      setState(prev => ({ ...prev, status: 'pending', error: undefined }));

      try {
        const existing = await readService.checkStream(address as Address, recipient as Address);
        if (!existing.exists) {
          setState({ status: 'stopped', stoppedAt: new Date() });
          return null;
        }

        const data = encodeFunctionData({
          abi: CFA_V1_FORWARDER_ABI,
          functionName: 'deleteFlow',
          args: [SUPERFLUID_TOKEN, address as Address, recipient as Address, '0x'],
        });
        const eth2 = window.ethereum as unknown as { request: (args: { method: string; params?: any[] }) => Promise<any> };
        const txHash = await eth2.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: CFA_V1_FORWARDER,
            data,
          }],
        }) as Hash;
        await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

        setState({ status: 'stopped', txHash, stoppedAt: new Date() });
        return txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream stop failed';
        setState(prev => ({ ...prev, status: 'error', error: msg }));
        return null;
      }
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
