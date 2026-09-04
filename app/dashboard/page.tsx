'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/WalletContextNew';
import { useUserBalance } from '@/lib/useSWR';
import { apiUrl } from '@/lib/api';
import { Header } from '@/components/Header';

interface AgentStat {
  id: string;
  name: string;
  category?: string;
  avatar?: string;
  rating: number;
  totalCalls: number;
  rate: number;
  online: boolean;
  totalRevenue?: string;
  platformRevenue?: string;
  totalPaid?: string;
  erc8004_token_id?: string;
  status?: string;
  wallet_address?: string;
}

interface PayoutRecord {
  agentId: string;
  to: string;
  amount: string;
  txHash: string;
  timestamp: string;
}

interface EarningsCall {
  callId: string;
  caller: string;
  duration: number;
  totalCostUsdc: number;
  agentShareUsdc: number;
  platformShareUsdc: number;
  status: string;
  startedAt: string;
  endedAt: string;
  txHash: string | null;
  isTrial: boolean;
}

interface EarningsData {
  calls: EarningsCall[];
  summary: {
    totalCalls: number;
    totalRevenueUsdc: string;
    settledCalls: number;
    trialCalls: number;
    paidCalls: number;
    ledgerNote: string;
  };
}

interface StatsSummary {
  totalAgents: number;
  totalCalls: number;
  avgRating: number;
  topAgent: { name: string; calls: number; category: string; avatar: string } | null;
  generatedAt: string;
}

