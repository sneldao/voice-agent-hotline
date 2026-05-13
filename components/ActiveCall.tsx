'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useElevenLabsConversation, useWebRTCSupport } from '@/lib/useElevenLabsConversation';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { useRealPayment, type PaymentState } from '@/lib/useRealPayment';
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';
import type { AgentRecommendation } from '@/lib/agent-recommendations';
import type { Agent } from '@/lib/types';
import { getExplorerTxUrl } from '@/lib/superfluid-streaming';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, AlertCircle, Phone } from 'lucide-react';
import { Button } from './ui/Button';
import { CallSummary } from './CallSummary';
import { showError } from './ui';
import { parseEther } from 'viem';
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
}: ActiveCallProps) {
  const { 
    state: call, 
    startConversation, 
    endConversation, 
    isMuted, 
    toggleMute, 
    transcripts,
    setVolume,
  } = useElevenLabsConversation({
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
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(2); // 0=mute, 1=low, 2=full
  const [savedCallId, setSavedCallId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  // #20: Keep a ref to transcripts so handleEnd always reads the latest
  const transcriptsRef = useRef(transcripts);
  transcriptsRef.current = transcripts;
  const streamingStartedRef = useRef(false);
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
    if (showTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, showTranscript]);

  // #23: Use a ref for startCall to avoid effect re-triggers from dependency changes
  const startCallRef = useRef(startCall);
  startCallRef.current = startCall;

  useEffect(() => {
    if (!hasStarted && isSupported) {
      resetPayment();
      startCallRef.current();
      setHasStarted(true);
    }
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
      const amount = parseEther(totalCost.toFixed(6));
      const settlement = await settlePayment({
        callId,
        agentAddress: payoutAddress as `0x${string}`,
        amount,
        token: 'cUSD',
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
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">WebRTC Not Supported</h3>
          <p className="text-gray-400 mb-4">Your browser does not support voice calls.</p>
          <Button onClick={handleEnd} variant="destructive">Go Back</Button>
        </div>
      </div>
    );
  }

  if (call.isConnecting) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-6 animate-pulse">
            <span className="text-4xl">{agent.avatar || agent.name.charAt(0)}</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{agent.name}</h2>
          <p className="text-gray-400 mb-6">{agent.specialty}</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-gray-400 ml-2">Connecting...</span>
          </div>
        </div>
      </div>
    );
  }

  if (call.error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Call Failed</h3>
          <p className="text-gray-400 mb-4">{call.error}</p>
          <Button onClick={handleEnd} variant="destructive">End Call</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header — #8: Simplified to avatar+name, status dot, cost ticker */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${agent.color || 'from-cyan-500 to-blue-500'} flex items-center justify-center`}>
            <span className="text-lg">{agent.avatar || agent.name.charAt(0)}</span>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{agent.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${call.isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-xs text-gray-400">{call.isConnected ? 'Connected' : 'Connecting'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-gray-800 rounded-full text-right">
            <span className="text-sm font-bold text-cyan-400 tabular-nums">${(call.cost || 0).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {paymentMode === 'streaming' && streamingPreflight && (
        <div className="px-4 py-2 border-b border-gray-800/60 bg-gray-900/70">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
              Chain: {streamingPreflight.chainName}
            </span>
            <span className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
              Token: {streamingPreflight.tokenSymbol}
            </span>
            <span className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
              Payout: {shortAddress(streamingPreflight.payoutAddress)}
            </span>
            {typeof streamingPreflight.availableBalance === 'number' && typeof streamingPreflight.requiredBalance === 'number' && (
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
                Reserve: {streamingPreflight.availableBalance.toFixed(3)} / {streamingPreflight.requiredBalance.toFixed(3)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {isFinalizing && (
          <div className="w-full max-w-md mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-amber-200">Finalizing payment on Celo</p>
            <p className="mt-1 text-xs text-amber-300/80">
              Waiting for settlement before opening the receipt.
            </p>
          </div>
        )}
        <div className="relative mb-8">
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${agent.color || 'from-cyan-500 to-blue-500'} flex items-center justify-center`}>
            <span className="text-5xl">{agent.avatar || agent.name.charAt(0)}</span>
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full" />
          </div>
        </div>

        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          {showTranscript ? 'Hide' : 'Show'} Transcript ({transcripts.length} messages)
        </button>

        {showTranscript && (
          <div className="w-full max-w-md h-48 overflow-y-auto bg-gray-800/50 rounded-xl p-4 mb-4">
            {transcripts.length === 0 ? (
              <p className="text-gray-500 text-center text-sm">Conversation will appear here...</p>
            ) : (
              transcripts.map((t, i) => (
                <div key={i} className={`mb-2 ${t.speaker === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-3 py-1.5 rounded-lg text-sm ${
                    t.speaker === 'user' 
                      ? 'bg-cyan-500/20 text-cyan-300' 
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {t.text}
                  </span>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* #9: Single large duration counter + live indicator */}
        <div 
          className="text-center"
          role="status"
          aria-live="polite"
          aria-label="Call duration"
        >
          <p className="text-4xl font-mono text-white tabular-nums mb-2">
            {formatDuration(call.duration)}
          </p>
          {/* Simple waveform indicator — shows the call is active */}
          <div className="flex items-center justify-center gap-1 h-6">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-1 bg-cyan-400 rounded-full transition-all duration-300"
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
      <div className="p-6 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => { vibrate(40); toggleMute(); }}
            disabled={isFinalizing}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isMuted 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' 
                : 'bg-gray-800 text-white hover:bg-gray-700'
              }
            `}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={handleEnd}
            disabled={isFinalizing}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 shadow-lg shadow-red-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
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
              speakerVolume === 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{isMuted ? '🔇 Muted' : '🎤 Active'}</span>
              <span className="tabular-nums">
                ${(call.cost || 0).toFixed(4)} / ${(agent.rate * 5).toFixed(2)} cap
              </span>
            </div>
            <div 
              className="h-1 bg-gray-800 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.min(100, (call.cost / (agent.rate * 5)) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget usage"
            >
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (call.cost / (agent.rate * 5)) * 100)}%` }}
              />
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
      />
    </div>
  );
}
