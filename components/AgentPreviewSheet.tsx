'use client';

import { useState } from 'react';
import { CheckCircle, Phone, Radio, Shield, Sparkles, Wallet, X, Volume2 } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { Button } from './ui/Button';
import { useAudioPreview } from '@/lib/useAudioPreview';

interface AgentPreviewSheetProps {
  agent: Agent | null;
  connected: boolean;
  userBalance: number;
  isConnectingWallet: boolean;
  isStartingCall: boolean;
  hasFreeCall?: boolean;
  onClose: () => void;
  onConnect: () => void;
  onCallNow: (agent: Agent) => void;
}

const EXAMPLES_BY_CATEGORY: Record<string, string[]> = {
  healthcare: ['Summarize symptoms for a doctor visit', 'Explain a lab result in plain language'],
  research: ['Find the strongest argument on a topic', 'Turn a question into a research plan'],
  tech: ['Debug an implementation plan', 'Compare tools for a build decision'],
  blockchain: ['Explain a wallet or transaction', 'Talk through a DeFi concept'],
  general: ['Brainstorm next steps', 'Practice a difficult conversation'],
};

const PREVIEW_PERSONAS: Record<string, { desk: string; voice: string; promise: string }> = {
  solana_sage: { desk: 'Chain Desk', voice: 'Precise and technical', promise: 'Best when you need a plain-English read on wallets, DeFi, or transactions.' },
  code_reviewer: { desk: 'Debug Desk', voice: 'Direct senior engineer', promise: 'Best when you need to talk through bugs, architecture, or review tradeoffs.' },
  general_helper: { desk: 'Life Admin', voice: 'Warm concierge', promise: 'Best when you need a hands-free assistant for errands, reminders, or research.' },
  tour_master: { desk: 'Travel Desk', voice: 'Upbeat local guide', promise: 'Best when you need ideas, routes, budgets, or itinerary planning.' },
  web_researcher: { desk: 'Research Desk', voice: 'Thorough analyst', promise: 'Best when you need current information with sources and synthesis.' },
  medical_advisor: { desk: 'Health Prep', voice: 'Calm and careful', promise: 'Best when you need educational health information or visit prep questions.' },
};

function getExamples(agent: Agent): string[] {
  const category = agent.category?.toLowerCase() || '';
  const specialty = agent.specialty || agent.category || 'this agent';
  return EXAMPLES_BY_CATEGORY[category] || [
    `Ask about ${specialty.toLowerCase()}`,
    'Get a quick second opinion before acting',
  ];
}

function getPreviewPersona(agent: Agent) {
  return PREVIEW_PERSONAS[agent.id] || {
    desk: agent.category ? `${agent.category} Desk` : 'Hotline Desk',
    voice: 'Helpful voice agent',
    promise: agent.bio || agent.specialty,
  };
}

export function AgentPreviewSheet({
  agent,
  connected,
  userBalance,
  isConnectingWallet,
  isStartingCall,
  hasFreeCall = false,
  onClose,
  onConnect,
  onCallNow,
}: AgentPreviewSheetProps) {
  const audioPreview = useAudioPreview();

  if (!agent) return null;

  const rate = Number(agent.rate) || 0;
  const maxBudget = rate > 0 ? Math.max(rate * 5, 0.5) : 0;
  const hasEnoughBalance = !connected || userBalance >= Math.min(maxBudget, 0.5);
  const examples = getExamples(agent);
  const persona = getPreviewPersona(agent);

  return (
    <div className="fixed inset-0 z-[60] flex h-dvh items-end justify-center overflow-y-auto bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-4 border-b border-gray-800 p-4">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${agent.color || 'from-cyan-500 to-blue-500'} text-2xl`}>
            {agent.avatar || agent.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-white">{agent.name}</h2>
                <p className="text-sm text-gray-400">{agent.specialty}</p>
              </div>
              <div className="flex items-center gap-2">
                {audioPreview.hasPreview(agent.id) && (
                  <button
                    type="button"
                    onClick={() => audioPreview.toggle(agent.id)}
                    className={`rounded-full p-2 transition-colors ${
                      audioPreview.isPlaying && audioPreview.playingAgentId === agent.id
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                    aria-label={audioPreview.isPlaying && audioPreview.playingAgentId === agent.id ? 'Stop preview' : 'Play voice preview'}
                  >
                    <Volume2 className={`h-4 w-4 ${audioPreview.isPlaying && audioPreview.playingAgentId === agent.id ? 'animate-pulse' : ''}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                  aria-label="Close agent preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                <Radio className="h-3.5 w-3.5" />
                {persona.desk}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                {persona.voice}
              </span>
            </div>
            <p className="text-sm leading-6 text-gray-300">{persona.promise}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
              <p className="text-xs text-gray-500">Rate</p>
              <p className="mt-1 text-lg font-bold text-cyan-300">${rate.toFixed(2)}/min</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
              <p className="text-xs text-gray-500">Suggested cap</p>
              <p className="mt-1 text-lg font-bold text-white">${maxBudget.toFixed(2)}</p>
            </div>
          </div>

          {/* Social proof stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-2.5 text-center">
              <p className="text-sm font-bold text-white">{agent.calls || 0}</p>
              <p className="text-[10px] text-gray-500">calls</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-2.5 text-center">
              <p className="text-sm font-bold text-amber-300">⭐ {(agent.rating || 4.5).toFixed(1)}</p>
              <p className="text-[10px] text-gray-500">rating</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-2.5 text-center">
              <p className="text-sm font-bold text-white">~3 min</p>
              <p className="text-[10px] text-gray-500">avg call</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle className="h-4 w-4 text-cyan-400" />
              What this agent can do
            </p>
            <div className="space-y-2">
              {examples.map((example) => (
                <p key={example} className="text-sm text-gray-400">{example}</p>
              ))}
            </div>
          </div>

          {!connected ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Wallet className="h-4 w-4" />
                {hasFreeCall ? 'First call is on us' : 'Wallet required for paid calls'}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-100/80">
                {hasFreeCall
                  ? 'No wallet needed — try a free call and see how it feels.'
                  : 'Connect before starting so the hotline can settle against a real address.'}
              </p>
            </div>
          ) : !hasEnoughBalance ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              Balance may be too low for the suggested call cap.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <Shield className="h-4 w-4" />
              Ready to call. Microphone permission will be checked next.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-800 p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {connected ? (
            <Button
              type="button"
              onClick={() => onCallNow(agent)}
              isLoading={isStartingCall}
              disabled={isStartingCall}
            >
              <Phone className="h-4 w-4" />
              Start voice call
            </Button>
          ) : hasFreeCall ? (
            <Button
              type="button"
              onClick={() => onCallNow(agent)}
              isLoading={isStartingCall}
              disabled={isStartingCall}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500"
            >
              <Phone className="h-4 w-4" />
              Try free call
            </Button>
          ) : (
            <Button type="button" onClick={onConnect} isLoading={isConnectingWallet}>
              <Wallet className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
