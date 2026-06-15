'use client';

import React from 'react';
import { Radio, ShieldCheck, Star, PhoneForwarded } from 'lucide-react';
import { Avatar } from '@/components/ui';
import type { Agent } from '@/lib/types';

const STAR_COLORS = [
  'text-yellow-400 fill-yellow-400',
  'text-yellow-400 fill-yellow-400/50',
  'text-gray-600',
];

function getStarClass(index: number, fullStars: number, hasHalfStar: boolean): string {
  if (index < fullStars) return STAR_COLORS[0];
  if (index === fullStars && hasHalfStar) return STAR_COLORS[1];
  return STAR_COLORS[2];
}

export const Stars = React.memo(function Stars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <Star key={i} className={`w-4 h-4 ${getStarClass(i, fullStars, hasHalfStar)}`} />
      ))}
    </div>
  );
});

const AGENT_PERSONAS: Record<string, { desk: string; tone: string; line: string; voiceId: string }> = {
  solana_sage: { desk: 'Chain Desk', tone: 'Precise', line: 'Wallets, transactions, DeFi signals', voiceId: 'Josh' },
  code_reviewer: { desk: 'Debug Desk', tone: 'Direct', line: 'Architecture, bugs, repo reviews', voiceId: 'Antoni' },
  general_helper: { desk: 'Life Admin', tone: 'Warm', line: 'Booking, reminders, everyday tasks', voiceId: 'Adam' },
  tour_master: { desk: 'Travel Desk', tone: 'Upbeat', line: 'Trips, routes, local plans', voiceId: 'Rachel' },
  web_researcher: { desk: 'Research Desk', tone: 'Thorough', line: 'Sources, summaries, current info', voiceId: 'Steve' },
  medical_advisor: { desk: 'Health Prep', tone: 'Calm', line: 'Questions, symptoms, visit prep', voiceId: 'Sarah' },
};

export function getPersona(agent: Agent) {
  return AGENT_PERSONAS[agent.id] || {
    desk: agent.category ? `${agent.category} Desk` : 'Hotline Desk',
    tone: 'helpful',
    line: agent.specialty,
    voiceId: 'Custom',
  };
}

/** Simulated live activity count per agent — would be real in production */
function getActivityCount(agent: Agent): number {
  // Deterministic but varied by agent
  const seed = agent.id.charCodeAt(0) + agent.id.charCodeAt(agent.id.length - 1);
  if (agent.id === 'general_helper') return 12;
  if (agent.id === 'medical_advisor') return 7;
  if (agent.id === 'code_reviewer') return 5;
  if (agent.id === 'web_researcher') return 4;
  if (agent.id === 'solana_sage') return 3;
  if (agent.id === 'tour_master') return 2;
  return (seed % 8) + 1;
}

export const AgentCard = React.memo(function AgentCard({
  agent,
  onClick,
  onVoicePreview,
}: {
  agent: Agent;
  onClick: () => void;
  onVoicePreview?: (agent: Agent) => void;
}) {
  const rating = Number(agent.rating) || 0;
  const persona = getPersona(agent);
  const callers = getActivityCount(agent);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group operator-panel relative h-full w-full overflow-hidden rounded-[1.25rem] p-0 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0806] active:scale-[0.99]"
      aria-label={`${agent.name} — ${persona.tone} voice, $${Number(agent.rate).toFixed(2)}/min`}
    >
      {/* Left edge accent */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-200/60 via-red-500/80 to-black/20" />
      <div className="absolute bottom-4 left-4 right-16 patch-cord opacity-0 transition-opacity group-hover:opacity-100" />
      
      <div className="relative p-4">
        {/* Top: avatar + name + price */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="rounded-full border border-amber-100/25 bg-black/30 p-1 shadow-inner">
              <Avatar size="lg" online={agent.online}>{agent.avatar}</Avatar>
            </div>
            {agent.online && <div className="line-lamp absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-300 text-emerald-300" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="min-w-0 truncate text-[15px] font-bold text-amber-50">{agent.name}</span>
              {agent.verified && (
                <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300" title="Verified agent">
                  <ShieldCheck className="h-3 w-3" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-100/20 bg-black/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-100/80">
                <Radio className="h-3 w-3" />
                {persona.desk}
              </span>
              <Stars rating={rating} />
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgba(254,243,199,0.82)' }}>{rating.toFixed(1)}</span>
            </div>
          </div>
          
          {/* Price — visible on card */}
          <div className="flex-shrink-0 text-right">
            <div className="agent-card-price tabular-nums">
              ${Number(agent.rate).toFixed(2)}<span className="text-[10px] font-medium opacity-70">/min</span>
            </div>
          </div>
        </div>

        {/* Middle: voice preview + activity */}
        <div className="mt-3 flex items-center gap-2">
          {onVoicePreview && persona.voiceId && (
            <span
              className="voice-preview-chip"
              onClick={(e) => {
                e.stopPropagation();
                onVoicePreview(agent);
              }}
              role="button"
              aria-label={`Preview ${agent.name}'s voice`}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              {persona.voiceId} voice
            </span>
          )}
          {callers > 0 && (
            <span className="agent-card-activity pulse-dot">
              {callers} {callers === 1 ? 'caller' : 'callers'} now
            </span>
          )}
        </div>

        {/* Bottom: tagline + action hint */}
        <div className="mt-3 flex items-center justify-between">
          <p className="agent-card-body line-clamp-1 text-[13px]">{persona.line}</p>
          <div className="rounded-full border border-red-300/30 bg-red-500/15 p-1.5 transition-colors group-hover:bg-red-500/25 flex-shrink-0 ml-2">
            <PhoneForwarded className="h-3 w-3 text-red-100" />
          </div>
        </div>
      </div>
    </button>
  );
});

export const FeaturedCard = React.memo(function FeaturedCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full sm:flex-shrink-0 sm:w-36 rounded-2xl p-4 text-left transition-all duration-300 border-2 border-gray-800 bg-gray-900/50 hover:border-gray-700 active:scale-[0.98]"
    >
      <Avatar size="md" online={agent.online}>{agent.avatar}</Avatar>
      <div className="mt-3">
        <div className="font-semibold text-white text-sm truncate">{agent.name}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">{agent.specialty}</div>
        <div className="flex items-center gap-1 mt-2">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-gray-300">{(Number(agent.rating) || 0).toFixed(1)}</span>
        </div>
      </div>
    </button>
  );
});
