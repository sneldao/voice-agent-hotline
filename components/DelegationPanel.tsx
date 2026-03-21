'use client';

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldOff, Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useWallet } from '@/lib/WalletContextNew';
import { AGENT_REGISTRY } from '@/lib/agent-registry';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface DelegationScope {
  canBook: boolean;
  canOrder: boolean;
  canSchedule: boolean;
  canResearch: boolean;
  maxSpendUSD: number;
  expiresInDays: number;
}

interface ActiveDelegation {
  id: string;
  scope: DelegationScope;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_SCOPE: DelegationScope = {
  canBook: false,
  canOrder: false,
  canSchedule: true,
  canResearch: true,
  maxSpendUSD: 10,
  expiresInDays: 30,
};

const PERMISSION_META = [
  {
    key: 'canResearch' as const,
    label: 'Research & Web Search',
    description: 'Let agents search the web and look up blockchain data on your behalf.',
    risk: 'low' as const,
    emoji: '🔍',
  },
  {
    key: 'canSchedule' as const,
    label: 'Set Reminders & Schedule',
    description: 'Let agents create calendar events and reminders for you.',
    risk: 'low' as const,
    emoji: '📅',
  },
  {
    key: 'canBook' as const,
    label: 'Book Appointments',
    description: 'Let agents book consultations and reservations on your behalf.',
    risk: 'medium' as const,
    emoji: '📋',
  },
  {
    key: 'canOrder' as const,
    label: 'Place Orders',
    description: 'Let agents place orders for goods and services (subject to spend limit).',
    risk: 'high' as const,
    emoji: '🛒',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function riskColor(risk: 'low' | 'medium' | 'high') {
  if (risk === 'low') return 'text-green-400 bg-green-500/10 border-green-500/20';
  if (risk === 'medium') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
}

function riskLabel(risk: 'low' | 'medium' | 'high') {
  if (risk === 'low') return 'Low risk';
  if (risk === 'medium') return 'Medium risk';
  return 'High risk';
}

function formatExpiry(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function DelegationPanel() {
  const { connected, address, connect } = useWallet();

  const [scope, setScope] = useState<DelegationScope>(DEFAULT_SCOPE);
  const [activeDelegation, setActiveDelegation] = useState<ActiveDelegation | null>(null);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [erc8004Configured, setErc8004Configured] = useState<boolean | null>(null);

  // Check ERC-8004 configuration and load existing delegation
  useEffect(() => {
    if (!connected || !address) return;

    setIsLoading(true);

    // Check if contracts are configured
    fetch('/api/sdk/health')
      .then(r => r.json())
      .then(d => {
        const configured = d.erc8004?.configured ?? false;
        setErc8004Configured(configured);
      })
      .catch(() => setErc8004Configured(false));

    // Load existing delegations
    fetch(`/api/delegations?userAddress=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.delegation) {
          setActiveDelegation(d.delegation);
        }
      })
      .catch(() => {/* no existing delegation */})
      .finally(() => setIsLoading(false));
  }, [connected, address]);

  const handleGrant = async () => {
    if (!connected) { connect(); return; }
    setError(null);
    setSuccess(null);
    setIsGranting(true);

    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          scope: {
            ...scope,
            maxSpendWei: BigInt(Math.round(scope.maxSpendUSD * 1e18)).toString(),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Failed to create delegation');

      setActiveDelegation({
        id: data.delegationId,
        scope,
        createdAt: Date.now(),
        expiresAt: Date.now() + scope.expiresInDays * 24 * 60 * 60 * 1000,
      });
      setSuccess('Permissions granted! VOISSS agents can now act on your behalf.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grant delegation');
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevoke = async () => {
    if (!activeDelegation) return;
    setError(null);
    setIsRevoking(true);

    try {
      const res = await fetch(`/api/delegations?delegationId=${activeDelegation.id}&userAddress=${address}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to revoke');
      }
      setActiveDelegation(null);
      setSuccess('Permissions revoked. VOISSS agents can no longer act on your behalf.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke delegation');
    } finally {
      setIsRevoking(false);
    }
  };

  const togglePermission = (key: keyof DelegationScope) => {
    if (typeof scope[key] !== 'boolean') return;
    setScope(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-5 h-5 text-violet-400" />
          <h3 className="font-semibold text-white">ERC-8004 Agent Permissions</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Connect your wallet to grant VOISSS agents permission to act on your behalf (book, order, schedule).
        </p>
        <Button onClick={connect} className="w-full bg-gradient-to-r from-violet-500 to-purple-500">
          Connect Wallet to Grant Permissions
        </Button>
      </Card>
    );
  }

  // ── ERC-8004 not configured ────────────────────────────────────────────────
  if (erc8004Configured === false) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">ERC-8004 Not Configured</h3>
        </div>
        <p className="text-sm text-gray-400 mb-2">
          The delegation contracts are not yet deployed. Agent permissions are running in sandbox mode.
        </p>
        <p className="text-xs text-gray-600">
          To enable: deploy ERC-8004 contracts on Celo and set{' '}
          <code className="font-mono bg-gray-800 px-1 rounded">NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS</code> in .env.local.
        </p>
      </Card>
    );
  }

  // ── Active delegation ──────────────────────────────────────────────────────
  if (activeDelegation) {
    const active = activeDelegation;
    const expiry = formatExpiry(active.expiresAt);
    const isExpired = active.expiresAt < Date.now();

    return (
      <Card className="p-5 border-violet-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Permissions Active</h3>
            <p className={`text-xs ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>{expiry}</p>
          </div>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {isExpired ? 'Expired' : 'Active'}
          </span>
        </div>

        {/* Granted permissions */}
        <div className="space-y-2 mb-4">
          {PERMISSION_META.map(p => {
            const granted = active.scope[p.key];
            return (
              <div key={p.key} className={`flex items-center gap-2 p-2 rounded-lg ${granted ? 'bg-gray-800/40' : 'bg-gray-900/30 opacity-50'}`}>
                <span className="text-base">{p.emoji}</span>
                <span className="text-sm text-white flex-1">{p.label}</span>
                <span className={`text-xs font-medium ${granted ? 'text-green-400' : 'text-gray-600'}`}>
                  {granted ? 'Granted' : 'Not granted'}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/40">
            <span className="text-base">💰</span>
            <span className="text-sm text-white flex-1">Spend limit</span>
            <span className="text-xs text-cyan-400">${active.scope.maxSpendUSD} / action</span>
          </div>
        </div>

        {/* Delegation ID */}
        <div className="p-2 bg-gray-900 rounded-lg mb-4">
          <p className="text-xs text-gray-500 mb-0.5">Delegation ID (ERC-8004)</p>
          <p className="text-xs font-mono text-gray-400 truncate">{active.id}</p>
        </div>

        {success && (
          <p className="text-xs text-green-400 mb-3">{success}</p>
        )}
        {error && (
          <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleRevoke}
          disabled={isRevoking}
          className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
          {isRevoking ? 'Revoking…' : 'Revoke All Permissions'}
        </button>
      </Card>
    );
  }

  // ── Grant form ─────────────────────────────────────────────────────────────
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center">
          <Shield className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">ERC-8004 Agent Permissions</h3>
          <p className="text-xs text-gray-400">Grant VOISSS agents permission to act for you</p>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Without a delegation, agents can only <span className="text-white font-medium">research</span>. Grant permissions to enable booking, ordering, and scheduling on your behalf.
      </p>

      {/* Permission toggles */}
      <div className="space-y-2 mb-4">
        {PERMISSION_META.map(p => (
          <button
            key={p.key}
            onClick={() => togglePermission(p.key)}
            className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
              scope[p.key]
                ? 'bg-violet-500/10 border-violet-500/40'
                : 'bg-gray-800/30 border-gray-700/30 hover:border-gray-600'
            }`}
          >
            <span className="text-xl flex-shrink-0">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{p.label}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${riskColor(p.risk)}`}>
                  {riskLabel(p.risk)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
              scope[p.key] ? 'bg-violet-500 border-violet-500' : 'border-gray-600'
            }`}>
              {scope[p.key] && <div className="w-full h-full flex items-center justify-center text-white text-xs">✓</div>}
            </div>
          </button>
        ))}
      </div>