export default function DashboardPage() {
  const { address, connected, connect, disconnect, isConnecting, formatAddress } = useWallet();
  const { balance: userBalance } = useUserBalance(address);
  const [myAgents, setMyAgents] = useState<AgentStat[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState<string | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<Record<string, PayoutRecord[]>>({});
  const [earningsData, setEarningsData] = useState<Record<string, EarningsData>>({});
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch(apiUrl('/api/agents?status=all')),
        fetch(apiUrl('/api/agents/stats')),
      ]);
      const agentsData = await agentsRes.json();
      const statsData = await statsRes.json();

      const all: AgentStat[] = agentsData.agents || [];
      const mine = all.filter(
        a => a.wallet_address?.toLowerCase() === address.toLowerCase()
      );
      setMyAgents(mine);
      setSummary(statsData.summary || null);

      const histories: Record<string, PayoutRecord[]> = {};
      await Promise.all(
        mine.map(async (agent) => {
          try {
            const res = await fetch(apiUrl(`/api/agents/payout?agentId=${agent.id}`));
            const data = await res.json();
            histories[agent.id] = data.payouts || [];
          } catch {
            histories[agent.id] = [];
          }
        })
      );
      setPayoutHistory(histories);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchEarnings = useCallback(async (agentId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/agents/earnings?agentId=${agentId}`), {
        headers: {
          'X-Wallet-Address': address || '',
        },
      });
      if (!res.ok) return;
      const data: EarningsData = await res.json();
      setEarningsData(prev => ({ ...prev, [agentId]: data }));
    } catch {
      // silently fail
    }
  }, [address]);

  const toggleEarnings = useCallback((agentId: string) => {
    setExpandedAgent(prev => {
      if (prev === agentId) return null;
      if (!earningsData[agentId]) fetchEarnings(agentId);
      return agentId;
    });
  }, [earningsData, fetchEarnings]);

  const CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';

  const encodeTransfer = (to: string, amountWei: bigint): string => {
    const selector = '0xa9059cbb';
    const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0');
    const paddedAmount = amountWei.toString(16).padStart(64, '0');
    return selector + paddedTo + paddedAmount;
  };

  const encodeRegisterAgent = (agentURI: string, rateWei: bigint, specialties: string[]): string => {
    const selector = '0x4a0e5371';

    const encodeString = (s: string): string => {
      const bytes = new TextEncoder().encode(s);
      const lenHex = bytes.length.toString(16).padStart(64, '0');
      const dataHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const padded = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, '0');
      return lenHex + padded;
    };

    const uriEncoded = encodeString(agentURI);
    const rateHex = rateWei.toString(16).padStart(64, '0');

    const arrLen = specialties.length.toString(16).padStart(64, '0');
    const encodedStrings = specialties.map(encodeString);
    const strOffsets = specialties.map((_, i) => {
      const prior = encodedStrings.slice(0, i).reduce((acc, s) => acc + s.length / 2, 0);
      return (specialties.length * 32 + prior).toString(16).padStart(64, '0');
    });
    const arrEncoded = arrLen + strOffsets.join('') + encodedStrings.join('');

    const uriOffset = (3 * 32).toString(16).padStart(64, '0');
    const arrOffset = (3 * 32 + 32 + uriEncoded.length / 2).toString(16).padStart(64, '0');

    return selector + uriOffset + rateHex + arrOffset + uriEncoded + arrEncoded;
  };

  const handleWithdraw = async (agent: AgentStat) => {
    if (!address) return;
    const revenue = parseFloat(agent.totalRevenue || '0');
    const paid = parseFloat(agent.totalPaid || '0');
    const unpaid = revenue - paid;
    if (unpaid < 0.01) {
      showToast('Minimum withdrawal is 0.01 USDC', 'error');
      return;
    }
    const eth = (window as any).ethereum;
    if (!eth) {
      showToast('No wallet detected', 'error');
      return;
    }
    setPayoutLoading(agent.id);
    try {
      const amountWei = BigInt(Math.floor(unpaid * 1e18));
      const data = encodeTransfer(address, amountWei);
      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: CUSD_ADDRESS, data }],
      });
      await fetch(apiUrl('/api/agents/payout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, walletAddress: address, txHash, amount: unpaid.toFixed(6) }),
      });
      showToast(`Withdrew ${unpaid.toFixed(4)} USDC — tx: ${(txHash as string).slice(0, 10)}…`);
      fetchData();
    } catch (err: any) {
      if (err?.code === 4001) {
        showToast('Transaction rejected', 'error');
      } else {
        showToast(err?.message || 'Withdrawal failed', 'error');
      }
    } finally {
      setPayoutLoading(null);
    }
  };

  const [mintLoading, setMintLoading] = useState<string | null>(null);

  const handleMintIdentity = async (agent: AgentStat) => {
    if (!address) return;
    const identityAddress = process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS;
    if (!identityAddress || identityAddress === '0x0000000000000000000000000000000000000000') {
      showToast('ERC-8004 contracts not configured', 'error');
      return;
    }
    const eth = (window as any).ethereum;
    if (!eth) {
      showToast('No wallet detected', 'error');
      return;
    }
    setMintLoading(agent.id);
    try {
      const agentURI = `${window.location.origin}/api/agents/${agent.id}`;
      const rateWei = BigInt(Math.floor(parseFloat(String(agent.rate || '0.10')) * 1e18));
      const specialties = agent.category ? [agent.category] : ['general'];
      const data = encodeRegisterAgent(agentURI, rateWei, specialties);
      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: identityAddress, data }],
      });
      await fetch(apiUrl(`/api/agents/${agent.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erc8004_mint_tx: txHash }),
      });
      showToast(`ERC-8004 mint submitted — tx: ${(txHash as string).slice(0, 10)}…`);
      fetchData();
    } catch (err: any) {
      if (err?.code === 4001) {
        showToast('Transaction rejected', 'error');
      } else {
        showToast(err?.message || 'Mint failed', 'error');
      }
    } finally {
      setMintLoading(null);
    }
  };

  const totalEarnings = myAgents.reduce((sum, a) => sum + parseFloat(a.totalRevenue || '0'), 0);
  const totalPaid = myAgents.reduce((sum, a) => sum + parseFloat(a.totalPaid || '0'), 0);
  const totalUnpaid = totalEarnings - totalPaid;
  const totalCalls = myAgents.reduce((sum, a) => sum + (a.totalCalls || 0), 0);
  const avgRating =
    myAgents.length > 0
      ? myAgents.reduce((sum, a) => sum + (a.rating || 0), 0) / myAgents.length
      : 0;

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0b0806] text-amber-50">
        <Header
          connected={false}
          userBalance={0}
          isConnecting={isConnecting}
          formatAddress={formatAddress}
          onConnect={connect}
          onDisconnect={disconnect}
        />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="text-center space-y-4">
            <div className="text-4xl">🎙️</div>
            <h1 className="text-xl font-bold text-amber-50">Broker Dashboard</h1>
            <p className="text-amber-100/60 text-sm">Connect the wallet you used to register your brokers</p>
            <button
              onClick={connect}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white rounded-full text-sm font-bold transition-all"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0806] text-amber-50">
      <Header
        connected={connected}
        userBalance={userBalance || 0}
        isConnecting={isConnecting}
        formatAddress={formatAddress}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/" className="text-xs text-amber-100/45 hover:text-amber-100/70 transition-colors">
                Broker Desk
              </Link>
              <span className="text-xs text-amber-100/25">/</span>
              <span className="text-xs text-amber-100/60">Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold text-amber-50">Broker Dashboard</h1>
            <p className="text-amber-100/45 text-sm mt-1 font-mono">
              {address?.slice(0, 8)}…{address?.slice(-4)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/list-your-broker"
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white rounded-full text-sm font-bold transition-all"
            >
              + List Broker
            </Link>
            <button
              onClick={fetchData}
              className="px-3 py-2 border border-amber-100/20 bg-black/25 hover:bg-amber-100/10 rounded-xl text-sm text-amber-100/60 transition-colors"
            >
              ↻
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-amber-100/45">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
            <p className="mt-4 text-sm">Loading dashboard…</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d] p-4 text-center">
                <div className="text-2xl font-bold text-amber-200">{totalCalls}</div>
                <div className="text-amber-100/45 text-xs mt-1">Total Calls</div>
              </div>
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d] p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{totalEarnings.toFixed(4)}</div>
                <div className="text-amber-100/45 text-xs mt-1">Earned (USDC)</div>
              </div>
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d] p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{totalUnpaid.toFixed(4)}</div>
                <div className="text-amber-100/45 text-xs mt-1">Withdrawable</div>
              </div>
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d] p-4 text-center">
                <div className="text-2xl font-bold text-cyan-300">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                <div className="text-amber-100/45 text-xs mt-1">Avg Rating</div>
              </div>
            </div>

            {/* Ledger honesty note */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 mb-8">
              <p className="text-xs text-amber-100/60 leading-relaxed">
                <span className="font-semibold text-amber-200">How earnings work:</span>{' '}
                Your 80% share is ledgered in Redis when a call settles on Arbitrum.
                Withdrawals send USDC from the platform wallet to your broker wallet.
                The 80/20 split is not yet atomic on-chain — that requires the PaymentRouter contract (roadmap).
              </p>
            </div>

            {/* Platform stats */}
            {summary && (
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d] p-4 mb-8 flex flex-wrap gap-6 text-sm">
                <div><span className="text-amber-100/45">Platform brokers:</span> <span className="font-semibold text-amber-100">{summary.totalAgents}</span></div>
                <div><span className="text-amber-100/45">Platform calls:</span> <span className="font-semibold text-amber-100">{summary.totalCalls}</span></div>
                {summary.topAgent && (
                  <div><span className="text-amber-100/45">Top broker:</span> <span className="font-semibold text-amber-100">{summary.topAgent.name}</span></div>
                )}
              </div>
            )}

            {/* My brokers */}
            <h2 className="text-lg font-semibold text-amber-50 mb-4">My Brokers ({myAgents.length})</h2>

            {myAgents.length === 0 ? (
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d] p-8 text-center">
                <div className="text-3xl mb-3">🤖</div>
                <p className="text-amber-100/60 text-sm">No brokers registered with this wallet yet.</p>
                <Link
                  href="/list-your-broker"
                  className="inline-block mt-4 px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white rounded-full text-sm font-bold transition-all"
                >
                  Register your first broker
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myAgents.map(agent => {
                  const revenue = parseFloat(agent.totalRevenue || '0');
                  const paid = parseFloat(agent.totalPaid || '0');
                  const unpaid = revenue - paid;
                  const history = payoutHistory[agent.id] || [];

                  return (
                    <div key={agent.id} className="rounded-xl border border-amber-100/15 bg-[#17100d] p-5">
                      {/* Agent header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-black/25 border border-amber-100/15 flex items-center justify-center text-xl shrink-0">
                            {agent.avatar || '🤖'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-amber-50">{agent.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                agent.status === 'active'
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                  : agent.status === 'rejected'
                                  ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                              }`}>
                                {agent.status || 'pending'}
                              </span>
                              {agent.online && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">online</span>
                              )}
                              {agent.erc8004_token_id && (
                                <a
                                  href={`https://arbiscan.io/token/${process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS}?a=${agent.erc8004_token_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors"
                                >
                                  ERC-8004 #{agent.erc8004_token_id} ↗
                                </a>
                              )}
                            </div>
                            <div className="text-amber-100/45 text-xs mt-0.5">{agent.category} · ${agent.rate}/min</div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => handleWithdraw(agent)}
                            disabled={unpaid < 0.01 || payoutLoading === agent.id}
                            className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 disabled:bg-black/25 disabled:text-amber-100/25 border border-emerald-500/30 disabled:border-amber-100/10 text-amber-50 text-sm font-medium rounded-xl transition-colors"
                          >
                            {payoutLoading === agent.id
                              ? 'Sending…'
                              : unpaid < 0.01
                              ? 'No balance'
                              : `Withdraw ${unpaid.toFixed(4)} USDC`}
                          </button>
                          {agent.status === 'active' && !agent.erc8004_token_id && (
                            <button
                              onClick={() => handleMintIdentity(agent)}
                              disabled={mintLoading === agent.id}
                              className="px-4 py-2 bg-amber-600/60 hover:bg-amber-600/80 disabled:bg-black/25 disabled:text-amber-100/25 border border-amber-500/30 disabled:border-amber-100/10 text-amber-50 text-sm font-medium rounded-xl transition-colors"
                            >
                              {mintLoading === agent.id ? 'Minting…' : 'Mint ERC-8004'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Per-agent stats */}
                      <div className="grid grid-cols-4 gap-3 text-center mb-4">
                        <div className="bg-black/25 border border-amber-100/10 rounded-lg p-2">
                          <div className="text-lg font-bold text-amber-100">{agent.totalCalls || 0}</div>
                          <div className="text-amber-100/45 text-xs">Calls</div>
                        </div>
                        <div className="bg-black/25 border border-amber-100/10 rounded-lg p-2">
                          <div className="text-lg font-bold text-emerald-400">{revenue.toFixed(4)}</div>
                          <div className="text-amber-100/45 text-xs">Earned</div>
                        </div>
                        <div className="bg-black/25 border border-amber-100/10 rounded-lg p-2">
                          <div className="text-lg font-bold text-amber-100/60">{paid.toFixed(4)}</div>
                          <div className="text-amber-100/45 text-xs">Paid out</div>
                        </div>
                        <div className="bg-black/25 border border-amber-100/10 rounded-lg p-2">
                          <div className="text-lg font-bold text-amber-400">{agent.rating > 0 ? agent.rating.toFixed(1) : '—'}</div>
                          <div className="text-amber-100/45 text-xs">Rating</div>
                        </div>
                      </div>

                      {/* Payout history */}
                      {history.length > 0 && (
                        <div>
                          <div className="text-xs text-amber-100/45 mb-2 font-medium uppercase tracking-wide">Payout History</div>
                          <div className="space-y-1">
                            {history.slice(0, 5).map((p, i) => (
                              <div key={i} className="flex items-center justify-between text-xs text-amber-100/60 bg-black/25 border border-amber-100/10 rounded-lg px-3 py-1.5">
                                <span>{new Date(parseInt(p.timestamp)).toLocaleDateString()}</span>
                                <span className="text-emerald-400 font-medium">{parseFloat(p.amount).toFixed(4)} USDC</span>
                                <a
                                  href={`https://arbiscan.io/tx/${p.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-300 hover:text-amber-200"
                                >
                                  {p.txHash.slice(0, 8)}… ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Earnings breakdown toggle */}
                      <button
                        onClick={() => toggleEarnings(agent.id)}
                        className="mt-3 text-xs text-amber-300 hover:text-amber-200 transition-colors"
                      >
                        {expandedAgent === agent.id ? '▾ Hide call breakdown' : '▸ Show call breakdown'}
                      </button>

                      {/* Per-call earnings breakdown */}
                      {expandedAgent === agent.id && earningsData[agent.id] && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-amber-100/45 mb-1 font-medium uppercase tracking-wide">
                            Recent Calls ({earningsData[agent.id].summary.totalCalls})
                          </div>
                          {earningsData[agent.id].calls.length === 0 ? (
                            <p className="text-xs text-amber-100/40">No calls recorded yet.</p>
                          ) : (
                            <>
                              <div className="space-y-1">
                                {earningsData[agent.id].calls.slice(0, 10).map((c) => (
                                  <div
                                    key={c.callId}
                                    className="flex items-center justify-between text-xs bg-black/25 border border-amber-100/10 rounded-lg px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-100/60">
                                        {c.startedAt ? new Date(c.startedAt).toLocaleDateString() : '—'}
                                      </span>
                                      <span className="text-amber-100/40">{c.duration}s</span>
                                      {c.isTrial ? (
                                        <span className="text-amber-100/40 text-[10px] px-1.5 py-0.5 rounded bg-amber-100/10">
                                          trial
                                        </span>
                                      ) : c.txHash ? (
                                        <span className="text-emerald-400/60 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10">
                                          settled
                                        </span>
                                      ) : (
                                        <span className="text-amber-300/60 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10">
                                          ledgered
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-amber-100/40 text-[10px]">
                                        caller: {c.caller === 'anonymous' ? 'anon' : c.caller.slice(0, 6) + '…'}
                                      </span>
                                      <span className="text-emerald-400 font-medium">
                                        {c.isTrial ? '—' : `${c.agentShareUsdc.toFixed(4)} USDC`}
                                      </span>
                                      {c.txHash && (
                                        <a
                                          href={`https://arbiscan.io/tx/${c.txHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-amber-300 hover:text-amber-200"
                                        >
                                          tx ↗
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="text-[10px] text-amber-100/40 mt-2 leading-relaxed">
                                {earningsData[agent.id].summary.ledgerNote}
                                {' '}{earningsData[agent.id].summary.trialCalls > 0 && `· ${earningsData[agent.id].summary.trialCalls} trial calls (unpaid)`}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {expandedAgent === agent.id && !earningsData[agent.id] && (
                        <div className="mt-3 text-xs text-amber-100/40">Loading call breakdown…</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
