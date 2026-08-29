'use client';

import { useState } from 'react';

/* ─────────────────────────────────────────────────────────
 * AGENT TRACE — expandable record of what a voice agent did
 *
 * Adapted from the ThinkingState ideal. Three voice-native
 * variants (no prose "reasoning" — the agent speaks that):
 *   Search  — web-search trace: query + sources read
 *   Tools   — tool execution: balance checks, repo reads, scrapes
 *   Steps   — call flow: connect → listen → respond → end
 *
 * The trace renders after a call settles (the ElevenLabs widget
 * does not emit live tool events), stays expandable, and reads
 * honestly empty when no record exists.
 * ───────────────────────────────────────────────────────── */

export interface TraceStep {
  id: string;
  label: string;
  /** Secondary line, e.g. the result summary or file name. */
  detail?: string;
  /** Render the secondary line in mono. */
  mono?: boolean;
  icon?: 'search' | 'wallet' | 'code' | 'run' | 'check';
  status?: 'done' | 'working' | 'failed';
}

interface AgentTraceProps {
  steps: TraceStep[];
  /** Label when work is still in flight (working steps present). */
  active?: string;
  /** Label when everything settled. */
  header?: string;
  /** Default to expanded on first render. */
  defaultExpanded?: boolean;
}

const ICON_PATHS: Record<NonNullable<TraceStep['icon']>, React.ReactNode> = {
  search: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></g>,
  wallet: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></g>,
  code: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l-6-6 6-6M15 6l6 6-6 6" /></g>,
  run: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-5-6-5M12 19h8" /></g>,
  check: <path d="M20 6L9 17l-5-5" />,
};

function iconFor(icon: TraceStep['icon'], size = 14) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={icon === 'check' ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon ?? 'check']}
    </svg>
  );
}

export default function AgentTrace({
  steps,
  active = 'Running tools',
  header,
  defaultExpanded = true,
}: AgentTraceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const working = steps.some((s) => s.status === 'working');
  const resolvedHeader = header ?? (steps.length === 1 ? 'Ran 1 tool' : `Ran ${steps.length} tools`);

  if (steps.length === 0) {
    return (
      <div className="flex w-full max-w-95 flex-col gap-1.5 rounded-[10px] bg-black/20 px-3 py-2.5">
        <span className="text-[12.5px] text-amber-100/40">
          No tool trace recorded for this call.
        </span>
        <span className="font-mono text-[11px] text-amber-100/30">
          Tool events are captured when the agent executes a skill.
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-95 flex-col">
      {/* header — expandable, mirrors ThinkingState grammar */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-lg px-1.5 py-1 transition-colors duration-100 hover:bg-amber-100/10"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={working ? 'rgba(253,230,138,0.7)' : 'rgba(253,230,138,0.4)'}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className="contents">
          {working ? (
            <span
              className="bg-clip-text whitespace-nowrap text-[13px] font-medium text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, rgba(253,230,138,0.35) 35%, #fde68a 50%, rgba(253,230,138,0.35) 65%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-text 1.6s linear infinite',
              }}
            >
              {active}
            </span>
          ) : (
            <span
              className="whitespace-nowrap text-[13px] font-medium text-amber-100/70"
              style={{ animation: 'fade-in 350ms ease-out both' }}
            >
              {resolvedHeader}
            </span>
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(253,230,138,0.4)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* expandable trace */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span aria-hidden className="absolute left-[3px] top-0 h-full w-px bg-amber-100/10" />
            <div className="flex flex-col gap-1 py-1">
              {steps.map((step, i) => {
                const failed = step.status === 'failed';
                return (
                  <div
                    key={step.id}
                    className="flex min-h-7 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5"
                    style={{ animation: `fade-up 320ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}
                  >
                    <span className={`shrink-0 ${failed ? 'text-red-400' : 'text-amber-100/50'}`}>
                      {iconFor(step.icon)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-amber-50">
                      {step.label}
                    </span>
                    {step.detail && (
                      <span
                        className={`shrink-0 text-[11.5px] text-amber-100/40 ${
                          step.mono ? 'font-mono' : ''
                        }`}
                      >
                        {step.detail}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}