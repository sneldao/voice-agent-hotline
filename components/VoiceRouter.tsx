'use client';

import { useState, useCallback } from 'react';
import { Loader2, PhoneCall, Radio, Sparkles } from 'lucide-react';
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
    <div className="operator-panel hotline-grid relative overflow-hidden rounded-[1.5rem] p-5 text-center">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-amber-200/10" />
      <div className="pointer-events-none absolute bottom-6 left-5 right-5 patch-cord" />

      <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
        <div className="operator-label inline-flex items-center gap-2 rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
          <Radio className="h-3.5 w-3.5" />
          Operator
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-100/70">
          <span className={`line-lamp h-2.5 w-2.5 rounded-full ${concierge ? 'bg-emerald-300 text-emerald-300' : 'bg-red-400 text-red-400'}`} />
          {concierge ? 'Line open' : 'No line'}
        </div>
      </div>

      <div className="relative z-10 mb-5 flex justify-center">
        <button
          onClick={handleMicClick}
          disabled={!concierge || isConnecting}
          className={`rotary-dial relative flex items-center justify-center rounded-full transition-all duration-300 ${
            isConnecting
              ? 'h-28 w-28 animate-pulse'
              : 'h-28 w-28 hover:scale-[1.03]'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Start voice call with concierge"
        >
          <span className="absolute inset-4 rounded-full border border-amber-100/25" />
          <span className="absolute inset-8 rounded-full border border-black/40 bg-black/20" />
          {isConnecting ? (
            <Loader2 className="relative z-10 h-9 w-9 animate-spin text-amber-50" />
          ) : (
            <PhoneCall className="relative z-10 h-9 w-9 text-amber-50 drop-shadow" />
          )}
        </button>
      </div>

      <p className="relative z-10 mb-1 text-base font-bold text-amber-50">
        {isConnecting ? 'Connecting to concierge...' : 'Tap to talk to the AI concierge'}
      </p>
      <p className="relative z-10 mx-auto max-w-[15rem] text-xs leading-5 text-amber-100/65">
        {isConnecting
          ? 'Patching your call through the switchboard'
          : 'Say what you need: booking, research, debugging, anything'}
      </p>
      <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-100/55">
        {['Speak', 'Route', 'Connect'].map((step, index) => (
          <div key={step} className="rounded-md border border-amber-100/10 bg-black/20 px-2 py-1.5">
            <Sparkles className={`mx-auto mb-1 h-3 w-3 ${index === 1 ? 'text-red-300' : 'text-amber-200/70'}`} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
