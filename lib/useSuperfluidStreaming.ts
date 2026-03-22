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
  startStream: (recipient: string, monthlyUSDC: number, platformAddress?: string) => Promise<Hash | null>;
  stopStream: (recipient: string, platformAddress?: string) => Promise<Hash | null>;
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
    async (recipient: string, platformAddress?: string): Promise<Hash | null> => {
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

        const eth2 = window.ethereum as unknown as { request: (args: { method: string; params?: any[] }) => Promise<any> };
        const agentData = encodeFunctionData({
          abi: CFA_V1_FORWARDER_ABI,
          functionName: 'deleteFlow',
          args: [SUPERFLUID_TOKEN, address as Address, recipient as Address, '0x'],
        });
        const txHash = await eth2.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: CFA_V1_FORWARDER, data: agentData }],
        }) as Hash;
        await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

        // Stop platform stream (20%) if it exists
        if (platformAddress) {
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
        }

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
