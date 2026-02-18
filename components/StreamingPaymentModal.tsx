'use client';

import { useState, useEffect } from 'react';
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';
import { formatFlowRate, calculatePerSecondCost } from '@/lib/superfluid-streaming';
import { Phone, PhoneOff, AlertCircle, Loader2, Clock, Zap } from 'lucide-react';

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
    flowRate,
    error,
    startStream,
    stopStream,
    grantPermissions,
  } = useSuperfluidStreaming();

  const [isStreaming, setIsStreaming] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Facilitator address from env — required for Superfluid ACL delegation.
  // Set NEXT_PUBLIC_FACILITATOR_ADDRESS in .env.local
  const facilitatorAddress = process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS ?? null;
  const facilitatorMissing = !facilitatorAddress;

  const monthlyRate = ratePerMinute * 60 * 24 * 30;
  const perSecondCost = calculatePerSecondCost(monthlyRate);
  const totalCost = duration * perSecondCost;

  // Duration timer
  useEffect(() => {
    if (!isStreaming) return;
    const start = Date.now() - duration * 1000;
    const id = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async () => {
    setLocalError(null);

    if (facilitatorMissing) {
      setLocalError('Streaming not configured: NEXT_PUBLIC_FACILITATOR_ADDRESS is not set. Add it to .env.local.');
      return;
    }

    setIsStarting(true);
    try {
      // Grant ACL permissions to facilitator (one-time; safe to call again)
      await grantPermissions(facilitatorAddress);

      const success = await startStream(agentAddress, monthlyRate);
      if (success) {
        setIsStreaming(true);
        setDuration(0);
        onPaymentStart();
      } else {
        setLocalError(error ?? 'Failed to start stream. Check your wallet balance and network.');
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndCall = async () => {
    setIsStopping(true);
    try {
      await stopStream(agentAddress);
      setIsStreaming(false);
      onPaymentStop();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsStopping(false);
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Superfluid Streaming</h3>
            <p className="text-xs text-gray-400">Real-time payment per second</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Config warning */}
        {facilitatorMissing && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Streaming not configured</p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Set <code className="font-mono bg-amber-500/20 px-1 rounded">NEXT_PUBLIC_FACILITATOR_ADDRESS</code> in <code className="font-mono bg-amber-500/20 px-1 rounded">.env.local</code> to enable Superfluid streaming.
              </p>
            </div>
          </div>
        )}

        {/* Payment info */}
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Agent</span>
            <span className="text-white font-medium">{agentName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Rate</span>
            <span className="text-white">${(ratePerMinute || 0).toFixed(2)}/min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Per second</span>
            <span className="text-cyan-400 font-mono">${(perSecondCost || 0).toFixed(6)}</span>
          </div>
          {flowRate && flowRate !== '0' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Flow rate</span>
              <span className="text-green-400 font-mono text-xs">{formatFlowRate(flowRate)}</span>
            </div>
          )}
        </div>

        {/* Active streaming state */}
        {isStreaming ? (
          <div className="space-y-3">
            {/* Live ticker */}
            <div className="text-center py-4 bg-gray-800/30 rounded-xl">
              <p className="text-5xl font-mono font-bold text-white tabular-nums">
                {formatDuration(duration)}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm text-red-400 font-semibold">Streaming live</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total: <span className="text-cyan-400 font-mono">${(totalCost || 0).toFixed(4)}</span>
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (duration / 600) * 100)}%` }}
              />
            </div>

            <button
              onClick={handleEndCall}
              disabled={isStopping}
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isStopping ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Stopping…</>
              ) : (
                <><PhoneOff className="w-4 h-4" /> End Call & Stop Streaming</>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartCall}
            disabled={isStarting || facilitatorMissing}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting stream…</>
            ) : (
              <><Phone className="w-4 h-4" /> Start Voice Call</>
            )}
          </button>
        )}

        {/* Error */}
        {displayError && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{displayError}</p>
          </div>
        )}

        <p className="text-xs text-center text-gray-600">
          Powered by Superfluid on Celo • Payment stops instantly when you end the call
        </p>
      </div>
    </div>
  );
}
