'use client';

import { ChevronRight, ShieldCheck, Radio } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Stars } from '@/components/directory/Stars';
import { getPersona } from '@/lib/agent-personas';
import { useCountUp } from '@/lib/useCountUp';
import type { Agent } from '@/lib/types';

/** Deterministic 3-digit "dial code" derived from the agent id.
 *  Stable across renders, varies between agents, always in 100-999. */
function dialCodeFor(id: string): string {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  }
  return String(100 + (h % 900));
}

interface DirectoryRowProps {
  agent: Agent;
  onSelect: (a: Agent) => void;
  onVoicePreview?: (a: Agent) => void;
  /** Stagger delay in ms so the row animates in as part of a sequenced reveal. */
  revealDelay?: number;
  /** Whether this agent is currently on a call (from /api/activity/live only). */
  isLiveCall?: boolean;
}

export function DirectoryRow({ agent, onSelect, onVoicePreview, revealDelay = 0, isLiveCall = false }: DirectoryRowProps) {
  const codeRaw = dialCodeFor(agent.id);
  const codeTarget = Number(codeRaw);
  const codeValue = useCountUp(codeTarget, 720, 120 + revealDelay);
  const persona = getPersona(agent);
  const rating = Number(agent.rating) || 0;
  const rate = Number(agent.rate) || 0;

  return (
    <li className="directory-row-reveal" style={{ animationDelay: `${revealDelay}ms` }}>
      <button
        type="button"
        onClick={() => onSelect(agent)}
        className={`directory-row group ${isLiveCall ? 'directory-row--live-call' : ''}`}
        aria-label={`${agent.name} — ${persona.desk} desk, $${rate.toFixed(2)} per minute`}
      >
        <span className="directory-row__code" aria-hidden="true">
          {String(codeValue).padStart(3, '0')}
        </span>

        <span className="directory-row__avatar">
          <Avatar size="md" online={agent.online}>{agent.avatar}</Avatar>
        </span>

        <span className="directory-row__body">
          <span className="directory-row__name-row">
            <span className="truncate font-display text-[15px] font-bold text-amber-50">
              {agent.name}
            </span>
            {agent.verified && (
              <span
                className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"
                title="Verified agent"
              >
                <ShieldCheck className="h-3 w-3" />
              </span>
            )}
            {isLiveCall && (
              <span
                className="directory-row__live-dot"
                aria-label="Currently on a call"
                title="Someone is talking to this line right now"
              />
            )}
            <span className="directory-row__desk">
              <Radio className="h-3 w-3" />
              {persona.desk}
            </span>
          </span>
          <span className="directory-row__line">{persona.line}</span>
          <span className="directory-row__meta">
            <Stars rating={rating} />
            <span className="tabular-nums text-amber-100/65">{rating.toFixed(1)}</span>
            <span className="text-amber-100/25">·</span>
            {onVoicePreview && persona.voiceId && (
              <span
                className="voice-preview-chip"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onVoicePreview(agent);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onVoicePreview(agent);
                  }
                }}
                aria-label={`Preview ${agent.name}'s voice`}
              >
                {persona.voiceId}
              </span>
            )}
            {isLiveCall && (
              <>
                <span className="text-amber-100/25">·</span>
                <span className="agent-card-activity pulse-dot">
                  live now
                </span>
              </>
            )}
          </span>
        </span>

        <span className="directory-row__price-block">
          <span className="directory-row__price">
            <span className="text-[10px] font-medium opacity-65">$</span>
            {rate.toFixed(2)}
            <span className="text-[10px] font-medium opacity-65">/min</span>
          </span>
          <span className="directory-row__status">
            {agent.online ? (
              <span className="text-emerald-300/85">on air</span>
            ) : (
              <span className="text-amber-100/35">off line</span>
            )}
          </span>
        </span>

        <ChevronRight className="directory-row__chev" aria-hidden="true" />
      </button>
    </li>
  );
}
