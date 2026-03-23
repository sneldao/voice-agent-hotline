// ============================================
// ElevenLabs Conversational AI Hook
// ============================================
// Proper integration using @elevenlabs/client SDK
// Replaces custom WebRTC with ElevenLabs native voice

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Dynamic import for SSR safety
let Conversation: any = null;
if (typeof window !== 'undefined') {
  import('@elevenlabs/client').then(mod => {
    Conversation = mod.Conversation;
  });
}

export interface ConversationState {
  isConnected: boolean;
  isConnecting: boolean;
  duration: number;
  cost: number;
  error: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  mode: 'listening' | 'speaking' | 'idle';
  metrics: {
    latency: number;
    audioLevel: number;
  };
}

export interface TranscriptMessage {
  text: string;
  speaker: 'user' | 'agent';
  timestamp: number;
  isFinal: boolean;
}

interface ConversationOptions {
  agentId: string;
  userId?: string;
  ratePerMinute?: number;
  onTranscript?: (text: string, speaker: 'user' | 'agent', isFinal: boolean) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface TokenResponse {
  token: string;
  signedUrl: string;
  elevenLabsAgentId: string;
  connectionType: 'webrtc' | 'websocket';
  voiceId: string;
  agentName: string;
}

export function useElevenLabsConversation(options: ConversationOptions) {
  const { agentId, userId, ratePerMinute = 0.1, onTranscript, onError, onConnect, onDisconnect } = options;

  const [state, setState] = useState<ConversationState>({
    isConnected: false,
    isConnecting: false,
    duration: 0,
    cost: 0,
    error: null,
    status: 'disconnected',
    mode: 'idle',
    metrics: {
      latency: 0,
      audioLevel: 0,
    },
  });

  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const conversationRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  /**
   * Start conversation with ElevenLabs agent
   */
  const startConversation = useCallback(async (): Promise<boolean> => {
    // SSR safety check
    if (typeof window === 'undefined') {
      console.warn('[ElevenLabs] Cannot start conversation on server');
      return false;
    }
    
    // Wait for Conversation to be loaded
    if (!Conversation) {
      try {
        const mod = await import('@elevenlabs/client');
        Conversation = mod.Conversation;
      } catch (error) {
        console.error('[ElevenLabs] Failed to load SDK:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to load ElevenLabs SDK',
        }));
        return false;
      }
    }
    
    if (conversationRef.current) {
      console.warn('[ElevenLabs] Conversation already active');
      return false;
    }

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
      status: 'connecting',
    }));

    try {
      // Get conversation token from our signaling endpoint
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'get-token',
          callId,
          agentId,
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get conversation token');
      }

      const tokenData: TokenResponse = await response.json();
      console.log('[ElevenLabs] Got token for agent:', tokenData.agentName);

      // Start session using @elevenlabs/client SDK
      // Prefer WebRTC for lower latency, fallback to WebSocket
      const conversation = await Conversation.startSession({
        conversationToken: tokenData.token,
        connectionType: 'webrtc',
        
        // Callbacks
        onConnect: () => {
          console.log('[ElevenLabs] Connected');
          startTimeRef.current = Date.now();
          
          setState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            status: 'connected',
            error: null,
          }));

          // Start duration counter
          durationIntervalRef.current = setInterval(() => {
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const cost = (duration / 60) * ratePerMinute;
            
            setState(prev => ({
              ...prev,
              duration,
              cost,
            }));
          }, 1000);

          onConnect?.();
        },

        onDisconnect: () => {
          console.log('[ElevenLabs] Disconnected');
          
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }

          setState(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            status: 'disconnected',
            mode: 'idle',
          }));

          onDisconnect?.();
        },

        onMessage: (message: any) => {
          // Handle transcripts
          const { source, message: text } = message;
          
          if (text) {
            const speaker = source === 'user' ? 'user' : 'agent';
            // Consider all messages as final for simplicity
            const isFinal = true;
            
            setTranscripts(prev => [...prev, {
              text,
              speaker,
              timestamp: Date.now(),
              isFinal,
            }]);

            onTranscript?.(text, speaker, isFinal);
          }
        },

        onError: (error: any) => {
          console.error('[ElevenLabs] Error:', error);
          
          const errorMessage = typeof error === 'string' ? error : (error as Error).message || 'Conversation error';
          
          setState(prev => ({
            ...prev,
            error: errorMessage,
            isConnecting: false,
          }));

          onError?.(errorMessage);
        },

        onModeChange: (mode: any) => {
          setState(prev => ({
            ...prev,
            mode: mode as unknown as 'listening' | 'speaking' | 'idle',
          }));
        },

        onStatusChange: (status: any) => {
          setState(prev => ({
            ...prev,
            status: status as unknown as 'disconnected' | 'connecting' | 'connected',
          }));
        },
      });

      conversationRef.current = conversation;
      return true;

    } catch (error) {
      console.error('[ElevenLabs] Failed to start conversation:', error);
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to start conversation',
      }));

      onError?.(error instanceof Error ? error.message : 'Failed to start conversation');
      return false;
    }
  }, [agentId, userId, ratePerMinute, onTranscript, onError, onConnect, onDisconnect]);

  /**
   * End conversation
   */
  const endConversation = useCallback(async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession();
      } catch (error) {
        console.error('[ElevenLabs] Error ending session:', error);
      }
      conversationRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      status: 'disconnected',
      mode: 'idle',
    }));
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (conversationRef.current) {
      const newMuted = !isMuted;
      conversationRef.current.setMicMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  /**
   * Set volume (0-1)
   */
  const setVolume = useCallback(async (volume: number) => {
    if (conversationRef.current) {
      await conversationRef.current.setVolume({ volume });
    }
  }, []);

  /**
   * Send user message (text mode)
   */
  const sendMessage = useCallback((text: string) => {
    if (conversationRef.current) {
      conversationRef.current.sendUserMessage(text);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endConversation();
    };
  }, [endConversation]);

  return {
    state,
    transcripts,
    isMuted,
    startConversation,
    endConversation,
    toggleMute,
    setVolume,
    sendMessage,
  };
}

// ============================================
// WebRTC Support Check Hook
// ============================================

export function useWebRTCSupport() {
  const [isSupported, setIsSupported] = useState(false);
  const [permissions, setPermissions] = useState<{
    microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  }>({ microphone: 'unknown' });

  useEffect(() => {
    // SSR safety - only run in browser
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
