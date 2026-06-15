'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PhoneCall, ArrowLeft, Star, Clock, Wallet } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui';
import { CostPanel } from '@/components/CostPanel';

const DEFAULT_CAP: number | null = 1;

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [cap, setCap] = useState<number | null>(DEFAULT_CAP);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(apiUrl(`/api/agents/${agentId}`));
        if (res.ok) {
          const data = await res.json();
          setAgent(data.agent || data);
        }
      } catch {
        // handled by null state
      } finally {
        setLoading(false);
      }
    }
    fetchAgent();
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0806]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0806] px-4 text-center">
        <div className="operator-panel rounded-[1.5rem] p-8">
          <h1 className="text-xl font-bold text-amber-50">Agent not found</h1>
          <p className="mt-2 text-sm text-amber-100/60">
            The agent &quot;{agentId}&quot; doesn&apos;t exist or is no longer available.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-100/20 bg-black/25 px-4 py-2 text-sm font-semibold text-amber-100/60 transition-colors hover:text-amber-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Switchboard
          </Link>
        </div>
      </div>
    );
  }

  const rate = agent.rate ?? agent.ratePerMinute ?? 0.1;

  return (
    <div className="min-h-screen bg-[#0b0806] text-amber-50">
      {/* Header */}
      <div className="border-b border-amber-100/15 bg-[#17100d]/85">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-100/15 bg-black/25 transition-colors hover:bg-amber-100/10"
            aria-label="Back to switchboard"
          >
            <ArrowLeft className="h-4 w-4 text-amber-100/60" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-amber-50">Agent Profile</h1>
            <p className="text-xs text-amber-100/45">VOISSS Switchboard</p>
          </div>
        </div>
      </div>

      {/* Agent card */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="operator-panel rounded-[1.5rem] border border-amber-100/15 p-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/30 to-amber-500/30 text-3xl">
              {agent.avatar || agent.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{agent.name}</h2>
              {agent.specialty && (
                <p className="text-sm text-amber-100/60">{agent.specialty}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {agent.description && (
            <p className="mt-4 text-sm leading-relaxed text-amber-100/70">
              {agent.description}
            </p>
          )}

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-amber-100/15 bg-black/25 p-3 text-center">
              <Wallet className="mx-auto mb-1 h-5 w-5 text-amber-200" />
              <p className="text-lg font-bold">${Number(rate).toFixed(2)}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-100/45">per min</p>
            </div>
            <div className="rounded-xl border border-amber-100/15 bg-black/25 p-3 text-center">
              <Star className="mx-auto mb-1 h-5 w-5 text-amber-400" />
              <p className="text-lg font-bold">{agent.rating?.toFixed(1) ?? '—'}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-100/45">rating</p>
            </div>
            <div className="rounded-xl border border-amber-100/15 bg-black/25 p-3 text-center">
              <Clock className="mx-auto mb-1 h-5 w-5 text-cyan-400" />
              <p className="text-lg font-bold">{agent.online !== false ? 'Online' : 'Offline'}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-100/45">status</p>
            </div>
          </div>

          {/* Cost panel — first-class */}
          <div className="mt-6">
            <CostPanel
              pricePerMinute={Number(rate)}
              cap={cap}
              onCapChange={setCap}
            />
          </div>

          {/* Call CTA */}
          <div className="mt-6">
            <Button
              onClick={() => {
                const capParam = cap == null ? '' : `&cap=${cap}`;
                router.push(`/?agent=${agentId}&autoStart=true${capParam}`);
              }}
              className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400"
              size="lg"
            >
              <PhoneCall className="mr-2 h-5 w-5" />
              Call {agent.name}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
