'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@/lib/WalletContextNew';
import { BarChart3, Users, Target, Sparkles, TrendingUp, Clock, Activity } from 'lucide-react';
import { USE_CASES } from '@/lib/useOnboarding';

// ─── Event Types (mirrors lib/track.ts) ─────────────────────────────────────

interface TrackEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp: number;
  url: string;
  receivedAt: string;
}

interface EventsResponse {
  total: number;
  filter: string | null;
  summary: Record<string, number>;
  events: TrackEvent[];
  timestamp: string;
}

// ─── Admin Auth ─────────────────────────────────────────────────────────────

const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').toLowerCase().split(',').filter(Boolean);

function isAdmin(address: string | null): boolean {
  if (!address) return false;
  if (ADMIN_WALLETS.length === 0) return false;
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#f97316', // orange
  '#ef4444', // red
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
];

const FUNNEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

// ─── Derived Stats ──────────────────────────────────────────────────────────

interface OnboardingFunnel {
  started: number;
  step1: number;
  step2: number;
  step3: number;
  completed: number;
  skipped: number;
}

interface UseCaseCount {
  id: string;
  label: string;
  emoji: string;
  count: number;
  percentage: number;
}

interface StepDropoff {
  step: number;
  targetLabel: string;
  viewers: number;
  dropoffPercent: number;
}

const STEP_TARGETS: Record<number, string> = {
  1: 'Meet Vox',
  2: 'Use-Case Picker',
  3: 'How It Works',
  4: 'Free Call',
  5: 'Let\'s Go',
};

function computeOnboardingFunnel(events: TrackEvent[]): OnboardingFunnel {
  const started = events.filter(e => e.event === 'onboarding_step_viewed').length;
  const step1 = events.filter(e => e.event === 'onboarding_step_viewed' && e.data?.stepIndex === 1).length;
  const step2 = events.filter(e => e.event === 'onboarding_step_viewed' && e.data?.stepIndex === 2).length;
  const step3 = events.filter(e => e.event === 'onboarding_step_viewed' && e.data?.stepIndex === 3).length;
  const completed = events.filter(e => e.event === 'onboarding_completed').length;
  const skipped = events.filter(e => e.event === 'onboarding_skipped').length;
  return { started, step1, step2, step3, completed, skipped };
}

function computeUseCasePopularity(events: TrackEvent[]): UseCaseCount[] {
  const counts: Record<string, number> = {};
  for (const ev of events) {
    if (ev.event === 'use_case_selected' && ev.data?.useCase) {
      const uc = String(ev.data.useCase);
      counts[uc] = (counts[uc] || 0) + 1;
    }
  }

  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  if (total === 0) return [];

  return USE_CASES.map(uc => ({
    id: uc.id,
    label: uc.label,
    emoji: uc.emoji,
    count: counts[uc.id] || 0,
    percentage: total > 0 ? Math.round(((counts[uc.id] || 0) / total) * 100) : 0,
  })).filter(uc => uc.count > 0).sort((a, b) => b.count - a.count);
}

function computeStepDropoff(events: TrackEvent[], started: number): StepDropoff[] {
  const dropoff: StepDropoff[] = [];
  for (let step = 1; step <= 5; step++) {
    const viewers = events.filter(e => e.event === 'onboarding_step_viewed' && e.data?.stepIndex === step).length;
    dropoff.push({
      step,
      targetLabel: STEP_TARGETS[step] || `Step ${step}`,
      viewers,
      dropoffPercent: started > 0 ? Math.round((1 - viewers / started) * 100) : 0,
    });
  }
  return dropoff;
}

