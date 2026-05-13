// ============================================
// ElevenLabs Conversational AI Hook
// ============================================
// Proper integration using @elevenlabs/client SDK
// Replaces custom WebRTC with ElevenLabs native voice

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { signMessage } from './WalletContextNew';
import { generateCallId } from './ids';

export interface ConversationState {
  isConnected: boolean;
  isConnecting: boolean;
  /** True when we are auto-recovering from an unexpected disconnect. */
  isReconnecting: boolean;
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
    isReconnecting: false,
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
  // Cumulative billable seconds across reconnects within the same call.
  const accumulatedSecondsRef = useRef<number>(0);
  // When the *current* connection started (resets on each (re)connect).
  const segmentStartRef = useRef<number>(0);
  const intentionalDisconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectGiveUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 1 retry, ~1.2s delay → first attempt within ~1.5s, hard fail at 5s.
  const MAX_RECONNECT_ATTEMPTS = 1;
  const RECONNECT_DELAY_MS = 1200;
  const RECONNECT_HARD_TIMEOUT_MS = 5000;

  /**
   * Start conversation with ElevenLabs agent
   */
  const startConversation = useCallback(async (): Promise<boolean> => {
    // SSR safety check
    if (typeof window === 'undefined') {
      console.warn('[ElevenLabs] Cannot start conversation on server');
      return false;
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
      // Dynamically import the SDK to avoid SSR issues
      const { Conversation } = await import('@elevenlabs/client');
      
      // Get conversation token from our signaling endpoint
      const callId = generateCallId();
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Sign the call request with the connected wallet
      let authHeaders: Record<string, string> = {};
      try {
        const message = `voice-call:${callId}:${agentId}:${timestamp}`;
        const signature = await signMessage(message);
        const accounts = await (window as any).ethereum?.request({ method: 'eth_accounts' });
        if (accounts?.[0] && signature) {
          authHeaders = {
            'X-Wallet-Address': accounts[0],
            'X-Signature': signature,
            'X-Timestamp': timestamp,
          };
        }
      } catch {
        // Signing failed or user rejected — proceed without auth (rate-limited)
      }

      const response = await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
      // Use agentId directly for simplest connection (matches dashboard behavior)
      const conversation = await Conversation.startSession({
        agentId: tokenData.elevenLabsAgentId,
        
        // Callbacks
          onConnect: () => {
            console.log('[ElevenLabs] Connected');
            const isReconnect = reconnectAttemptsRef.current > 0;
            // Start a new billable segment. accumulatedSecondsRef preserves
            // duration across reconnects so the user isn't billed for outage time.
            segmentStartRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
            // Cancel any pending hard-failure timer.
            if (reconnectGiveUpTimerRef.current) {
              clearTimeout(reconnectGiveUpTimerRef.current);
              reconnectGiveUpTimerRef.current = null;
            }

          setState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            status: 'connected',
            // Clear "Reconnecting…" sentinel; preserve real errors.
            error: isReconnect ? null : prev.error,
          }));

          // Start duration counter (continues from accumulated seconds).
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }
          durationIntervalRef.current = setInterval(() => {
            const segment = Math.floor((Date.now() - segmentStartRef.current) / 1000);
            const duration = accumulatedSecondsRef.current + segment;
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

          // Freeze duration: roll the live segment into the accumulated total
          // and stop the counter. Cost will not advance during the outage.
          if (segmentStartRef.current > 0) {
            const segment = Math.floor((Date.now() - segmentStartRef.current) / 1000);
            accumulatedSecondsRef.current += Math.max(0, segment);
            segmentStartRef.current = 0;
          }
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }

          conversationRef.current = null;

          // Auto-reconnect on unexpected disconnect
          if (!intentionalDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            console.log(`[ElevenLabs] Reconnecting (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

            setState(prev => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
              isReconnecting: true,
              status: 'connecting',
              // Don't surface as a hard error — UI shows a banner instead.
              error: null,
            }));

            // Hard ceiling: if we don't recover within RECONNECT_HARD_TIMEOUT_MS,
            // give up and show the failure UI.
            reconnectGiveUpTimerRef.current = setTimeout(() => {
              if (!conversationRef.current) {
                console.warn('[ElevenLabs] Reconnect window expired');
                reconnectAttemptsRef.current = 0;
                intentionalDisconnectRef.current = false;
                setState(prev => ({
                  ...prev,
                  isConnected: false,
                  isConnecting: false,
                  isReconnecting: false,
                  status: 'disconnected',
                  mode: 'idle',
                  error: 'Connection lost. Please try again.',
                }));
                onDisconnect?.();
              }
            }, RECONNECT_HARD_TIMEOUT_MS);

            reconnectTimerRef.current = setTimeout(() => {
              startConversation();
            }, RECONNECT_DELAY_MS);
            return;
          }

          reconnectAttemptsRef.current = 0;
          intentionalDisconnectRef.current = false;

          setState(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            isReconnecting: false,
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
    intentionalDisconnectRef.current = true;
    reconnectAttemptsRef.current = 0;

    // Cancel any pending reconnect / give-up timers.
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (reconnectGiveUpTimerRef.current) {
      clearTimeout(reconnectGiveUpTimerRef.current);
      reconnectGiveUpTimerRef.current = null;
    }

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

    // Final flush: roll any in-flight segment into accumulated seconds so the
    // caller (ActiveCall.handleEnd) sees the right `duration` / `cost`.
    if (segmentStartRef.current > 0) {
      const segment = Math.floor((Date.now() - segmentStartRef.current) / 1000);
      accumulatedSecondsRef.current += Math.max(0, segment);
      segmentStartRef.current = 0;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      status: 'disconnected',
      mode: 'idle',
    }));

    // Reset for next conversation.
    accumulatedSecondsRef.current = 0;
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
