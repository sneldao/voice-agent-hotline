// ============================================
// Widget-Based Conversation Hook
// ============================================
// Drop-in replacement for useElevenLabsConversation that controls
// the global <elevenlabs-convai> widget engine instead of the raw SDK.
//
// Interface is intentionally identical so ActiveCall doesn't need
// significant logic changes.

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWidgetEngine } from '@/components/WidgetEngine';
import type { ConversationState, TranscriptMessage } from './useElevenLabsConversation';

// Re-export types so consumers can import from either hook
export type { ConversationState, TranscriptMessage };

// Agent ID mapping — same as in useElevenLabsConversation
const AGENT_ID_MAP: Record<string, string> = {
  general_helper: 'agent_2101khgsyd02fnvshvr7rzb50qj6',
  solana_sage: 'agent_9001khs0795af6ntqsskx7zk4yqp',
  code_reviewer: 'agent_9301khs07adxf6qrsyfst7xjv5aa',
  tour_master: 'agent_7701khqafe2fet2vq9m3m88896xv',
  web_researcher: 'agent_5301kmcn9c3sf2cswtga84kpcfk8',
  medical_advisor: 'agent_0601krex7tg2f43rjz96gvtxwwpk',
  voice_router: 'agent_1301krgw7ctveryscr9z894hmz6r',
};

interface WidgetConversationOptions {
  agentId: string;
  userId?: string;
  ratePerMinute?: number;
  useSignedUrl?: boolean;
  onTranscript?: (text: string, speaker: 'user' | 'agent', isFinal: boolean) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWidgetConversation(options: WidgetConversationOptions) {
  const {
    agentId,
    userId,
    ratePerMinute = 0.1,
    useSignedUrl = false,
    onTranscript,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const engine = useWidgetEngine();

  const [state, setState] = useState<ConversationState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    duration: 0,
    cost: 0,
    error: null,
    status: 'disconnected',
    mode: 'idle',
    metrics: { latency: 0, audioLevel: 0 },
  });

  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const intentionalEndRef = useRef(false);
  const eventCleanupRef = useRef<Array<() => void>>([]);

  // Resolve the ElevenLabs agent ID from our internal key
  const resolvedAgentId = AGENT_ID_MAP[agentId] || agentId;

