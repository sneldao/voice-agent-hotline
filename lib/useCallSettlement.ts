'use client';

import { useCallback, useRef } from 'react';
import { useRealPayment } from './useRealPayment';
import { useSuperfluidStreaming } from './useSuperfluidStreaming';
import { useLocalCallHistory } from './useCallHistory';
import { parseEther } from 'viem';
import { showError } from '@/components/ui';

export type PaymentMode = 'x402' | 'streaming';

interface SettlementParams {
  callId: string;
  agentId: string;
  agentName: string;
  agentSpecialty: string;
  duration: number;
  cost: number;
  transcripts: Array<{ text: string; speaker: 'user' | 'agent'; timestamp: number }>;
  payoutAddress: string;
  platformAddress: string;
  agentPayoutAddress: string;
  paymentMode: PaymentMode;
}

interface UseCallSettlementReturn {
  isFinalizing: boolean;
  settleCall: (params: SettlementParams) => Promise<{ callId: string; txHash?: string }>;
  startStreaming: (payoutAddress: string, monthlyRate: number, agentPayoutAddress: string, platformAddress: string) => Promise<boolean>;
  streamingStatus: string;
  streamingTxHash: string | undefined;
  streamingError: string | undefined;
  payment: ReturnType<typeof useRealPayment>['payment'];
  resetPayment: () => void;
}

export function useCallSettlement(): UseCallSettlementReturn {
  const { payment, settlePayment, resetPayment } = useRealPayment();
  const {
    status: streamingStatus,
    txHash: streamingTxHash,
    error: streamingError,
    startStream,
    stopStream,
  } = useSuperfluidStreaming();
  const { saveCall, updateCallReceipt } = useLocalCallHistory();
  const isFinalizingRef = useRef(false);

  const startStreaming = useCallback(async (
    payoutAddress: string,
    monthlyRate: number,
    agentPayoutAddress: string,
    platformAddress: string
  ) => {
    const txHash = await startStream(payoutAddress, monthlyRate, agentPayoutAddress ? platformAddress : undefined);
    return !!txHash;
  }, [startStream]);

  const settleCall = useCallback(async (params: SettlementParams) => {
    if (isFinalizingRef.current) {
      return { callId: '' };
    }

    isFinalizingRef.current = true;
    const totalCost = Number.isFinite(params.cost) ? params.cost : 0;

    const callRecordId = saveCall({
      agentId: params.agentId,
      agentName: params.agentName,
      agentSpecialty: params.agentSpecialty,
      duration: params.duration,
      cost: params.cost,
      transcripts: params.transcripts,
    });

    // Save to server (fire-and-forget, local is source of truth)
    fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: callRecordId,
        agent_id: params.agentId,
        agent_name: params.agentName,
        agent_specialty: params.agentSpecialty,
        caller_address: params.callId,
        duration: params.duration,
        cost: params.cost,
        transcripts: params.transcripts,
      }),
    }).catch(() => {});

    let txHash: string | undefined;

    if (params.paymentMode === 'streaming' && params.payoutAddress) {
      const stopTxHash = await stopStream(params.payoutAddress, params.agentPayoutAddress ? params.platformAddress : undefined);
      if (stopTxHash) {
        txHash = stopTxHash;
        updateCallReceipt(callRecordId, { txHash: stopTxHash, cost: totalCost });
      }
    } else if (totalCost > 0 && !payment.isProcessing && !payment.isSettled) {
      const amount = parseEther(totalCost.toFixed(6));
      const settlement = await settlePayment({
        callId: params.callId,
        agentAddress: params.payoutAddress as `0x${string}`,
        amount,
        token: 'cUSD',
      });

      if (settlement.txHash) {
        txHash = settlement.txHash;
        updateCallReceipt(callRecordId, { txHash: settlement.txHash, cost: totalCost });
      }
    }

    isFinalizingRef.current = false;
    return { callId: callRecordId, txHash };
  }, [payment.isProcessing, payment.isSettled, saveCall, settlePayment, stopStream, updateCallReceipt]);

  return {
    isFinalizing: isFinalizingRef.current,
    settleCall,
    startStreaming,
    streamingStatus,
    streamingTxHash,
    streamingError,
    payment,
    resetPayment,
  };
}
