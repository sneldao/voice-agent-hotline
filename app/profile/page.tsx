'use client';

// Force dynamic rendering to avoid SSR issues with client-only SDKs
export const revalidate = 0;

import { useState, useEffect } from 'react';
import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import {
  User,
  Phone,
  Star,
  Clock,
  CreditCard,
  Settings,
  History,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useWallet } from '@/lib/WalletContextNew';
import { apiUrl } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStats {
  totalCalls: number;
  totalMinutes: number;
  totalSpent: number;
}

interface CallRecord {
  id: string;
  agentId: string;
  agentName: string;
  duration: number;
  cost: number;
  timestamp: number;
}

interface ReputationData {
  score: number;
  level: string;
  percentile: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000 / 60 / 60);
  if (diff < 1) return 'Just now';
  if (diff < 24) return `${diff}h ago`;
  return `${Math.floor(diff / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 animate-slideUp">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </Card>
  );
}

function SkeletonBox({ className }: { className?: string }) {
  return <div className={`bg-gray-800 rounded-xl animate-pulse ${className ?? ''}`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserProfile() {
  const { connected, address, connect, isConnecting } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [copied, setCopied] = useState(false);

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingRep, setLoadingRep] = useState(false);

  const [balanceErr, setBalanceErr] = useState<string | null>(null);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [repErr, setRepErr] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!connected || !address) return;
    let mounted = true;

    // Balance
    setLoadingBalance(true);
    fetch(apiUrl(`/api/users/${address}`))
      .then(r => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(d => { if (mounted) { setBalance(d.balance ?? 0); setBalanceErr(null); } })
      .catch(e => { if (mounted) setBalanceErr(String(e)); })
      .finally(() => { if (mounted) setLoadingBalance(false); });

    // Call history
    setLoadingHistory(true);
    fetch(apiUrl(`/api/calls?userId=${address}&limit=5`))
      .then(r => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(d => {
        if (!mounted) return;
        const calls: CallRecord[] = d.calls ?? [];
        setRecentCalls(calls);
        if (calls.length) {
          setStats({
            totalCalls: d.total ?? calls.length,
            totalMinutes: Math.round(calls.reduce((s, c) => s + c.duration / 60, 0)),
            totalSpent: calls.reduce((s, c) => s + c.cost, 0),
          });
        }
        setHistoryErr(null);
      })
      .catch(e => { if (mounted) setHistoryErr(String(e)); })
      .finally(() => { if (mounted) setLoadingHistory(false); });

    // ERC-8004 Reputation
    setLoadingRep(true);
    fetch(apiUrl(`/api/reputation?agentId=${address}`))
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        if (d.reputation) {
          setReputation({
            score: d.reputation.score ?? 0,
            level: d.reputation.level ?? 'Newcomer',
            percentile: d.stats?.percentile ?? 0,
          });
          setRepErr(null);
        } else {
          setRepErr('No on-chain reputation yet — make a few calls to build it.');
        }
      })
      .catch(() => { if (mounted) setRepErr('ERC-8004 registry unavailable.'); })
      .finally(() => { if (mounted) setLoadingRep(false); });

    return () => { mounted = false; };
  }, [connected, address]);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Not connected ──────────────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex flex-col items-center justify-center p-6 animate-fadeIn">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400 text-center mb-8 max-w-xs">
          Connect a wallet to view your profile, call history and on-chain reputation.
        </p>
        <Button
          onClick={connect}
          disabled={isConnecting}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 min-w-[180px]"
        >
          {isConnecting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</>
          ) : (
            'Connect Wallet'
          )}
        </Button>
        <button
          onClick={() => window.history.back()}
          className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────

  const repPercent = reputation ? Math.min(100, (reputation.score / 1000) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 animate-fadeIn">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="flex items-center gap-4 px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center hover:bg-gray-800 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Profile</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-10 stagger">

        {/* ── Identity card */}
        <Card variant="gradient" className="p-6 animate-slideUp">
          <div className="flex items-center gap-4">
            <Avatar size="xl" className="bg-gradient-to-br from-cyan-500 to-blue-500">
              <User className="w-8 h-8" />
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white font-mono">{formatAddress(address!)}</h2>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 transition-colors mt-0.5"
              >
                {copied ? (
                  <><Check className="w-3 h-3 text-green-400" /> Copied!</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copy address</>
                )}
              </button>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="success" size="sm">
                  <Shield className="w-3 h-3 mr-1" /> Verified
                </Badge>
                {reputation && reputation.score > 500 && (
                  <Badge variant="info" size="sm">
                    <Zap className="w-3 h-3 mr-1" /> {reputation.level}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Balance */}
        {loadingBalance ? (
          <SkeletonBox className="h-24" />
        ) : balanceErr ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 animate-slideUp">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">Balance unavailable</p>
              <p className="text-xs text-red-400/70">{balanceErr}</p>
            </div>
          </div>
        ) : (
          <Card className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20 animate-slideUp">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Available Balance</p>
                <p className="text-3xl font-bold text-white">${(balance ?? 0).toFixed(2)}</p>
              </div>
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-500">
                <CreditCard className="w-4 h-4 mr-2" />
                Add Funds
              </Button>
            </div>
          </Card>
        )}

        {/* ── ERC-8004 Reputation */}
        <Card className="p-4 animate-slideUp">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">ERC-8004 Reputation</p>
              <p className="text-xs text-gray-400">Trustless on-chain identity</p>
            </div>
          </div>

          {loadingRep ? (
            <div className="space-y-2">
              <SkeletonBox className="h-3 w-1/3" />
              <SkeletonBox className="h-2" />
            </div>
          ) : repErr ? (
            <p className="text-sm text-gray-500 italic">{repErr}</p>
          ) : reputation ? (
            <>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Score</span>
                <span className="font-bold text-violet-400">{reputation.score}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-1000"
                  style={{ width: `${repPercent}%` }}
                />
              </div>
              {reputation.percentile > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Top {100 - reputation.percentile}% of users
                </p>
              )}
            </>
          ) : null}
        </Card>

        {/* ── Stats grid */}
        {loadingHistory ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3].map(i => <SkeletonBox key={i} className="h-20" />)}
          </div>
        ) : historyErr ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center gap-3 animate-slideUp">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">Call history unavailable</p>
              <p className="text-xs text-yellow-400/70">{historyErr}</p>
            </div>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Phone className="w-4 h-4" />} label="Calls" value={String(stats.totalCalls)} />
            <StatCard icon={<Clock className="w-4 h-4" />} label="Minutes" value={String(stats.totalMinutes)} />
            <StatCard icon={<CreditCard className="w-4 h-4" />} label="Spent" value={`$${(stats.totalSpent || 0).toFixed(2)}`} />
          </div>
        ) : null}

        {/* ── Recent calls */}
        {recentCalls.length > 0 && (
          <Card className="p-4 animate-slideUp">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white">Recent Calls</h3>
            </div>
            <div className="space-y-3">
              {recentCalls.map(call => (
                <div key={call.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{call.agentName}</p>
                      <p className="text-xs text-gray-400">{formatDate(call.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatDuration(call.duration)}</p>
                    <p className="text-xs text-cyan-400">${(call.cost || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Settings */}
        <Card className="p-4 animate-slideUp">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white">Settings</h3>
          </div>
          <div className="space-y-2">
            {['Notification Preferences', 'Privacy & Security', 'Connected Wallets'].map(label => (
              <button
                key={label}
                className="w-full flex items-center justify-between p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 active:scale-[0.98] transition-all"
              >
                <span className="text-sm text-white">{label}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}