  /**
   * Subscribe to widget events for state tracking
   */
  const attachEventListeners = useCallback(() => {
    // Clean up previous listeners
    eventCleanupRef.current.forEach((cleanup) => cleanup());
    eventCleanupRef.current = [];

    const listen = (event: string, handler: EventListener) => {
      const cleanup = engine.addEventListener(event, handler);
      eventCleanupRef.current.push(cleanup);
    };

    // Connection events
    const connectionEvents = ['connect', 'connected', 'conversation-start', 'conversationStarted'];
    connectionEvents.forEach((evt) => {
      listen(evt, () => {
        console.log(`[WidgetConversation] Event: ${evt}`);
        startTimeRef.current = Date.now();
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          status: 'connected',
          error: null,
        }));

        // Start duration counter
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = setInterval(() => {
          const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
          const cost = (duration / 60) * ratePerMinute;
          setState((prev) => ({ ...prev, duration, cost }));
        }, 1000);

        onConnect?.();
      });
    });

    // Disconnection events
    const disconnectEvents = ['disconnect', 'disconnected', 'conversation-end', 'conversationEnded'];
    disconnectEvents.forEach((evt) => {
      listen(evt, () => {
        console.log(`[WidgetConversation] Event: ${evt}`);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          isReconnecting: false,
          status: 'disconnected',
          mode: 'idle',
        }));

        if (!intentionalEndRef.current) {
          onDisconnect?.();
        }
        intentionalEndRef.current = false;
      });
    });

    // Transcript/message events
    const messageEvents = ['message', 'transcript'];
    messageEvents.forEach((evt) => {
      listen(evt, ((event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (!detail) return;

        const text = detail.text || detail.message || '';
        const speaker = detail.source === 'user' || detail.role === 'user' ? 'user' : 'agent';
        const isFinal = detail.isFinal !== false;

        if (text) {
          const msg: TranscriptMessage = {
            text,
            speaker,
            timestamp: Date.now(),
            isFinal,
          };
          setTranscripts((prev) => [...prev, msg]);
          onTranscript?.(text, speaker, isFinal);
        }
      }) as EventListener);
    });

    // Mode change events
    listen('mode-change', ((event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.mode) {
        setState((prev) => ({ ...prev, mode: detail.mode }));
      }
    }) as EventListener);

    // Error events
    const errorEvents = ['error', 'elevenlabs-convai:error'];
    errorEvents.forEach((evt) => {
      listen(evt, ((event: Event) => {
        const detail = (event as CustomEvent).detail;
        const message = detail?.message || detail?.error || 'Widget error';
        console.error(`[WidgetConversation] Error event: ${evt}`, detail);
        setState((prev) => ({ ...prev, error: message, isConnecting: false }));
        onError?.(message);
      }) as EventListener);
    });
  }, [engine, ratePerMinute, onConnect, onDisconnect, onTranscript, onError]);

  /**
   * Start a conversation through the widget
   */
  const startConversation = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    if (state.isConnected || state.isConnecting) {
      console.warn('[WidgetConversation] Already connected or connecting');
      return false;
    }

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
      status: 'connecting',
    }));

    intentionalEndRef.current = false;
    setTranscripts([]);

    try {
      // If signed URL mode, fetch from our backend
      if (useSignedUrl) {
        const callId = `widget_${Date.now()}`;
        const response = await fetch('/api/webrtc/signal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'get-token',
            callId,
            agentId,
            userId: userId || 'anonymous',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get signed URL from server');
        }

        const data = await response.json();
        if (data.signedUrl) {
          engine.setSignedUrl(data.signedUrl);
        } else {
          // Fall back to resolved agent ID
          engine.setAgentId(data.elevenLabsAgentId || resolvedAgentId);
        }
      } else {
        engine.setAgentId(resolvedAgentId);
      }

      // Attach event listeners before starting
      attachEventListeners();

      // Give the widget a moment to register the new agent-id attribute
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start the conversation
      const started = await engine.startConversation();

      if (!started) {
        throw new Error('Widget failed to start conversation — no method or button available');
      }

      // If no connection event fires within 15s, consider it failed
      const timeout = setTimeout(() => {
        if (!state.isConnected) {
          setState((prev) => {
            if (prev.isConnecting) {
              return {
                ...prev,
                isConnecting: false,
                error: 'Connection timed out. The widget did not connect within 15 seconds.',
                status: 'disconnected',
              };
            }
            return prev;
          });
        }
      }, 15000);

      // Clean up timeout if we connect
      const cleanupTimeout = engine.addEventListener('connect', () => {
        clearTimeout(timeout);
        cleanupTimeout();
      });
      const cleanupTimeout2 = engine.addEventListener('connected', () => {
        clearTimeout(timeout);
        cleanupTimeout2();
      });
      const cleanupTimeout3 = engine.addEventListener('conversation-start', () => {
        clearTimeout(timeout);
        cleanupTimeout3();
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start widget conversation';
      console.error('[WidgetConversation] Start failed:', error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: message,
        status: 'disconnected',
      }));
      onError?.(message);
      return false;
    }
  }, [
    state.isConnected,
    state.isConnecting,
    useSignedUrl,
    agentId,
    userId,
    resolvedAgentId,
    engine,
    attachEventListeners,
    onError,
  ]);

  /**
   * End the conversation
   */
  const endConversation = useCallback(() => {
    intentionalEndRef.current = true;

    engine.endConversation();

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      status: 'disconnected',
      mode: 'idle',
    }));
  }, [engine]);

  /**
   * Toggle mute — tries widget method, falls back to audio track manipulation
   */
  const toggleMute = useCallback(() => {
    const el = engine.getElement() as any;
    if (!el) return;

    const newMuted = !isMuted;

    // Try known mute methods
    if (typeof el.setMicMuted === 'function') {
      el.setMicMuted(newMuted);
    } else if (typeof el.toggleMute === 'function') {
      el.toggleMute();
    } else if (typeof el.mute === 'function' && newMuted) {
      el.mute();
    } else if (typeof el.unmute === 'function' && !newMuted) {
      el.unmute();
    }

    setIsMuted(newMuted);
  }, [engine, isMuted]);

  /**
   * Set volume (0-1)
   */
  const setVolume = useCallback((volume: number) => {
    const el = engine.getElement() as any;
    if (!el) return;

    if (typeof el.setVolume === 'function') {
      el.setVolume(volume);
    } else if (typeof el.setOutputVolume === 'function') {
      el.setOutputVolume(volume);
    }
  }, [engine]);

  /**
   * Send a text message (if supported)
   */
  const sendMessage = useCallback((text: string) => {
    const el = engine.getElement() as any;
    if (!el) return;

    if (typeof el.sendUserMessage === 'function') {
      el.sendUserMessage(text);
    } else if (typeof el.sendMessage === 'function') {
      el.sendMessage(text);
    }
  }, [engine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventCleanupRef.current.forEach((cleanup) => cleanup());
      eventCleanupRef.current = [];
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

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
