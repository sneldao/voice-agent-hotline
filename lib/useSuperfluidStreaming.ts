// ============================================
// useSuperfluidStreaming Hook
// ============================================
// Client-side hook for Superfluid stream management.
//
// Read operations (checkStream, getNetFlowRate) are executed directly via
// the public Celo RPC – no server key required.
//
// Write operations (start / update / stop stream) are routed through server
// API endpoints so that the FACILITATOR_PRIVATE_KEY never reaches the client.
// ============================================

'use client';

import { useState, useCallback } from 'react';
import {
  SuperfluidStreamingService,
  StreamingPaymentState,
  StreamInfo,
  monthlyUsdcToTokenUnits,
} from './superfluid-streaming';
import { useWallet } from './WalletContext';

// Shared read-only instance (public RPC, no wallet needed).
const readService = new SuperfluidStreamingService();

interface UseSuperfluidStreamingReturn extends StreamingPaymentState {
  connect: () => Promise<void>;
  startStream: (recipient: string, monthlyUSDC: number) => Promise<boolean>;
  updateStream: (recipient: string, monthlyUSDC: number) => Promise<boolean>;
  stopStream: (recipient: string) => Promise<boolean>;
  checkStream: (recipient: string) => Promise<StreamInfo>;
  getNetFlowRate: () => Promise<string>;
  /** One-time ACL grant so the facilitator can manage streams on behalf of this user. */
  grantPermissions: (facilitatorAddress: string) => Promise<boolean>;
}

export function useSuperfluidStreaming(): UseSuperfluidStreamingReturn {
  const { address, connect } = useWallet();
  const [state, setState] = useState<StreamingPaymentState>({ status: 'idle' });

  // --------------------------------------------------
  // Write operations – delegated to server API
  // The server uses FACILITATOR_PRIVATE_KEY to pay gas.
  // --------------------------------------------------

  const startStream = useCallback(
    async (recipient: string, monthlyUSDC: number): Promise<boolean> => {
      if (!address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return false;
      }

      setState({ status: 'pending' });

      try {
        const res = await fetch('/api/streaming/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: address,
            recipient,
            monthlyAmount: monthlyUsdcToTokenUnits(monthlyUSDC),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setState({ status: 'error', error: data.error || 'Stream start failed' });
          return false;
        }

        setState({
          status: 'streaming',
          streamId: data.streamId,
          flowRate: data.flowRate,
          startedAt: new Date(),
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream start failed';
        setState({ status: 'error', error: msg });
        return false;
      }
    },
    [address]
  );

  const updateStream = useCallback(
    async (recipient: string, monthlyUSDC: number): Promise<boolean> => {
      if (!address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return false;
      }

      try {
        const res = await fetch('/api/streaming/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: address,
            recipient,
            monthlyAmount: monthlyUsdcToTokenUnits(monthlyUSDC),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setState(prev => ({ ...prev, status: 'error', error: data.error }));
          return false;
        }

        setState(prev => ({ ...prev, status: 'streaming', flowRate: data.flowRate }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream update failed';
        setState(prev => ({ ...prev, status: 'error', error: msg }));
        return false;
      }
    },
    [address]
  );

  const stopStream = useCallback(
    async (recipient: string): Promise<boolean> => {
      if (!address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return false;
      }

      try {
        const res = await fetch('/api/streaming/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: address, recipient }),
        });

        const data = await res.json();
        if (!res.ok) {
          setState(prev => ({ ...prev, status: 'error', error: data.error }));
          return false;
        }

        setState({ status: 'stopped', stoppedAt: new Date() });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream stop failed';
        setState(prev => ({ ...prev, status: 'error', error: msg }));
        return false;
      }
    },
    [address]
  );

  // --------------------------------------------------
  // Read operations – public RPC, no server call needed
  // --------------------------------------------------

  const checkStream = useCallback(
    async (recipient: string): Promise<StreamInfo> => {
      if (!address) {
        return { exists: false, currentFlowRate: '0', deposit: '0', owedDeposit: '0' };
      }
      return readService.checkStream(address as `0x${string}`, recipient as `0x${string}`);
    },
    [address]
  );

  const getNetFlowRate = useCallback(async (): Promise<string> => {
    if (!address) return '0';
    return readService.getNetFlowRate(address as `0x${string}`);
  }, [address]);

  const grantPermissions = useCallback(
    async (facilitatorAddress: string): Promise<boolean> => {
      if (!address) return false;
      try {
        const res = await fetch('/api/streaming/grant-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: address, facilitator: facilitatorAddress }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [address]
  );

  return {
    ...state,
    connect,
    startStream,
    updateStream,
    stopStream,
    checkStream,
    getNetFlowRate,
    grantPermissions,
  };
}