      {/* Advanced options */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-gray-300 transition-colors mb-3"
      >
        <span>Advanced options</span>
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showAdvanced && (
        <div className="space-y-3 mb-4 p-3 bg-gray-800/30 rounded-xl">
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Max spend per action</span>
              <span className="text-white">${scope.maxSpendUSD}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={scope.maxSpendUSD}
              onChange={e => setScope(prev => ({ ...prev, maxSpendUSD: Number(e.target.value) }))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>$1</span><span>$100</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Delegation expires after</span>
              <span className="text-white">{scope.expiresInDays} days</span>
            </div>
            <input
              type="range"
              min={1}
              max={90}
              step={1}
              value={scope.expiresInDays}
              onChange={e => setScope(prev => ({ ...prev, expiresInDays: Number(e.target.value) }))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>1 day</span><span>90 days</span>
            </div>
          </div>
        </div>
      )}

      {/* Which agents benefit */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.values(AGENT_REGISTRY)
          .filter(a => a.allowedSkills.some(s => {
            const key = `can${s.charAt(0).toUpperCase()}${s.slice(1)}` as keyof DelegationScope;
            return scope[key] === true;
          }))
          .map(a => (
            <span key={a.key} className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400">
              {a.emoji} {a.name}
            </span>
          ))
        }
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={handleGrant}
        disabled={isGranting || isLoading}
        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
      >
        {isGranting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating delegation on Celo…</>
        ) : (
          <><ShieldCheck className="w-4 h-4 mr-2" /> Grant Permissions via ERC-8004</>
        )}
      </Button>

      <p className="text-xs text-center text-gray-600 mt-2">
        Stored on-chain on Celo. Revocable at any time.
      </p>
    </Card>
  );
}
