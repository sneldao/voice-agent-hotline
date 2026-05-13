'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Mic, Phone, X } from 'lucide-react';
import type { Agent } from '@/lib/types';

/**
 * Voice Router — ElevenLabs-native intent routing.
 *
 * Instead of using the flaky browser SpeechRecognition API, this component
 * starts an ElevenLabs Conversational AI session with a dedicated "Router Agent."
 * The Router Agent asks what the user needs, classifies intent via its LLM,
 * and calls a `route_to_agent` client tool. Our app receives the tool call
 * and connects the user to the matched specialist.
 *
 * Flow: Tap mic → ElevenLabs session starts → Router says "What do you need?"
 * → User speaks → Router calls route_to_agent → App shows match → User confirms → Call starts.
 */

type RouterState = 'idle' | 'connecting' | 'listening' | 'routing' | 'matched';

interface VoiceRouterProps {
  agents: Agent[];
  onCallAgent: (agent: Agent) => void;
}

export function VoiceRouter({ agents, onCallAgent }: VoiceRouterProps) {
  const [state, setState] = useState<RouterState>('idle');
  const [matchedAgent, setMatchedAgent] = useState<Agent | null>(null);
  const [routeReason, setRouteReason] = useState('');
  const [errorText, setErrorText] = useState('');
  const conversationRef = useRef<any>(null);
  const routerAgentId = process.env.NEXT_PUBLIC_ROUTER_AGENT_ID || 'voice_router';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        try { conversationRef.current.endSession(); } catch {}
        conversationRef.current = null;
      }
    };
  }, []);

  const startRouter = useCallback(async () => {
    setState('connecting');
    setErrorText('');
    setMatchedAgent(null);
    setRouteReason('');

    try {
      // Get a conversation token for the router agent
      const tokenRes = await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'get-token',
          callId: `router_${Date.now()}`,
          agentId: routerAgentId,
          userId: 'router_session',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || 'Could not start voice router');
      }

      const tokenData = await tokenRes.json();

      // Dynamically import the ElevenLabs client SDK
      const { Conversation } = await import('@elevenlabs/client');

      const conversation = await Conversation.startSession({
        conversationToken: tokenData.token,
        connectionType: 'webrtc',

        clientTools: {
          // The Router Agent calls this when it identifies the right specialist
          route_to_agent: async ({ agent_key, reason }: { agent_key: string; reason: string }) => {
            const matched = agents.find(a =>
              a.id === agent_key ||
              a.id.includes(agent_key) ||
              (a.category || '').toLowerCase() === agent_key
            );

            if (matched) {
              setMatchedAgent(matched);
              setRouteReason(reason || matched.specialty);
              setState('matched');
              // End the router session — we're done routing
              try { conversationRef.current?.endSession(); } catch {}
              conversationRef.current = null;
              return { success: true, routed_to: matched.name };
            }

            // Fallback: route to first available agent
            const fallback = agents[0];
            if (fallback) {
              setMatchedAgent(fallback);
              setRouteReason(reason || 'General assistance');
              setState('matched');
              try { conversationRef.current?.endSession(); } catch {}
              conversationRef.current = null;
              return { success: true, routed_to: fallback.name };
            }

            return { success: false, error: 'No agents available' };
          },
        },

        onConnect: () => {
          setState('listening');
        },

        onDisconnect: () => {
          // Only reset if we haven't matched yet
          if (!matchedAgent) {
            setState('idle');
          }
          conversationRef.current = null;
        },

        onError: (error: any) => {
          console.error('[VoiceRouter] Error:', error);
          setErrorText('Voice connection failed. Try tapping an agent directly.');
          setState('idle');
          conversationRef.current = null;
        },
      });

      conversationRef.current = conversation;
    } catch (error) {
      console.error('[VoiceRouter] Failed to start:', error);
      setErrorText(error instanceof Error ? error.message : 'Could not start voice router');
      setState('idle');
    }
  }, [agents, routerAgentId]);

  const reset = useCallback(() => {
    if (conversationRef.current) {
      try { conversationRef.current.endSession(); } catch {}
      conversationRef.current = null;
    }
    setState('idle');
    setMatchedAgent(null);
    setRouteReason('');
    setErrorText('');
  }, []);

  const handleMicClick = useCallback(() => {
    if (state === 'idle') {
      void startRouter();
    } else {
      reset();
    }
  }, [state, startRouter, reset]);

  const micStyles = {
    idle: 'h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105',
    connecting: 'h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 animate-pulse',
    listening: 'h-24 w-24 bg-gradient-to-br from-cyan-400 to-blue-500 shadow-xl shadow-cyan-500/50 scale-110',
    routing: 'h-20 w-20 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30',
    matched: 'h-20 w-20 bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30',
  };

  const statusText = {
    idle: 'Tap to speak your request',
    connecting: 'Connecting to operator...',
    listening: 'Operator is listening — speak naturally',
    routing: 'Finding the right voice...',
    matched: 'Match found — tap to connect',
  };

  return (
    <div className="relative rounded-2xl border border-gray-800 bg-gray-900/90 p-6 text-center">
      {/* Routing animation rings */}
      {(state === 'listening') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/20 animate-ping" />
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/10 animate-ping" style={{ animationDelay: '0.5s' }} />
        </div>
      )}

      {/* Mic button */}
      <div className="relative z-10 mb-4 flex justify-center">
        <button
          onClick={handleMicClick}
          className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${micStyles[state]}`}
          aria-label={state === 'idle' ? 'Start voice request' : 'Cancel'}
        >
          {state === 'connecting' ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : state === 'matched' ? (
            <Phone className="h-8 w-8 text-white" />
          ) : (
            <Mic className={`text-white ${state === 'listening' ? 'h-10 w-10' : 'h-8 w-8'}`} />
          )}
        </button>
      </div>

      {/* Status */}
      <p className="relative z-10 mb-2 text-sm font-medium text-gray-300">
        {statusText[state]}
      </p>

      {/* Matched agent card */}
      {matchedAgent && state === 'matched' && (
        <div className="relative z-10 mx-auto mb-3 max-w-sm rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${matchedAgent.color || 'from-cyan-500 to-blue-500'} text-lg`}>
              {matchedAgent.avatar || matchedAgent.name.charAt(0)}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-semibold text-white">{matchedAgent.name}</p>
              <p className="truncate text-xs text-emerald-200">{routeReason || matchedAgent.specialty}</p>
            </div>
            <button
              onClick={() => { onCallAgent(matchedAgent); reset(); }}
              className="ml-auto flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-400"
              aria-label="Connect now"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {errorText && (
        <p className="relative z-10 mx-auto max-w-sm text-xs text-red-300">{errorText}</p>
      )}

      {/* Cancel button when active */}
      {state !== 'idle' && state !== 'matched' && (
        <button
          onClick={reset}
          className="relative z-10 mx-auto mt-2 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      )}

      {/* Idle hint */}
      {state === 'idle' && !errorText && (
        <p className="relative z-10 mt-1 text-xs text-gray-500">
          Or tap an agent below to call directly
        </p>
      )}
    </div>
  );
}