function computeUniqueVisitors(events: TrackEvent[]): number {
  const urls = new Set(events.filter(e => e.event === 'page_visited_first_time').map(e => `${e.timestamp}-${e.url}`));
  // Fallback: count unique onboarding started events
  if (urls.size === 0) {
    return events.filter(e => e.event === 'onboarding_step_viewed' && e.data?.stepIndex === 1).length;
  }
  return urls.size;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="operator-panel rounded-2xl p-5 flex items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
        color || 'bg-red-500/15 text-red-400'
      }`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-100/45">{label}</p>
        <p className="mt-1 text-2xl font-bold text-amber-50 tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-amber-100/40">{sub}</p>}
      </div>
    </div>
  );
}

function FunnelChart({ funnel, total }: { funnel: OnboardingFunnel; total: number }) {
  const steps = [
    { label: 'Started', count: funnel.started },
    { label: 'Step 1 — Meet Vox', count: funnel.step1 },
    { label: 'Step 2 — Use Case', count: funnel.step2 },
    { label: 'Step 3 — How It Works', count: funnel.step3 },
    { label: 'Completed', count: funnel.completed },
  ];

  const maxCount = Math.max(...steps.map(s => s.count), 1);

  return (
    <div className="operator-panel rounded-2xl p-5">
      <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-red-400" />
        Onboarding Funnel
      </h3>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
          const barWidth = Math.max(pct * 0.75, 4); // max 75% width for funnel shape
          const offset = (100 - barWidth) / 2;
          return (
            <div key={step.label} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-amber-100/60 flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full" style={{ backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                  {step.label}
                </span>
                <span className="text-xs font-semibold text-amber-50 tabular-nums">{step.count}</span>
              </div>
              <div className="h-7 w-full rounded-lg bg-black/30 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 rounded-lg transition-all duration-700 ease-out"
                  style={{
                    left: `${offset}%`,
                    width: `${barWidth}%`,
                    backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                    opacity: 0.7,
                  }}
                />
                {/* Percentage label inside bar */}
                <div
                  className="absolute inset-y-0 flex items-center justify-center text-[10px] font-bold text-white/80"
                  style={{
                    left: `${offset}%`,
                    width: `${barWidth}%`,
                  }}
                >
                  {step.count > 0 && maxCount > 0 && Math.round((step.count / funnel.started) * 100)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletionRate({ funnel }: { funnel: OnboardingFunnel }) {
  const totalFinished = funnel.completed + funnel.skipped;
  const rate = totalFinished > 0 ? Math.round((funnel.completed / totalFinished) * 100) : 0;
  const skippedRate = totalFinished > 0 ? Math.round((funnel.skipped / totalFinished) * 100) : 0;

  // SVG donut chart
  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="operator-panel rounded-2xl p-5">
      <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-400" />
        Completion Rate
      </h3>
      <div className="flex items-center gap-6">
        <div className="relative flex items-center justify-center">
          <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
            {/* Background ring */}
            <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
            {/* Completed arc */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth="12"
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (rate / 100) * circumference}
              className="transition-all duration-1000 ease-out"
            />
            {/* Skipped arc */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth="12"
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (skippedRate / 100) * circumference}
              transform={`rotate(${rate * 3.6} 70 70)`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold text-amber-50 tabular-nums">{rate}%</span>
            <span className="text-[10px] text-amber-100/40 uppercase tracking-wider">completed</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-amber-100/60">Completed</span>
            <span className="text-xs font-semibold text-amber-50 tabular-nums ml-auto">{funnel.completed}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-amber-100/60">Skipped</span>
            <span className="text-xs font-semibold text-amber-50 tabular-nums ml-auto">{funnel.skipped}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-amber-100/10">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-amber-100/60">Started</span>
            <span className="text-xs font-semibold text-amber-50 tabular-nums ml-auto">{funnel.started}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UseCaseChart({ data }: { data: UseCaseCount[] }) {
  if (data.length === 0) {
    return (
      <div className="operator-panel rounded-2xl p-5">
        <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Use-Case Popularity
        </h3>
        <p className="text-center py-8 text-amber-100/40 text-sm">No use-case selections yet. Be the first!</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="operator-panel rounded-2xl p-5">
      <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        Use-Case Popularity
      </h3>
      <div className="space-y-3">
        {data.map((uc, i) => (
          <div key={uc.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-100/70 flex items-center gap-1.5">
                <span className="text-base">{uc.emoji}</span>
                {uc.label}
              </span>
              <span className="text-xs font-semibold text-amber-50 tabular-nums flex items-center gap-2">
                {uc.count}
                <span className="text-[10px] text-amber-100/40 font-normal">({uc.percentage}%)</span>
              </span>
            </div>
            <div className="h-6 w-full rounded-lg bg-black/30 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out"
                style={{
                  width: `${(uc.count / maxCount) * 100}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepDropoffChart({ dropoff, started }: { dropoff: StepDropoff[]; started: number }) {
  if (started === 0) {
    return (
      <div className="operator-panel rounded-2xl p-5">
        <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          Step-by-Step Dropoff
        </h3>
        <p className="text-center py-8 text-amber-100/40 text-sm">No onboarding data yet.</p>
      </div>
    );
  }

  return (
    <div className="operator-panel rounded-2xl p-5">
      <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-orange-400" />
        Step-by-Step Dropoff
      </h3>
      <div className="space-y-4">
        {dropoff.map((step) => {
          const pct = started > 0 ? Math.round((step.viewers / started) * 100) : 0;
          return (
            <div key={step.step}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-amber-100/70">
                  Step {step.step}: <span className="font-semibold">{step.targetLabel}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-5 rounded-lg bg-black/30 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${FUNNEL_COLORS[step.step - 1]}, ${FUNNEL_COLORS[step.step] || FUNNEL_COLORS[step.step - 1]})`,
                      opacity: 0.5,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-bold text-white/70 tabular-nums">{step.viewers} viewers</span>
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums w-12 text-right" style={{ color: step.dropoffPercent > 30 ? '#ef4444' : '#22c55e' }}>
                  -{step.dropoffPercent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentEvents({ events }: { events: TrackEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="operator-panel rounded-2xl p-5">
        <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Recent Events
        </h3>
        <p className="text-center py-8 text-amber-100/40 text-sm">No events recorded yet.</p>
      </div>
    );
  }

  const recent = events.slice(0, 25);
  const eventStyles: Record<string, string> = {
    onboarding_step_viewed: 'bg-violet-500/15 text-violet-300',
    onboarding_completed: 'bg-emerald-500/15 text-emerald-300',
    onboarding_skipped: 'bg-red-500/15 text-red-300',
    use_case_selected: 'bg-amber-500/15 text-amber-300',
    page_visited_first_time: 'bg-cyan-500/15 text-cyan-300',
  };

  return (
    <div className="operator-panel rounded-2xl p-5">
      <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        Recent Events
        <span className="text-xs font-normal text-amber-100/40 ml-1">(last 25)</span>
      </h3>
      <div className="space-y-1 max-h-[480px] overflow-y-auto">
        {recent.map((ev, i) => (
          <div key={`${ev.timestamp}-${i}`} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-amber-100/5 transition-colors">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              eventStyles[ev.event] || 'bg-amber-100/10 text-amber-100/60'
            }`}>
              {ev.event.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-amber-100/40 font-mono truncate">
              {ev.data ? JSON.stringify(ev.data).slice(0, 40) + (JSON.stringify(ev.data).length > 40 ? '…' : '') : '—'}
            </span>
            <span className="text-[10px] text-amber-100/30 ml-auto shrink-0 tabular-nums">
              {new Date(ev.receivedAt || ev.timestamp).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AnalyticsAdminPage() {
  const { address, connected, connect } = useWallet();
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=1000');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: EventsResponse = await res.json();
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEvents, 15_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEvents]);

  const events = useMemo(() => data?.events || [], [data]);

  const funnel = useMemo(() => computeOnboardingFunnel(events), [events]);
  const useCases = useMemo(() => computeUseCasePopularity(events), [events]);
  const dropoff = useMemo(() => computeStepDropoff(events, funnel.started), [events, funnel.started]);
  const uniqueVisitors = useMemo(() => computeUniqueVisitors(events), [events]);

  const totalEvents = data?.total || 0;

  // ─── Auth Guards ────────────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0b0806] flex items-center justify-center">
        <div className="operator-panel rounded-[1.5rem] p-8 text-center space-y-4">
          <div className="text-4xl">📊</div>
          <h1 className="text-xl font-semibold text-amber-50">Analytics Dashboard</h1>
          <p className="text-amber-100/60 text-sm">Connect your wallet to access analytics</p>
          <button
            onClick={connect}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (connected && !isAdmin(address)) {
    return (
      <div className="min-h-screen bg-[#0b0806] flex items-center justify-center">
        <div className="operator-panel rounded-[1.5rem] p-8 text-center space-y-3">
          <div className="text-4xl">🚫</div>
          <h1 className="text-xl font-semibold text-amber-50">Access Denied</h1>
          <p className="text-amber-100/60 text-sm">This wallet is not authorised.</p>
          <p className="text-amber-100/30 text-xs font-mono">{address}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0806] text-amber-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-red-400" />
              Onboarding Analytics
            </h1>
            <p className="text-amber-100/60 text-sm mt-1">
              Onboarding funnel, use-case preferences, and event stream
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-amber-100/30 bg-black/30 text-red-500 focus:ring-red-500/30"
              />
              <span className="text-xs text-amber-100/50">Auto-refresh</span>
            </label>
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="px-3 py-1.5 bg-amber-100/10 hover:bg-amber-100/15 border border-amber-100/15 rounded-lg text-sm text-amber-100/60 transition-colors disabled:opacity-40"
            >
              {loading ? '…' : '↻ Refresh'}
            </button>
            <a
              href="/admin"
              className="px-3 py-1.5 bg-amber-100/10 hover:bg-amber-100/15 border border-amber-100/15 rounded-lg text-sm text-amber-100/60 transition-colors"
            >
              ← Agents
            </a>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
            <span className="ml-3 text-sm text-amber-100/50">Loading events…</span>
          </div>
        ) : error ? (
          <div className="operator-panel rounded-2xl p-8 text-center">
            <p className="text-red-400 text-sm mb-3">Failed to load analytics</p>
            <p className="text-amber-100/40 text-xs mb-4 font-mono">{error}</p>
            <button
              onClick={fetchEvents}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : totalEvents === 0 ? (
          <div className="operator-panel rounded-2xl p-16 text-center">
            <BarChart3 className="w-12 h-12 text-amber-100/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-amber-50 mb-2">No events yet</h2>
            <p className="text-amber-100/50 text-sm max-w-md mx-auto">
              Events will appear here as users interact with the onboarding flow — use-case selection, and page visits.
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Activity className="w-5 h-5" />}
                label="Total Events"
                value={totalEvents.toLocaleString()}
                sub={`${events.length} in current window`}
                color="bg-violet-500/15 text-violet-400"
              />
              <StatCard
                icon={<Users className="w-5 h-5" />}
                label="Visitors"
                value={uniqueVisitors}
                sub="First-time page visits"
                color="bg-blue-500/15 text-blue-400"
              />
              <StatCard
                icon={<Target className="w-5 h-5" />}
                label="Onboarding Started"
                value={funnel.started}
                sub={`${funnel.completed} completed · ${funnel.skipped} skipped`}
                color="bg-emerald-500/15 text-emerald-400"
              />
              <StatCard
                icon={<Sparkles className="w-5 h-5" />}
                label="Use-Case Selections"
                value={useCases.reduce((s, u) => s + u.count, 0)}
                sub={`${useCases.length} unique interests`}
                color="bg-amber-500/15 text-amber-400"
              />
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <div className="space-y-4">
                <FunnelChart funnel={funnel} total={totalEvents} />
                <CompletionRate funnel={funnel} />
              </div>
              <div className="space-y-4">
                <UseCaseChart data={useCases} />
                <StepDropoffChart dropoff={dropoff} started={funnel.started} />
              </div>
            </div>

            {/* Event summary + recent events */}
            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <div className="operator-panel rounded-2xl p-5">
                <h3 className="text-sm font-bold text-amber-50 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-red-400" />
                  Event Breakdown
                </h3>
                {data?.summary && Object.entries(data.summary).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(data.summary)
                      .sort(([, a], [, b]) => b - a)
                      .map(([event, count]) => {
                        const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                        return (
                          <div key={event} className="flex items-center gap-3">
                            <span className="text-xs text-amber-100/60 capitalize min-w-[10rem]">
                              {event.replace(/_/g, ' ')}
                            </span>
                            <div className="flex-1 h-4 rounded bg-black/30 relative overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 rounded bg-red-500/40 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-amber-50 tabular-nums w-16 text-right">{count}</span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-center py-8 text-amber-100/40 text-sm">No summary data.</p>
                )}
              </div>
              <RecentEvents events={events} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
