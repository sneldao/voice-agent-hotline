// ============================================
// useSuperfluidStreaming Hook
// ============================================

'use client';

import { useState, useCallback } from 'react';
import { SuperfluidStreamingService, StreamingPaymentState, StreamingPaymentRequest } from './superfluid-streaming';
import { useWallet } from './WalletContext';

interface UseSuperfluidStreamingReturn extends StreamingPaymentState {
  connect: () => Promise<void>;
  startStream: (recipient: string, monthlyUSDC: number) => Promise<boolean>;
  updateStream: (recipient: string, monthlyUSDC: number) => Promise<boolean>;
  stopStream: (recipient: string) => Promise<boolean>;
  grantPermissions: (facilitatorAddress: string) => Promise<boolean>;
  getBalance: () => Promise<string>;
}

export function useSuperfluidStreaming(): UseSuperfluidStreamingReturn {
  const { address, isConnecting, connect } = useWallet();
  const [state, setState] = useState<StreamingPaymentState>({
    status: 'idle',
  });

  const service = address
    ? new SuperfluidStreamingService(address as `0x${string}`, {
        account: { address: address as `0x${string}` },
        writeContract: async () => '0x' as `0x${string}`,
      })
    : null;

  const startStream = useCallback(
    async (recipient: string, monthlyUSDC: number): Promise<boolean> => {
      if (!service || !address) {
        setState({ status: 'error', error: 'Wallet not connected' });
        return false;
      }

      setState({ status: 'pending' });

      const result = await service.startStream({
        recipient: recipient as `0x${string}`,
        monthlyAmount: (monthlyUSDC * 1e18).toString(),
        account: address as `0x${string}`,
      });

      setState(result);
      return result.status === 'streaming';
    },
    [service, address]
  );

  const updateStream = useCallback(
    async (recipient: string, monthlyUSDC: number): Promise<boolean> => {
      if (!service) {
        setState({ status: 'error', error: 'Service not initialized' });
        return false;
      }

      const result = await service.updateStream(
        recipient as `0x${string}`,
        (monthlyUSDC * 1e18).toString()
      );

      setState(result);
      return result.status === 'streaming';
    },
    [service]
  );

  const stopStream = useCallback(
    async (recipient: string): Promise<boolean> => {
      if (!service) {
        setState({ status: 'error', error: 'Service not initialized' });
        return false;
      }

      const result = await service.stopStream(recipient as `0x${string}`);
      setState(result);
      return result.status === 'stopped';
    },
    [service]
  );

  const grantPermissions = useCallback(
    async (facilitatorAddress: string): Promise<boolean> => {
      if (!service) {
        return false;
      }

      const result = await service.grantPermissions(facilitatorAddress as `0x${string}`);
      return result.success;
    },
    [service]
  );

  const getBalance = useCallback(async (): Promise<string> => {
    if (!service) return '0';
    return service.getBalance();
  }, [service]);

  return {
    ...state,
    connect,
    startStream,
    updateStream,
    stopStream,
    grantPermissions,
    getBalance,
  };
}
