import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { verifyWalletAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/earnings?agentId=xxx
 *
 * Returns per-call earnings breakdown for an agent by reading
 * the split-payment ledger from Redis. Requires wallet auth —
 * only the agent's own wallet can query their earnings.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyWalletAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    // Verify the wallet owns this agent
    const agent = await redis.hgetall(`agent:${agentId}`) as Record<string, string>;
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agentWallet = (agent.wallet_address || '').toLowerCase();
    const callerWallet = (auth.address || '').toLowerCase();
    if (agentWallet !== callerWallet) {
      return NextResponse.json(
        { error: 'Not authorized to view this agent\'s earnings' },
        { status: 403 }
      );
    }

    // Fetch all calls for this agent from the call index
    const allCallIds = await redis.smembers('call_index:all');
    const agentCalls: Array<Record<string, string>> = [];

    // Batch fetch call records
    const pipeline = redis.pipeline();
    allCallIds.forEach(id => pipeline.hgetall(`call:${id}`));
    const results = await pipeline.exec();

    for (const r of results || []) {
      const call = r as any;
      if (!call || Object.keys(call).length === 0) continue;
      if (call.agent_id !== agentId) continue;
      agentCalls.push(call);
    }

    // Sort by started_at descending, take last 50
    agentCalls.sort((a, b) => {
      const aTime = new Date(a.started_at || a.ended_at || 0).getTime();
      const bTime = new Date(b.started_at || b.ended_at || 0).getTime();
      return bTime - aTime;
    });

    const recentCalls = agentCalls.slice(0, 50);

    // Enrich with split-payment ledger data
    const enrichedCalls = await Promise.all(
      recentCalls.map(async (call) => {
        const callId = call.id;
        const split = await redis.hgetall(`split-payment:${callId}`) as Record<string, string>;
        const settlement = await redis.hgetall(`settlement:${callId}`) as Record<string, string>;

        const totalCost = parseFloat(call.total_cost || '0');
        // Agent share is 80% of total
        const agentShare = split?.agentAmount
          ? parseFloat(split.agentAmount) / 1e6
          : totalCost * 0.8;
        const platformShare = split?.platformAmount
          ? parseFloat(split.platformAmount) / 1e6
          : totalCost * 0.2;

        return {
          callId,
          agentId: call.agent_id,
          caller: call.caller_address || 'anonymous',
          duration: parseInt(call.duration_seconds || '0', 10),
          totalCostUsdc: totalCost,
          agentShareUsdc: agentShare,
          platformShareUsdc: platformShare,
          status: call.status || 'unknown',
          startedAt: call.started_at || '',
          endedAt: call.ended_at || '',
          txHash: settlement?.txHash || split?.txHash || null,
          splitMode: split?.splitMode || 'ledger',
          ledgerNote: split?.note || '',
          isTrial: totalCost === 0 && (!split?.txHash || split.txHash === ''),
        };
      })
    );

    // Summary
    const totalRevenue = enrichedCalls.reduce((sum, c) => sum + c.agentShareUsdc, 0);
    const totalPlatformRevenue = enrichedCalls.reduce((sum, c) => sum + c.platformShareUsdc, 0);
    const settledCalls = enrichedCalls.filter(c => c.txHash).length;
    const trialCalls = enrichedCalls.filter(c => c.isTrial).length;

    return NextResponse.json({
      agentId,
      calls: enrichedCalls,
      summary: {
        totalCalls: enrichedCalls.length,
        totalRevenueUsdc: totalRevenue.toFixed(6),
        totalPlatformRevenueUsdc: totalPlatformRevenue.toFixed(6),
        settledCalls,
        trialCalls,
        paidCalls: enrichedCalls.filter(c => !c.isTrial).length,
        ledgerNote: 'Agent share (80%) is ledgered in Redis. On-chain payout requires manual withdrawal.',
      },
    });
  } catch (error: any) {
    console.error('[Earnings API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
