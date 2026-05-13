'use client';

import { useState, useCallback } from 'react';
import { Loader2, Mic } from 'lucide-react';
import type { Agent } from '@/lib/types';

/**
 * Voice Router — One-tap voice concierge.
 *
 * Tapping the mic immediately starts a call with the General Helper agent
 * (the AI concierge). No intermediate routing step — just speak and get help.
 *
 * This delegates ALL voice handling to ElevenLabs (ASR, LLM, TTS, turn-taking)
 * instead of using the flaky browser SpeechRecognition API.
 */

interface VoiceRouterProps {
  agents: Agent[];
  onCallAgent: (agent: Agent) => void;
}

export function VoiceRouter({ agents, onCallAgent }: VoiceRouterProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  // Find the concierge agent (general_helper) or fall back to first available
  const concierge = agents.find(a => a.id === 'general_helper') || agents[0];

  const handleMicClick = useCallback(() => {
    if (!concierge || isConnecting) return;
    setIsConnecting(true);
    onCallAgent(concierge);
    // Reset after a short delay (the page will transition to ActiveCall)
    setTimeout(() => setIsConnecting(false), 2000);
  }, [concierge, isConnecting, onCallAgent]);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/90 p-6 text-center">
      {/* Mic button */}
      <div className="mb-4 flex justify-center">
        <button
          onClick={handleMicClick}
          disabled={!concierge || isConnecting}
          className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
            isConnecting
              ? 'h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 animate-pulse'
              : 'h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Start voice call with concierge"
        >
          {isConnecting ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </button>
      </div>

      {/* Status text */}
      <p className="mb-1 text-sm font-medium text-gray-300">
        {isConnecting ? 'Connecting to concierge...' : 'Tap to talk to the AI concierge'}
      </p>
      <p className="text-xs text-gray-500">
        {isConnecting
          ? 'Setting up your voice session'
          : 'Say what you need — booking, research, debugging, anything'}
      </p>
    </div>
  );
}
