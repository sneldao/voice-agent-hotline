'use client';

import { CheckCircle, Phone, Shield, Wallet, X } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { Button } from './ui/Button';

interface AgentPreviewSheetProps {
  agent: Agent | null;
  connected: boolean;
  userBalance: number;
  isConnectingWallet: boolean;
  isStartingCall: boolean;
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

function getExamples(agent: Agent): string[] {
  const category = agent.category?.toLowerCase() || '';
  return EXAMPLES_BY_CATEGORY[category] || [
    `Ask about ${agent.specialty.toLowerCase()}`,
    'Get a quick second opinion before acting',
  ];
}

export function AgentPreviewSheet({
  agent,
  connected,
  userBalance,
  isConnectingWallet,
  isStartingCall,
  onClose,
  onConnect,
  onCallNow,
}: AgentPreviewSheetProps) {
  if (!agent) return null;

  const rate = Number(agent.rate) || 0;
  const maxBudget = rate > 0 ? Math.max(rate * 5, 0.5) : 0;
  const hasEnoughBalance = !connected || userBalance >= Math.min(maxBudget, 0.5);
  const examples = getExamples(agent);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/60">
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

        <div className="space-y-4 p-4">
          <p className="text-sm leading-6 text-gray-300">{agent.bio || agent.specialty}</p>

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
                Wallet required for paid calls
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-100/80">
                Connect before starting so settlement has a real address.
              </p>
            </div>
          ) : !hasEnoughBalance ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              Balance may be too low for the suggested call cap.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <Shield className="h-4 w-4" />
              Wallet ready. You only pay for time used.
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
              Call now
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
