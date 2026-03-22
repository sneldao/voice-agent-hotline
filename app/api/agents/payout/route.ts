// ============================================
// Agent Earnings Payout API
// ============================================
// POST /api/agents/payout — record a client-confirmed on-chain payout
// GET  /api/agents/payout — get payout history and unpaid balance for an agent
//
// The actual cUSD transfer is signed by the agent's own wallet in the browser.
// This endpoint only validates ownership and records the confirmed tx hash.

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const MIN_PAYOUT = 0.01;

export async function POST(req: NextRequest) {
  try {
    const { agentId, walletAddress, txHash, amount } = await req.json();

    if (!agentId || !walletAddress || !txHash || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, walletAddress, txHash, amount' },
        { status: 400 }
      );
    }

    const agent = await redis.hgetall(`agent:${agentId}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Verify the requesting wallet owns this agent
    const agentWallet = (agent.wallet_address as string) || '';
    if (agentWallet.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized: wallet does not own this agent' },
        { status: 403 }
      );
    }

    const paidAmount = parseFloat(amount);
    if (paidAmount < MIN_PAYOUT) {
      return NextResponse.json(
        { error: `Minimum payout is ${MIN_PAYOUT} cUSD` },
        { status: 400 }
      );
    }

    // Record the confirmed payout
    const alreadyPaid = parseFloat((agent.totalPaid as string) || '0');
    const newTotalPaid = alreadyPaid + paidAmount;
    const payoutRecord = {
      agentId,
      to: walletAddress,
      amount: paidAmount.toFixed(6),
      txHash,
      timestamp: Date.now().toString(),
    };

    await redis.hset(`agent:${agentId}`, { totalPaid: newTotalPaid.toFixed(6) });
    await redis.lpush(`payouts:${agentId}`, JSON.stringify(payoutRecord));

    console.log(`[API:Payout] Recorded ${paidAmount.toFixed(6)} cUSD payout to ${walletAddress}, tx: ${txHash}`);

    return NextResponse.json({
      success: true,
      txHash,
      amount: paidAmount.toFixed(6),
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    });
  } catch (error: any) {
    console.error('[API:Payout] Error:', error);
    return NextResponse.json({ error: error.message || 'Payout recording failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId parameter' }, { status: 400 });
    }

    const agent = await redis.hgetall(`agent:${agentId}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const payoutStrings = await redis.lrange(`payouts:${agentId}`, 0, 49);
    const payouts = payoutStrings
      .map(p => { try { return JSON.parse(p as string); } catch { return null; } })
      .filter(Boolean);

    const totalRevenue = parseFloat((agent.totalRevenue as string) || '0');
    const totalPaid = parseFloat((agent.totalPaid as string) || '0');

    return NextResponse.json({
      agentId,
      totalRevenue: totalRevenue.toFixed(6),
      totalPaid: totalPaid.toFixed(6),
      unpaid: (totalRevenue - totalPaid).toFixed(6),
      payouts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
