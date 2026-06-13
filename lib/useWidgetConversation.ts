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

// Re-export types for consumers
export interface ConversationState {
  isConnected: boolean;
  isConnecting: boolean;
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
    useSignedUrl = true, // Default to signed URLs — probe confirmed they work
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

  /**
   * Transcript array — populated exclusively by the ElevenLabs webhook
   * (app/api/webhooks/elevenlabs/route.ts) after the call ends. The widget
   * does NOT emit transcript events, so this array stays empty during the
   * live call regardless of what the user says.
   */
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const intentionalEndRef = useRef(false);
  const eventCleanupRef = useRef<Array<() => void>>([]);
  const connectedRef = useRef(false);
  const sseControllerRef = useRef<AbortController | null>(null);
  const callIdRef = useRef<string>('');

  // agentId is our internal key (e.g. 'general_helper').
  // Resolution to an ElevenLabs agent ID happens server-side in /api/webrtc/signal
  // via the canonical AGENT_REGISTRY, keeping IDs in a single source of truth.

  // Centralized connection state handlers
  const handleConnected = useCallback(() => {
    if (connectedRef.current) return; // Deduplicate
    connectedRef.current = true;
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

    // Connect to SSE endpoint for live transcripts
    if (callIdRef.current) {
      connectSSE(callIdRef.current);
    }
  }, [ratePerMinute, onConnect]);

  const handleDisconnected = useCallback(() => {
    if (!connectedRef.current) return; // Deduplicate
    connectedRef.current = false;

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

    // Disconnect from SSE endpoint
    disconnectSSE();
  }, [onDisconnect]);

  /**
   * Connect to SSE endpoint for live transcript streaming
   */
  const connectSSE = useCallback((callId: string) => {
    // Clean up any existing connection
    disconnectSSE();

    callIdRef.current = callId;
    const sseUrl = `/api/transcripts?callId=${encodeURIComponent(callId)}`;

    sseControllerRef.current = new AbortController();

    fetch(sseUrl, {
      signal: sseControllerRef.current.signal,
    })
      .then((response) => {
        if (!response.ok || !response.body) {
          throw new Error('SSE connection failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                // Stream ended
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  const eventType = line.slice(7).trim();
                  const dataLineIdx = line.indexOf('data: ');
                  if (dataLineIdx === -1) continue;

                  const dataStr = line.slice(dataLineIdx + 6).trim();
                  if (!dataStr) continue;

                  try {
                    const data = JSON.parse(dataStr);

                    if (eventType === 'transcript') {
                      const msg: TranscriptMessage = {
                        text: data.text,
                        speaker: data.speaker === 'user' ? 'user' : 'agent',
                        timestamp: data.timestamp,
                        isFinal: data.isFinal,
                      };
                      setTranscripts((prev) => [...prev, msg]);
                      onTranscript?.(msg.text, msg.speaker, msg.isFinal);
                    } else if (eventType === 'connected') {
                      console.log('[WidgetConversation] SSE connected for call:', callId);
                    } else if (eventType === 'error') {
                      console.error('[WidgetConversation] SSE error:', data.message);
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              }

              read();
            })
            .catch(() => {
              // Read error or aborted
            });
        }

        read();
      })
      .catch(() => {
        // Fetch error or aborted
      });
  }, [onTranscript]);

  /**
   * Disconnect from SSE endpoint
   */
  const disconnectSSE = useCallback(() => {
    if (sseControllerRef.current) {
      sseControllerRef.current.abort();
      sseControllerRef.current = null;
    }
    callIdRef.current = '';
  }, []);

