// ============================================
// StreamingPaymentModal Component
// ============================================
// Example: Voice call payment with Superfluid streaming

'use client';

import { useState, useEffect } from 'react';
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';
import { formatFlowRate, calculatePerSecondCost } from '@/lib/superfluid-streaming';

interface StreamingPaymentModalProps {
  agentName: string;
  agentAddress: string;
  ratePerMinute: number;
  onPaymentStart: () => void;
  onPaymentStop: () => void;
}

export function StreamingPaymentModal({
  agentName,
  agentAddress,
  ratePerMinute,
  onPaymentStart,
  onPaymentStop,
}: StreamingPaymentModalProps) {
  const {
    status,
    flowRate,
    startedAt,
    error,
    startStream,
    stopStream,
    grantPermissions,
    connect,
  } = useSuperfluidStreaming();

  const [isStreaming, setIsStreaming] = useState(false);
  const [duration, setDuration] = useState(0);

  // Calculate streaming rate
  const monthlyRate = ratePerMinute * 60 * 24 * 30; // rate per minute * minutes per day * days per month
  const perSecondCost = calculatePerSecondCost(monthlyRate);

  // Timer effect with proper cleanup
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    
    if (isStreaming) {
      const startTime = Date.now();
      timerId = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isStreaming]);

  const handleStartCall = async () => {
    // Grant permissions first (one-time)
    const facilitatorAddress = '0xFacilitatorAddress'; // Would come from config
    await grantPermissions(facilitatorAddress);

    // Start streaming
    const success = await startStream(agentAddress, monthlyRate);
    if (success) {
      setIsStreaming(true);
      onPaymentStart();
    }
  };

  const handleEndCall = async () => {
    await stopStream(agentAddress);
    setIsStreaming(false);
    onPaymentStop();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="streaming-payment-modal">
      <h3>Pay with Superfluid Streaming</h3>
      
      <div className="payment-info">
        <p>Agent: {agentName}</p>
        <p>Rate: ${ratePerMinute.toFixed(2)}/minute</p>
        <p>Streaming rate: {formatFlowRate(flowRate || '0')}</p>
        <p>Cost per second: ${perSecondCost.toFixed(4)}</p>
      </div>

      {isStreaming ? (
        <div className="streaming-active">
          <p className="duration">{formatDuration(duration)}</p>
          <p className="status">🔴 Streaming live</p>
          <p className="started">Started: {startedAt?.toLocaleTimeString()}</p>
          <button onClick={handleEndCall} className="end-call-btn">
            End Call & Stop Streaming
          </button>
        </div>
      ) : (
        <div className="payment-options">
          <button onClick={handleStartCall} className="start-call-btn">
            Start Voice Call
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      <style jsx>{`
        .streaming-payment-modal {
          padding: 20px;
          border-radius: 12px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
        }
        .payment-info {
          margin-bottom: 20px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        .streaming-active {
          text-align: center;
        }
        .duration {
          font-size: 48px;
          font-weight: bold;
          margin: 20px 0;
        }
        .status {
          color: #ff4444;
          font-weight: bold;
        }
        .start-call-btn, .end-call-btn {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .start-call-btn {
          background: linear-gradient(135deg, #00d9ff 0%, #00ff88 100%);
          color: #000;
        }
        .end-call-btn {
          background: #ff4444;
          color: white;
        }
        .error {
          color: #ff4444;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
}
