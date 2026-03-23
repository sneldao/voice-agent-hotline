'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { webRTCService } from './webrtc-voice';

export interface CallState {
  isConnected: boolean;
  isConnecting: boolean;
  duration: number;
  cost: number;
  error: string | null;
  txHash?: string;
  metrics: {
    latency: number;
    packetLoss: number;
    audioLevel: number;
  };
}

interface UseRealVoiceCallReturn {
  call: CallState;
  startCall: (params: {
    agentId: string;
    callId: string;
    userId: string;
  }) => Promise<boolean>;
  endCall: () => void;
  interrupt: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  transcripts: Array<{
    text: string;
    speaker: 'user' | 'agent';
    timestamp: number;
  }>;
}

export function useRealVoiceCall(ratePerMinute: number = 0.1): UseRealVoiceCallReturn {
  const [call, setCall] = useState<CallState>({
    isConnected: false,
    isConnecting: false,
    duration: 0,
    cost: 0,
    error: null,
    txHash: undefined,
    metrics: {
      latency: 0,
      packetLoss: 0,
      audioLevel: 0,
    },
  });

  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Array<{
    text: string;
    speaker: 'user' | 'agent';
    timestamp: number;
  }>>([]);

  const callIdRef = useRef<string | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update cost based on duration
  useEffect(() => {
    if (call.isConnected) {
      const minutes = call.duration / 60;
      const cost = minutes * ratePerMinute;
      setCall(prev => ({ ...prev, cost }));
    }
  }, [call.duration, call.isConnected, ratePerMinute]);

  const endCall = useCallback(() => {
    if (callIdRef.current && webRTCService) {
      webRTCService.endCall(callIdRef.current);
    }

    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }

    // Keep txHash for summary display
    setCall(prev => ({
      isConnected: false,
      isConnecting: false,
      duration: prev.duration,
      cost: prev.cost,
      error: null,
      txHash: prev.txHash,
      metrics: {
        latency: 0,
        packetLoss: 0,
        audioLevel: 0,
      },
    }));
  }, []);

  const startCall = useCallback(async ({
    agentId,
    callId,
    userId,
  }: {
    agentId: string;
    callId: string;
    userId: string;
  }): Promise<boolean> => {
    if (!webRTCService) {
      setCall(prev => ({
        ...prev,
        error: 'WebRTC not supported in this environment',
      }));
      return false;
    }

    setCall(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    callIdRef.current = callId;

    try {
      await webRTCService.startCall(
        callId,
        agentId,
        userId,
        '/api/webrtc/signal'
      );

      webRTCService.on('connected', () => {
        setCall(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
        }));

        durationIntervalRef.current = setInterval(() => {
          setCall(prev => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);

        metricsIntervalRef.current = setInterval(() => {
          if (!webRTCService) return;
          const session = webRTCService.getSession(callId);
          if (session) {
            setCall(prev => ({
              ...prev,
              metrics: {
                latency: session.metrics.latency,
                packetLoss: session.metrics.packetLoss,
                audioLevel: session.metrics.audioLevel,
              },
            }));
          }
        }, 2000);
      });

      webRTCService.on('disconnected', () => {
        endCall();
      });

      webRTCService.on('transcript', ({ text, isFinal }) => {
        if (isFinal) {
          setTranscripts(prev => [...prev, {
            text,
            speaker: 'user',
            timestamp: Date.now(),
          }]);
        }
      });

      webRTCService.on('agentResponse', ({ text }) => {
        setTranscripts(prev => [...prev, {
          text,
          speaker: 'agent',
          timestamp: Date.now(),
        }]);
      });

      return true;
    } catch (err: any) {
      console.error('Call error:', err);
      setCall(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || 'Failed to start call',
      }));
      return false;
    }
  }, [endCall]);

  const interrupt = useCallback(() => {
    if (callIdRef.current && webRTCService) {
      webRTCService.interrupt(callIdRef.current);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (callIdRef.current && webRTCService) {
      const newMuted = !isMuted;
      webRTCService.setMuted(callIdRef.current, newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    call,
    startCall,
    endCall,
    interrupt,
    isMuted,
    toggleMute,
    transcripts,
  };
}

// Hook for checking WebRTC support
export function useWebRTCSupport() {
  const [isSupported, setIsSupported] = useState(false);
  const [permissions, setPermissions] = useState<{
    microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  }>({ microphone: 'unknown' });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check WebRTC support
    const supported = !!(
      window.RTCPeerConnection &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
    setIsSupported(supported);

    // Check microphone permission
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(result => {
          setPermissions({ microphone: result.state as any });
          result.addEventListener('change', () => {
            setPermissions({ microphone: result.state as any });
          });
        })
        .catch(() => {
          setPermissions({ microphone: 'unknown' });
        });
    }
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissions({ microphone: 'granted' });
      return true;
    } catch {
      setPermissions({ microphone: 'denied' });
      return false;
    }
  }, []);

  return {
    isSupported,
    permissions,
    requestMicrophonePermission,
  };
}
