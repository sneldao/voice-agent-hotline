'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContextNew';
import { apiUrl } from '@/lib/api';

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

interface StatsSummary {
  totalAgents: number;
  totalCalls: number;
  avgRating: number;
  topAgent: { name: string; calls: number; category: string; avatar: string } | null;
  generatedAt: string;
}

export default function DashboardPage() {
  const { address, connected, connect } = useWallet();
  const [myAgents, setMyAgents] = useState<AgentStat[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState<string | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<Record<string, PayoutRecord[]>>({});
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

      // Fetch payout history for each agent
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

  // USDC on Arbitrum One
  const CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';

  // Encode ERC-20 transfer(address,uint256) calldata
  const encodeTransfer = (to: string, amountWei: bigint): string => {
    const selector = '0xa9059cbb';
    const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0');
    const paddedAmount = amountWei.toString(16).padStart(64, '0');
    return selector + paddedTo + paddedAmount;
  };

  // Encode registerAgent(string,uint256,string[]) calldata for ERC-8004
  const encodeRegisterAgent = (agentURI: string, rateWei: bigint, specialties: string[]): string => {
    // selector for registerAgent(string,uint256,string[])
    const selector = '0x' + Array.from(
      new Uint8Array(
        // keccak256 of "registerAgent(string,uint256,string[])" first 4 bytes
        // precomputed: 0x4a0e5371
        [0x4a, 0x0e, 0x53, 0x71]
      )
    ).map(b => b.toString(16).padStart(2, '0')).join('');

    // ABI-encode: offsets for dynamic types
    // param0 (string agentURI): offset = 0x60 (3 * 32)
    // param1 (uint256 rate): inline
    // param2 (string[] specialties): offset = 0x60 + 32 + ceil(len/32)*32 + 32
    const encodeString = (s: string): string => {
      const bytes = new TextEncoder().encode(s);
      const lenHex = bytes.length.toString(16).padStart(64, '0');
      const dataHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const padded = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, '0');
      return lenHex + padded;
    };

    const uriEncoded = encodeString(agentURI);
    const rateHex = rateWei.toString(16).padStart(64, '0');

    // string[] encoding: length + each string offset + each string data
    const arrLen = specialties.length.toString(16).padStart(64, '0');
    const encodedStrings = specialties.map(encodeString);
    const strOffsets = specialties.map((_, i) => {
      const prior = encodedStrings.slice(0, i).reduce((acc, s) => acc + s.length / 2, 0);
      return (specialties.length * 32 + prior).toString(16).padStart(64, '0');
    });
    const arrEncoded = arrLen + strOffsets.join('') + encodedStrings.join('');

    // Offsets from start of params (after selector)
    const uriOffset = (3 * 32).toString(16).padStart(64, '0'); // 0x60
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
      // USDC has 6 decimals on Arbitrum
      const amountWei = BigInt(Math.floor(unpaid * 1e18));
      const data = encodeTransfer(address, amountWei);
      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: CUSD_ADDRESS, data }],
      });
      // Record the confirmed payout server-side
      await fetch(apiUrl('/api/agents/payout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, walletAddress: address, txHash, amount: unpaid.toFixed(6) }),
      });
      showToast(`Withdrew ${unpaid.toFixed(4)} USDC ✓ — tx: ${(txHash as string).slice(0, 10)}…`);
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
      const agentURI = `https://voisss-agent-hotline.vercel.app/api/agents/${agent.id}`;
      const rateWei = BigInt(Math.floor(parseFloat(String(agent.rate || '0.10')) * 1e18));
      const specialties = agent.category ? [agent.category] : ['general'];
      const data = encodeRegisterAgent(agentURI, rateWei, specialties);
      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: identityAddress, data }],
      });
      // Store the tx hash so the user can track it; token ID resolved off-chain
      await fetch(apiUrl(`/api/agents/${agent.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erc8004_mint_tx: txHash }),
      });
      showToast(`ERC-8004 mint submitted ✓ — tx: ${(txHash as string).slice(0, 10)}…`);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">🎙️</div>
          <h1 className="text-xl font-semibold text-white">Agent Developer Dashboard</h1>
          <p className="text-slate-400 text-sm">Connect the wallet you used to register your agents</p>
          <button
            onClick={connect}
            className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Developer Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1 font-mono">
              {address?.slice(0, 8)}…{address?.slice(-4)}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/list-your-agent"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + List Agent
            </a>
            <button
              onClick={fetchData}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              ↻
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading…</div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-400">{totalCalls}</div>
                <div className="text-slate-400 text-xs mt-1">Total Calls</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{totalEarnings.toFixed(4)}</div>
                <div className="text-slate-400 text-xs mt-1">Earned (USDC)</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{totalUnpaid.toFixed(4)}</div>
                <div className="text-slate-400 text-xs mt-1">Withdrawable</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-sky-400">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                <div className="text-slate-400 text-xs mt-1">Avg Rating</div>
              </div>
            </div>

            {/* Platform stats */}
            {summary && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-8 flex flex-wrap gap-6 text-sm">
                <div><span className="text-slate-400">Platform agents:</span> <span className="font-semibold">{summary.totalAgents}</span></div>
                <div><span className="text-slate-400">Platform calls:</span> <span className="font-semibold">{summary.totalCalls}</span></div>
                {summary.topAgent && (
                  <div><span className="text-slate-400">Top agent:</span> <span className="font-semibold">{summary.topAgent.name}</span></div>
                )}
              </div>
            )}

            {/* My agents */}
            <h2 className="text-lg font-semibold mb-4">My Agents ({myAgents.length})</h2>

            {myAgents.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <div className="text-3xl mb-3">🤖</div>
                <p className="text-slate-400 text-sm">No agents registered with this wallet yet.</p>
                <a
                  href="/list-your-agent"
                  className="inline-block mt-4 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Register your first agent
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {myAgents.map(agent => {
                  const revenue = parseFloat(agent.totalRevenue || '0');
                  const paid = parseFloat(agent.totalPaid || '0');
                  const unpaid = revenue - paid;
                  const history = payoutHistory[agent.id] || [];

                  return (
                    <div key={agent.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                      {/* Agent header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl shrink-0">
                            {agent.avatar || '🤖'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{agent.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                agent.status === 'active'
                                  ? 'bg-emerald-900 text-emerald-300'
                                  : agent.status === 'rejected'
                                  ? 'bg-red-900 text-red-300'
                                  : 'bg-amber-900 text-amber-300'
                              }`}>
                                {agent.status || 'pending'}
                              </span>
                              {agent.online && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">online</span>
                              )}
                              {agent.erc8004_token_id && (
                                <a
                                  href={`https://arbiscan.io/token/${process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS}?a=${agent.erc8004_token_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-0.5 rounded-full bg-violet-900 text-violet-300 hover:bg-violet-800 transition-colors"
                                >
                                  ERC-8004 #{agent.erc8004_token_id} ↗
                                </a>
                              )}
                            </div>
                            <div className="text-slate-500 text-xs mt-0.5">{agent.category} · ${agent.rate}/min</div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => handleWithdraw(agent)}
                            disabled={unpaid < 0.01 || payoutLoading === agent.id}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
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
                              className="px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              {mintLoading === agent.id ? 'Minting…' : 'Mint ERC-8004 ⛓️'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Per-agent stats */}
                      <div className="grid grid-cols-4 gap-3 text-center mb-4">
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="text-lg font-bold">{agent.totalCalls || 0}</div>
                          <div className="text-slate-500 text-xs">Calls</div>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="text-lg font-bold text-emerald-400">{revenue.toFixed(4)}</div>
                          <div className="text-slate-500 text-xs">Earned</div>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="text-lg font-bold text-slate-400">{paid.toFixed(4)}</div>
                          <div className="text-slate-500 text-xs">Paid out</div>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="text-lg font-bold text-amber-400">{agent.rating > 0 ? agent.rating.toFixed(1) : '—'}</div>
                          <div className="text-slate-500 text-xs">Rating</div>
                        </div>
                      </div>

                      {/* Payout history */}
                      {history.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Payout History</div>
                          <div className="space-y-1">
                            {history.slice(0, 5).map((p, i) => (
                              <div key={i} className="flex items-center justify-between text-xs text-slate-400 bg-slate-800 rounded px-3 py-1.5">
                                <span>{new Date(parseInt(p.timestamp)).toLocaleDateString()}</span>
                                <span className="text-emerald-400 font-medium">{parseFloat(p.amount).toFixed(4)} USDC</span>
                                <a
                                  href={`https://arbiscan.io/tx/${p.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-violet-400 hover:text-violet-300"
                                >
                                  {p.txHash.slice(0, 8)}… ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
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