  /**
   * Subscribe to widget events for state tracking.
   * 
   * Probe results (2026-05-13): The widget does NOT emit custom events on the
   * host element. We listen anyway in case future versions add them, but the
   * primary connection detection uses a MutationObserver on the shadow DOM
   * and a polling check on the widget's internal state.
   */
  const attachEventListeners = useCallback(() => {
    // Clean up previous listeners
    eventCleanupRef.current.forEach((cleanup) => cleanup());
    eventCleanupRef.current = [];

    const listen = (event: string, handler: EventListener) => {
      const cleanup = engine.addEventListener(event, handler);
      eventCleanupRef.current.push(cleanup);
    };

    // Connection events (may not fire — kept for forward compatibility)
    const connectionEvents = ['connect', 'connected', 'conversation-start', 'conversationStarted'];
    connectionEvents.forEach((evt) => {
      listen(evt, () => {
        console.log(`[WidgetConversation] Event: ${evt}`);
        handleConnected();
      });
    });

    // Disconnection events
    const disconnectEvents = ['disconnect', 'disconnected', 'conversation-end', 'conversationEnded'];
    disconnectEvents.forEach((evt) => {
      listen(evt, () => {
        console.log(`[WidgetConversation] Event: ${evt}`);
        handleDisconnected();
      });
    });

    // NOTE: Transcript events are NOT emitted by the widget (probe 2026-05-13).
    // The handler below is commented out to avoid wasted CPU cycles.
    // Real-time transcripts are delivered by the ElevenLabs webhook instead.
    // const messageEvents = ['message', 'transcript'];
    // messageEvents.forEach((evt) => {
    //   listen(evt, ((event: Event) => {
    //     const detail = (event as CustomEvent).detail;
    //     if (!detail) return;
    //
    //     const text = detail.text || detail.message || '';
    //     const speaker = detail.source === 'user' || detail.role === 'user' ? 'user' : 'agent';
    //     const isFinal = detail.isFinal !== false;
    //
    //     if (text) {
    //       const msg: TranscriptMessage = {
    //         text,
    //         speaker,
    //         timestamp: Date.now(),
    //         isFinal,
    //       };
    //       setTranscripts((prev) => [...prev, msg]);
    //       onTranscript?.(text, speaker, isFinal);
    //     }
    //   }) as EventListener);
    // });

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

    // Shadow DOM MutationObserver — detect when the widget's internal UI
    // changes to indicate an active conversation (e.g. button state change,
    // new child elements appearing)
    const el = engine.getElement();
    if (el?.shadowRoot) {
      const observer = new MutationObserver(() => {
        // Check if the shadow DOM now shows an "active" state
        // The widget typically shows a different UI when connected
        const shadowRoot = el.shadowRoot;
        if (!shadowRoot) return;
        
        // Look for indicators of an active conversation
        const buttons = shadowRoot.querySelectorAll('button');
        const hasMultipleButtons = buttons.length > 1;
        const hasActiveIndicator = shadowRoot.querySelector('[class*="active"], [class*="connected"], [data-state="active"]');
        
        if ((hasMultipleButtons || hasActiveIndicator) && !connectedRef.current) {
          handleConnected();
        }
      });

      observer.observe(el.shadowRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-state'],
      });

      eventCleanupRef.current.push(() => observer.disconnect());
    }
  }, [engine, handleConnected, handleDisconnected, onTranscript, onError]);

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

    // Store callId for SSE connection
    const callId = `widget_${Date.now()}`;
    callIdRef.current = callId;

    try {
      // If signed URL mode, fetch from our backend
      if (useSignedUrl) {
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
        } else if (data.elevenLabsAgentId) {
          engine.setAgentId(data.elevenLabsAgentId);
        } else {
          throw new Error('Server returned neither signedUrl nor elevenLabsAgentId');
        }
      } else {
        throw new Error('Signed URL mode is required — agent IDs are resolved server-side via the registry');
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

      // Since the widget doesn't emit connection events (probe confirmed),
      // we assume connected after a short delay if the button click succeeded.
      // The MutationObserver may also trigger handleConnected if the shadow DOM changes.
      setTimeout(() => {
        if (!connectedRef.current) {
          // Optimistic: assume connected since the button was clicked successfully
          handleConnected();
        }
      }, 1500);

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
    engine,
    attachEventListeners,
    handleConnected,
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

    connectedRef.current = false;

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
      disconnectSSE();
    };
  }, [disconnectSSE]);

  return {
    state,
    transcripts,
    isMuted,
    startConversation,
    endConversation,
    toggleMute,
    setVolume,
    sendMessage,
    // Expose callId for external SSE connections if needed
    callId: callIdRef.current,
  };
}
