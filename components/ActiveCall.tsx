'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWidgetConversation } from '@/lib/useWidgetConversation';
import { useWebRTCSupport } from '@/lib/useWebRTCSupport';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { useRealPayment, type PaymentState } from '@/lib/useRealPayment';
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';
import type { AgentRecommendation } from '@/lib/agent-recommendations';
import type { Agent } from '@/lib/types';
import { getExplorerTxUrl } from '@/lib/superfluid-streaming';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, AlertCircle, Radio } from 'lucide-react';
import { Button } from './ui/Button';
import { CallSummary } from './CallSummary';
import { showError } from './ui';
import { parseUnits } from 'viem';
import { postReceiptOrQueue } from '@/lib/callReceiptQueue';

interface ActiveCallProps {
  agent: Agent;
  callId: string;
  userId: string;
  paymentMode?: 'x402' | 'streaming';
  streamingPreflight?: {
    chainName: string;
    tokenSymbol: string;
    payoutAddress: string;
    availableBalance?: number;
    requiredBalance?: number;
  };
  relatedAgents?: AgentRecommendation[];
  onEnd: () => void;
  onSelectRelatedAgent?: (agentId: string) => void;
  /** Whether the user's wallet is connected (for post-call prompt) */
  walletConnected?: boolean;
  /** Current streak count (for post-call prompt) */
  streakCount?: number;
  /** Whether this is the user's first call (for post-call prompt) */
  isFirstCall?: boolean;
  /** Callback to connect wallet (for post-call prompt) */
  onConnectWallet?: () => void;
}

