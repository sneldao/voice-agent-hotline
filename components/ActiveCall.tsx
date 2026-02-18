'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRealVoiceCall, useWebRTCSupport } from '@/lib/useRealVoiceCall';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { Mic, MicOff, Volume2, PhoneOff, Clock, Signal, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { CallSummary } from './CallSummary';

interface Agent {
  id: string;
  name: string;
  specialty: string;
  avatar?: string;
  rate: number;
  color?: string;
}

interface ActiveCallProps {
  agent: Agent;
  callId: string;
  userId: string;
  onEnd: () => void;
  onSelectRelatedAgent?: (agentId: string) => void;
}

export function ActiveCall({ agent, callId, userId, onEnd, onSelectRelatedAgent }: ActiveCallProps) {
  const { 
    call, 
    startCall, 
    endCall, 
    isMuted, 
    toggleMute, 
    transcripts 
  } = useRealVoiceCall(agent.rate);
  
  const { isSupported, permissions } = useWebRTCSupport();
  const { saveCall, rateCall, toggleSaveCall, exportTranscript } = useLocalCallHistory();
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [savedCallId, setSavedCallId] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, showTranscript]);

  useEffect(() => {
    if (!hasStarted && isSupported) {
      startCall({ agentId: agent.id, callId, userId });
      setHasStarted(true);
    }
  }, [hasStarted, isSupported, agent.id, callId, userId, startCall]);

  // Haptic feedback helper — safe no-op when browser doesn't support it
  const vibrate = (pattern: number | number[]) => {
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
  };

  const handleEnd = useCallback(() => {
    vibrate([100, 50, 100]); // double-pulse on hang-up
    endCall();
    
    // Save call to history
    const id = saveCall({
      agentId: agent.id,
      agentName: agent.name,
      agentSpecialty: agent.specialty,
      duration: call.duration,
      cost: call.cost,
      transcripts,
    });
    setSavedCallId(id);
    setShowSummary(true);
  }, [endCall, saveCall, agent, call.duration, call.cost, transcripts]);

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
    const { latency, packetLoss } = call.metrics;
    if (latency < 150 && packetLoss < 1) return { icon: '🟢', label: 'Excellent', color: 'text-green-400' };
    if (latency < 300 && packetLoss < 3) return { icon: '🟡', label: 'Good', color: 'text-yellow-400' };
    return { icon: '🔴', label: 'Poor', color: 'text-red-400' };
  };

  const quality = getQualityIndicator();

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
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${agent.color || 'from-cyan-500 to-blue-500'} flex items-center justify-center`}>
            <span className="text-xl">{agent.avatar || agent.name.charAt(0)}</span>
          </div>
          <div>
            <h3 className="font-bold text-white">{agent.name}</h3>
            <p className="text-xs text-gray-400">{agent.specialty}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quality indicator */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/80 ${quality.color}`}>
            <Signal className="w-3 h-3" />
            <span className="text-xs">{quality.label}</span>
          </div>
          {/* Live badge */}
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Live</span>
          </span>
          {/* Animated cost ticker */}
          <div className="px-3 py-1.5 bg-gray-800 rounded-full min-w-[70px] text-right">
            <span className="text-sm font-bold text-cyan-400 tabular-nums">${call.cost.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
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

        <div className="flex gap-6 text-center">
          <div>
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <Clock className="w-3 h-3" />
              Duration
            </div>
            <p className="text-2xl font-mono text-white">{formatDuration(call.duration)}</p>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Latency</div>
            <p className="text-2xl font-mono text-white">{Math.round(call.metrics.latency)}ms</p>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Audio</div>
            <p className="text-2xl font-mono text-white">{Math.round(call.metrics.audioLevel * 100)}%</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => { vibrate(40); toggleMute(); }}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90
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
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 shadow-lg shadow-red-500/25"
            title="End Call"
          >
            <PhoneOff className="w-8 h-8" />
          </button>

          {/* Speaker toggle — cycles through volume levels */}
          <button
            onClick={() => {/* speaker volume toggle — placeholder for audio output control */}}
            className="w-14 h-14 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-gray-700 transition-all active:scale-95"
            title="Speaker volume"
          >
            <Volume2 className="w-6 h-6" />
          </button>
        </div>

        {/* Budget progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{isMuted ? '🔇 Muted' : '🎤 Mic active'}</span>
            <span className="tabular-nums">${call.cost.toFixed(4)} spent</span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (call.cost / (agent.rate * 10)) * 100)}%` }}
            />
          </div>
          <p className="text-center text-xs text-gray-600 mt-1">
            {permissions.microphone === 'granted' ? '✓ Mic permission granted' : '⚠ Mic permission needed'}
          </p>
        </div>
      </div>

      {/* Call Summary Modal */}
      <CallSummary
        isOpen={showSummary}
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
        txHash={call.txHash}
        onClose={handleCloseSummary}
        onRate={handleRate}
        onSave={handleSave}
        onShare={handleShare}
        onDownload={handleDownload}
        relatedAgents={[
          // Mock related agents - in real app, fetch from matching engine
          {
            id: 'related_1',
            name: 'Crypto Tax Pro',
            specialty: 'Tax Optimization',
            rate: 0.35,
            reason: 'Similar to your call',
          },
          {
            id: 'related_2',
            name: 'DeFi Analyst',
            specialty: 'Yield Strategies',
            rate: 0.50,
            reason: 'Popular in your area',
          },
        ]}
        onSelectRelatedAgent={(id) => {
          setShowSummary(false);
          onSelectRelatedAgent?.(id);
        }}
      />
    </div>
  );
}
