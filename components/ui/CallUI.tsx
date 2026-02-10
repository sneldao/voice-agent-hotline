'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Phone, 
  X,
  Clock,
  CreditCard,
  User,
  Shield,
  Zap
} from './Toast';
import { showSuccess, showError, showCallStarted, showCallEnded } from '@/lib/useToast';

interface CallState {
  status: 'idle' | 'connecting' | 'connected' | 'ended';
  duration: number; // seconds
  cost: number; // cents
  isMuted: boolean;
  isDeafened: boolean;
}

interface CallUIProps {
  agent: {
    id: string;
    name: string;
    specialty: string;
    avatar?: string;
    ratePerMinute: number; // cents
  };
  onCallEnd: (duration: number, cost: number) => void;
  onCallStart?: () => void;
}

export function CallUI({ agent, onCallEnd, onCallStart }: CallUIProps) {
  const [state, setState] = useState<CallState>({
    status: 'idle',
    duration: 0,
    cost: 0,
    isMuted: false,
    isDeafened: false,
  });

  const [waveform, setWaveform] = useState<number[]>(Array(20).fill(10));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);

  // Calculate cost from duration
  const perSecondRate = agent.ratePerMinute / 60;
  const cost = Math.floor(state.duration * perSecondRate);

  // Start call
  const handleStartCall = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'connecting' }));
    showCallStarted(agent.name);

    try {
      // In production: Initialize WebRTC connection
      // await voiceService.connect(agent.id)
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate connection

      setState(prev => ({
        ...prev,
        status: 'connected',
        duration: 0,
        cost: 0,
      }));

      showSuccess('Connected!');
      onCallStart?.();

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);

      // Start waveform animation
      const animateWaveform = () => {
        setWaveform(Array(20).fill(0).map(() => Math.random() * 50 + 10));
        animationRef.current = requestAnimationFrame(animateWaveform);
      };
      animationRef.current = requestAnimationFrame(animateWaveform);

    } catch (err) {
      showError('Failed to connect');
      setState(prev => ({ ...prev, status: 'idle' }));
    }
  }, [agent.name, agent.id, onCallStart]);

  // End call
  const handleEndCall = useCallback(() => {
    // Stop timers
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    setState(prev => ({ ...prev, status: 'ended' }));
    showCallEnded(formatDuration(state.duration), formatCost(cost));
    onCallEnd(state.duration, cost);
  }, [state.duration, cost, onCallEnd]);

  // Toggle mute
  const toggleMute = () => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  // Toggle deafen
  const toggleDeafen = () => {
    setState(prev => ({ ...prev, isDeafened: !prev.isDeafened }));
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format cost as dollars
  const formatCost = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Show call summary when ended
  if (state.status === 'ended') {
    return (
      <Card className="p-6 bg-gradient-to-br from-gray-800/80 to-gray-900/80">
        <div className="text-center">
          {/* Avatar */}
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
            <span className="text-3xl font-bold text-white">
              {agent.name.charAt(0)}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white mb-1">{agent.name}</h3>
          <p className="text-sm text-gray-400 mb-6">{agent.specialty}</p>

          {/* Call Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Duration</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatDuration(state.duration)}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-xs">Cost</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400">{formatCost(cost)}</p>
            </div>
          </div>

          <Button
            onClick={handleStartCall}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
          >
            <Phone className="w-5 h-5 mr-2" />
            Call Again
          </Button>
        </div>
      </Card>
    );
  }

  // Show call in progress
  if (state.status === 'connected') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <span className="text-lg font-bold text-white">
                {agent.name.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white">{agent.name}</h3>
              <p className="text-xs text-gray-400">{agent.specialty}</p>
            </div>
          </div>
          
          {/* Cost */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-cyan-400">{formatCost(cost)}</span>
          </div>
        </div>

        {/* Waveform */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-end gap-1 h-32">
            {waveform.map((height, i) => (
              <div
                key={i}
                className="w-3 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t-full transition-all duration-75"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 border-t border-gray-800">
          <div className="flex items-center justify-center gap-4">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`
                w-14 h-14 rounded-full flex items-center justify-center transition-all
                ${state.isMuted 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-800 text-white hover:bg-gray-700'
                }
              `}
            >
              {state.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/25"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Deafen */}
            <button
              onClick={toggleDeafen}
              className={`
                w-14 h-14 rounded-full flex items-center justify-center transition-all
                ${state.isDeafened 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-800 text-white hover:bg-gray-700'
                }
              `}
            >
              {state.isDeafened ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
          </div>

          {/* Duration */}
          <div className="text-center mt-4">
            <span className="text-2xl font-mono text-white">{formatDuration(state.duration)}</span>
            <p className="text-xs text-gray-500 mt-1">
              {state.isMuted ? '🔇 You are muted' : '🎤 Microphone active'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show connecting
  if (state.status === 'connecting') {
    return (
      <Card className="p-8 bg-gradient-to-br from-gray-800/80 to-gray-900/80 text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4 animate-pulse">
          <span className="text-4xl font-bold text-white">
            {agent.name.charAt(0)}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{agent.name}</h3>
        <p className="text-sm text-gray-400 mb-6">{agent.specialty}</p>

        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          <span className="text-sm text-gray-400 ml-2">Connecting...</span>
        </div>

        <Button
          variant="destructive"
          onClick={() => setState(prev => ({ ...prev, status: 'idle' }))}
        >
          Cancel
        </Button>
      </Card>
    );
  }

  // Show idle state (pre-call)
  return (
    <Card className="p-6 bg-gradient-to-br from-gray-800/80 to-gray-900/80">
      <div className="flex items-center gap-4 mb-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {agent.name.charAt(0)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="font-bold text-white">{agent.name}</h3>
          <p className="text-sm text-gray-400">{agent.specialty}</p>
          <div className="flex items-center gap-2 mt-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400">Verified Agent</span>
          </div>
        </div>
      </div>

      {/* Rate Info */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-gray-800/50 rounded-xl text-center">
          <p className="text-xs text-gray-400">Rate</p>
          <p className="text-lg font-bold text-cyan-400">
            ${(agent.ratePerMinute / 100).toFixed(2)}/min
          </p>
        </div>
        <div className="p-3 bg-gray-800/50 rounded-xl text-center">
          <p className="text-xs text-gray-400">Est. 10 min</p>
          <p className="text-lg font-bold text-white">
            ${((agent.ratePerMinute * 10) / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Call Button */}
      <Button
        onClick={handleStartCall}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
        size="lg"
      >
        <Phone className="w-5 h-5 mr-2" />
        Start Call
      </Button>

      <p className="text-xs text-gray-500 text-center mt-3">
        Payment authorized before call starts
      </p>
    </Card>
  );
}