export function ActiveCall({
  agent,
  callId,
  userId,
  paymentMode = 'x402',
  streamingPreflight,
  relatedAgents = [],
  onEnd,
  onSelectRelatedAgent,
  walletConnected = true,
  streakCount = 0,
  isFirstCall = false,
  onConnectWallet,
}: ActiveCallProps) {
  const { 
    state: call, 
    startConversation, 
    endConversation, 
    isMuted, 
    toggleMute, 
    transcripts,
    setVolume,
  } = useWidgetConversation({
    agentId: agent.id,
    userId,
    ratePerMinute: agent.rate,
  });
  
  // Aliases for compatibility
  const startCall = startConversation;
  const endCall = endConversation;
  const { payment, settlePayment, resetPayment } = useRealPayment();
  const {
    status: streamingStatus,
    txHash: streamingTxHash,
    error: streamingError,
    startStream,
    stopStream,
  } = useSuperfluidStreaming();
  
  const { isSupported, permissions } = useWebRTCSupport();
  const { saveCall, rateCall, toggleSaveCall, exportTranscript, updateCallReceipt } = useLocalCallHistory();
  const [hasStarted, setHasStarted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(2); // 0=mute, 1=low, 2=full
  const [savedCallId, setSavedCallId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  // #20: Keep a ref to transcripts so handleEnd always reads the latest
  const transcriptsRef = useRef(transcripts);
  transcriptsRef.current = transcripts;
  const streamingStartedRef = useRef(false);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentPayoutAddress = agent.wallet_address || agent.wallet || '';
  const platformAddress = process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || '';
  // Fall back to platform address if agent has no wallet (no split in that case)
  const payoutAddress = agentPayoutAddress || platformAddress;
  const monthlyStreamingRate = agent.rate * 60 * 24 * 30;

  // #22: Reset streaming ref when agent changes (e.g. related-agent switch)
  const prevAgentIdRef = useRef(agent.id);
  useEffect(() => {
    if (prevAgentIdRef.current !== agent.id) {
      streamingStartedRef.current = false;
      prevAgentIdRef.current = agent.id;
    }
  }, [agent.id]);

  // #27: Prevent accidental navigation during an active call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (call.isConnected && !isFinalizing) {
        e.preventDefault();
        // Modern browsers ignore custom messages but still show a confirmation dialog
        e.returnValue = 'You have an active call. Are you sure you want to leave?';
      }
    };

    // Also intercept browser back button via popstate
    const handlePopState = () => {
      if (call.isConnected && !isFinalizing) {
        // Push state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    // Push an extra history entry so back button triggers popstate instead of leaving
    if (call.isConnected) {
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [call.isConnected, isFinalizing]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  // #23: Use a ref for startCall to avoid effect re-triggers from dependency changes
  const startCallRef = useRef(startCall);
  startCallRef.current = startCall;

  useEffect(() => {
    if (hasStarted || !isSupported || startTimerRef.current) {
      return;
    }

    let cancelled = false;
    startTimerRef.current = setTimeout(() => {
      startTimerRef.current = null;
      if (cancelled) return;

      resetPayment();
      void startCallRef.current();
      setHasStarted(true);
    }, 250);

    return () => {
      cancelled = true;
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    };
  }, [hasStarted, isSupported, resetPayment]);

  useEffect(() => {
    if (paymentMode !== 'streaming' || !call.isConnected || streamingStartedRef.current) {
      return;
    }

    if (!payoutAddress) {
      showError('Streaming payment requires an agent payout address.');
      endCall();
      onEnd();
      return;
    }

    streamingStartedRef.current = true;

    void startStream(payoutAddress, monthlyStreamingRate, agentPayoutAddress ? platformAddress : undefined).then((txHash) => {
      if (!txHash) {
        streamingStartedRef.current = false;
        showError('Failed to start streaming payment. Ending call.');
        endCall();
        onEnd();
      }
    });
  }, [
    agentPayoutAddress,
    call.isConnected,
    endCall,
    monthlyStreamingRate,
    onEnd,
    paymentMode,
    payoutAddress,
    platformAddress,
    startStream,
  ]);

  // Haptic feedback helper — safe no-op when browser doesn't support it
  const vibrate = (pattern: number | number[]) => {
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
  };

  const handleEnd = useCallback(async () => {
    if (isFinalizing) {
      return;
    }

    setIsFinalizing(true);
    vibrate([100, 50, 100]); // double-pulse on hang-up

    // #20: Small delay to let the SDK flush final transcript events
    await new Promise(resolve => setTimeout(resolve, 200));

    endCall();

    // Read transcripts from ref to get the absolute latest (including final words)
    const finalTranscripts = transcriptsRef.current;
    const totalCost = Number.isFinite(call.cost) ? call.cost : 0;
    const id = saveCall({
      agentId: agent.id,
      agentName: agent.name,
      agentSpecialty: agent.specialty,
      duration: call.duration,
      cost: call.cost,
      transcripts: finalTranscripts,
    });
    setSavedCallId(id);

    // Save to server. If the network is down, queue locally and replay on
    // next app load so we don't lose receipts.
    void postReceiptOrQueue({
      id,
      agent_id: agent.id,
      agent_name: agent.name,
      agent_specialty: agent.specialty,
      caller_address: userId,
      duration: call.duration,
      cost: call.cost,
      transcripts: finalTranscripts,
    });

    if (paymentMode === 'streaming' && payoutAddress) {
      const stopTxHash = await stopStream(
        payoutAddress,
        agentPayoutAddress ? platformAddress : undefined,
        { callId: id, estimatedCost: totalCost },
      );
      if (stopTxHash) {
        updateCallReceipt(id, { txHash: stopTxHash, cost: totalCost });
      }
    } else if (totalCost > 0 && !payment.isProcessing && !payment.isSettled) {
      const amount = parseUnits(totalCost.toFixed(6), 6);
      const settlement = await settlePayment({
        callId,
        agentAddress: payoutAddress as `0x${string}`,
        amount,
        token: 'USDC',
      });

      if (settlement.txHash) {
        updateCallReceipt(id, { txHash: settlement.txHash, cost: totalCost });
      }
    }

    setShowSummary(true);
    setIsFinalizing(false);
  }, [
    agent,
    agentPayoutAddress,
    call.cost,
    call.duration,
    callId,
    endCall,
    isFinalizing,
    paymentMode,
    payment.isProcessing,
    payment.isSettled,
    payoutAddress,
    platformAddress,
    saveCall,
    settlePayment,
    stopStream,
    updateCallReceipt,
    userId,
  ]);

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    onEnd();
  }, [onEnd]);

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    resetPayment();
    try {
      await startCallRef.current();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, resetPayment]);

  const handleRate = useCallback((rating: number, feedback?: string) => {
    if (savedCallId) {
      rateCall(savedCallId, rating, feedback);
    }
  }, [savedCallId, rateCall]);

  const handleSave = useCallback(() => {
    if (savedCallId) {
      toggleSaveCall(savedCallId);
    }
  }, [savedCallId, toggleSaveCall]);

  const handleDownload = useCallback(() => {
    if (savedCallId) {
      const exportData = exportTranscript(savedCallId);
      if (exportData) {
        const blob = new Blob([exportData.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportData.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }, [savedCallId, exportTranscript]);

  const handleShare = useCallback(() => {
    if (savedCallId && navigator.share) {
      navigator.share({
        title: `Call with ${agent.name}`,
        text: `I just had a ${Math.floor(call.duration / 60)} minute call with ${agent.name} on Voice Agent Hotline!`,
        url: window.location.href,
      });
    }
  }, [savedCallId, agent.name, call.duration]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getQualityIndicator = () => {
    const { latency, audioLevel } = call.metrics;
    // Quality based on latency (ElevenLabs SDK doesn't expose packetLoss)
    if (latency < 150 && audioLevel > 0.1) return { icon: '🟢', label: 'Excellent', color: 'text-green-400' };
    if (latency < 300) return { icon: '🟡', label: 'Good', color: 'text-yellow-400' };
    return { icon: '🔴', label: 'Poor', color: 'text-red-400' };
  };

  const quality = getQualityIndicator();
  const shortAddress = (value: string) => {
    if (!value || value.length < 12) return value || 'Not set';
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };
  const streamingPayment: PaymentState = {
    isProcessing: isFinalizing || streamingStatus === 'pending',
    isSettled: streamingStatus === 'stopped',
    isSimulated: false,
    mode: 'superfluid_stream',
    txHash: streamingTxHash,
    explorerUrl: streamingTxHash ? getExplorerTxUrl(streamingTxHash) : undefined,
    error: streamingError || null,
  };
  const activePayment = paymentMode === 'streaming' ? streamingPayment : payment;
  const paymentBadge = paymentMode === 'streaming'
    ? (isFinalizing || streamingStatus === 'pending'
        ? { label: 'Settling', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' }
        : streamingError
          ? { label: 'Payment Error', className: 'bg-red-500/15 text-red-300 border-red-500/40' }
          : streamingStatus === 'stopped'
            ? { label: 'On-Chain', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' }
            : streamingStatus === 'streaming'
              ? { label: 'Streaming Live', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' }
              : { label: 'Streaming Ready', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' })
    : (isFinalizing || payment.isProcessing
        ? { label: 'Settling', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' }
        : payment.error
          ? { label: 'Payment Error', className: 'bg-red-500/15 text-red-300 border-red-500/40' }
          : payment.isSettled
            ? { label: payment.isSimulated ? 'Simulated' : 'On-Chain', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' }
            : { label: 'x402 Ready', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' });

  if (!isSupported) {
    return (
      <div className="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-[#0b0806] p-4">
        <div className="operator-panel max-w-md rounded-[1.5rem] p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          <h3 className="mb-2 text-xl font-bold text-amber-50">Voice Line Unavailable</h3>
          <p className="mb-4 text-amber-100/60">Your browser does not support voice calls.</p>
          <Button onClick={handleEnd} variant="destructive">Go Back</Button>
        </div>
      </div>
    );
  }

  if (call.isConnecting) {
    return (
      <div className="switchboard-shell fixed inset-0 z-50 flex h-dvh flex-col items-center justify-center bg-[#0b0806] p-4">
        <div className="mx-auto max-w-md text-center">
          <div className="operator-panel mx-auto mb-6 flex h-28 w-28 animate-pulse items-center justify-center rounded-full">
            <div className="rotary-dial flex h-24 w-24 items-center justify-center rounded-full">
              <span className="text-4xl">{agent.avatar || agent.name.charAt(0)}</span>
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-amber-50">{agent.name}</h2>
          <p className="mb-6 text-amber-100/60">{agent.specialty}</p>
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 animate-bounce rounded-full bg-red-300" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-amber-200" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '300ms' }} />
            <span className="ml-2 text-amber-100/60">Patching line...</span>
          </div>
          <p className="mt-4 text-xs leading-5 text-amber-100/45">
            Keep this tab focused while we prepare the voice session and microphone stream.
          </p>
        </div>
      </div>
    );
  }

  if (call.error) {
    return (
      <div className="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-[#0b0806] p-4">
        <div className="operator-panel mx-auto max-w-md rounded-[1.5rem] p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          <h3 className="mb-2 text-xl font-bold text-amber-50">Call Failed</h3>
          <p className="mb-5 text-amber-100/60">{call.error}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleEnd} variant="outline">Close</Button>
            <Button onClick={handleRetry} isLoading={isRetrying}>
              Retry Call
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="switchboard-shell fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-[#0b0806]">
      <div className="w-full border-b border-amber-100/15 bg-[#120d0a]/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-100/25 bg-red-950/45">
            <span className="text-lg">{agent.avatar || agent.name.charAt(0)}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-50">{agent.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`line-lamp h-2 w-2 rounded-full ${call.isConnected ? 'bg-emerald-300 text-emerald-300' : 'animate-pulse bg-amber-300 text-amber-300'}`} />
              <span className="text-xs text-amber-100/55">{call.isConnected ? 'Live patched line' : 'Connecting line'}</span>
            </div>
          </div>
          </div>
        
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-amber-100/15 bg-black/25 px-3 py-1.5 text-right">
              <span className="text-sm font-bold tabular-nums text-amber-200">${(call.cost || 0).toFixed(4)}</span>
            </div>
          </div>
        </div>
        {paymentMode === 'streaming' && streamingPreflight && (
          <details className="border-t border-amber-100/10 px-4 py-2">
            <summary className="cursor-pointer text-xs text-amber-100/45 hover:text-amber-100/65">Payment info</summary>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${paymentBadge.className}`}>
                <Radio className="h-3 w-3" />
                {paymentBadge.label}
              </span>
              <span className="payment-badge border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Streaming {streamingPreflight.tokenSymbol}
              </span>
              <span className="text-amber-100/40">to {shortAddress(streamingPreflight.payoutAddress)}</span>
            </div>
          </details>
        )}
      </div>

      {call.isReconnecting && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
          Reconnecting voice session. Duration and billing are paused.
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center overflow-y-auto p-4">
        {isFinalizing && (
          <div className="mb-4 w-full max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-amber-200">Finalizing payment on Arbitrum</p>
            <p className="mt-1 text-xs text-amber-300/80">
              Waiting for settlement before opening the receipt.
            </p>
          </div>
        )}
        <div className="relative mb-8">
          <div className="operator-panel flex h-36 w-36 items-center justify-center rounded-full">
            <div className="rotary-dial flex h-32 w-32 items-center justify-center rounded-full">
              <span className="text-5xl">{agent.avatar || agent.name.charAt(0)}</span>
            </div>
          </div>
          <div className="line-lamp absolute -bottom-2 -right-2 flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-emerald-300 text-emerald-300">
            <div className="h-3 w-3 rounded-full bg-white" />
          </div>
        </div>

        <div className="mb-4 h-48 w-full max-w-md overflow-y-auto rounded-xl border border-amber-100/15 bg-[#17100d]/85 p-4">
          {transcripts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-amber-200/60"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-center text-sm text-amber-100/55">
                  {call.isConnected
                    ? isMuted
                      ? '🔇 Microphone muted — unmute to speak'
                      : 'Listening... speak naturally'
                    : 'Connecting voice session...'}
                </p>
                <p className="text-center text-xs text-amber-100/35">
                  Transcript appears after the call ends
                </p>
              </div>
            ) : (
              transcripts.map((t, i) => (
                <div key={i} className={`mb-2 ${t.speaker === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-3 py-1.5 rounded-lg text-sm ${
                    t.speaker === 'user' 
                      ? 'bg-red-500/20 text-red-100' 
                      : 'bg-amber-100/10 text-amber-100/75'
                  }`}>
                    {t.text}
                  </span>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

        {/* #9: Single large duration counter + live indicator */}
        <div 
          className="text-center"
          role="status"
          aria-live="polite"
          aria-label="Call duration"
        >
          <p className="mb-2 font-mono text-5xl text-amber-50 tabular-nums">
            {formatDuration(call.duration)}
          </p>
          {/* Simple waveform indicator — shows the call is active */}
          <div className="flex items-center justify-center gap-1 h-6">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-1 rounded-full bg-amber-200 transition-all duration-300"
                style={{
                  height: call.isConnected && !isMuted
                    ? `${Math.max(4, Math.min(24, call.metrics.audioLevel * 100 + Math.sin(Date.now() / 200 + i) * 8))}px`
                    : '4px',
                  opacity: call.isConnected ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full border-t border-amber-100/15 bg-[#120d0a]/92 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl p-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => { vibrate(40); toggleMute(); }}
            disabled={isFinalizing}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isMuted 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' 
                : 'bg-black/30 text-amber-50 hover:bg-amber-100/10'
              }
            `}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={handleEnd}
            disabled={isFinalizing}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-950/40 transition-all hover:bg-red-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-60"
            title="End Call"
          >
            <PhoneOff className="w-8 h-8" />
          </button>

          {/* #10: Speaker toggle — simple on/off */}
          <button
            onClick={() => {
              const newVol = speakerVolume > 0 ? 0 : 2;
              setSpeakerVolume(newVol);
              setVolume(newVol > 0 ? 1 : 0);
            }}
            disabled={isFinalizing}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed ${
              speakerVolume === 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-black/30 text-amber-100/70 hover:bg-amber-100/10'
            }`}
            title={speakerVolume === 0 ? 'Unmute speaker' : 'Mute speaker'}
          >
            {speakerVolume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

          {/* #11: Budget bar tied to 5-minute suggested cap */}
          <div 
            className="mt-4"
            role="status"
            aria-live="polite"
            aria-label="Call cost"
          >
            <div className="mb-1 flex items-center justify-between text-xs text-amber-100/45">
              <span>{isMuted ? '🔇 Muted' : '🎤 Active'}</span>
              <span className="tabular-nums">
                ${(call.cost || 0).toFixed(4)} / ${(agent.rate * 5).toFixed(2)} cap
              </span>
            </div>
            <div 
              className="h-1 overflow-hidden rounded-full bg-black/45"
              role="progressbar"
              aria-valuenow={Math.min(100, (call.cost / (agent.rate * 5)) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget usage"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-red-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, (call.cost / (agent.rate * 5)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Call Summary Modal */}
      <CallSummary
        isOpen={showSummary}
        callId={callId}
        agent={{
          id: agent.id,
          name: agent.name,
          specialty: agent.specialty,
          avatar: agent.avatar,
          color: agent.color,
        }}
        duration={call.duration}
        cost={call.cost}
        transcripts={transcripts}
        txHash={activePayment.txHash}
        payment={activePayment}
        onClose={handleCloseSummary}
        onRate={handleRate}
        onSave={handleSave}
        onShare={handleShare}
        onDownload={handleDownload}
        relatedAgents={relatedAgents}
        onSelectRelatedAgent={(id) => {
          setShowSummary(false);
          onSelectRelatedAgent?.(id);
        }}
        walletConnected={walletConnected}
        streakCount={streakCount}
        isFirstCall={isFirstCall}
        onConnectWallet={onConnectWallet}
      />
    </div>
  );
}
