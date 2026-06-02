// ============================================
// Payment Settlement API (User-Settled Mode)
// ============================================
// Tracking-only endpoint. Users settle payments directly on-chain
// via their own wallet. This route records settlements for analytics.

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getExplorerTxUrl } from '@/lib/superfluid-streaming';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { callId, txHash, from, to, amount, token, method } = body;

    if (!callId || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: callId, txHash' },
        { status: 400 }
      );
    }

    // Record settlement in Redis
    await redis.hset(`settlement:${callId}`, {
      callId,
      txHash,
      from: from || '',
      to: to || '',
      amount: amount || '',
      token: token || 'USDC',
      method: method || 'user_settled',
      timestamp: Date.now().toString(),
      settled: 'true',
    });

    // Update agent revenue with 80/20 split (80% agent, 20% platform)
    if (to) {
      const call = await redis.hgetall(`call:${callId}`);
      if (call && call.agentId) {
        const agentKey = `agent:${call.agentId}`;
        const agent = await redis.hgetall(agentKey);
        if (agent) {
          const amountFloat = parseFloat(amount || '0') / 1e18;
          const agentShare = amountFloat * 0.8;
          const platformShare = amountFloat * 0.2;
          const currentRevenue = parseFloat((agent.totalRevenue as string) || '0');
          const currentPlatformRevenue = parseFloat((agent.platformRevenue as string) || '0');
          await redis.hset(agentKey, {
            totalRevenue: (currentRevenue + agentShare).toFixed(6),
            platformRevenue: (currentPlatformRevenue + platformShare).toFixed(6),
          });
          console.log(`[API:Settle] Split: agent=${agentShare.toFixed(6)} USDC (80%), platform=${platformShare.toFixed(6)} USDC (20%)`);
        }
      }
    }

    console.log('[API:Settle] Recorded user-settled payment:', { callId, txHash });

    return NextResponse.json({
      success: true,
      receipt: { callId, txHash, settled: true },
      explorerUrl: txHash ? getExplorerTxUrl(txHash) : undefined,
    });
  } catch (error: any) {
    console.error('[API:Settle] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json({ error: 'Missing callId parameter' }, { status: 400 });
    }

    const receipt = await redis.hgetall(`settlement:${callId}`);

    if (receipt && receipt.settled === 'true') {
      const txHash = typeof receipt.txHash === 'string' ? receipt.txHash : undefined;
      return NextResponse.json({
        settled: true,
        receipt: {
          ...receipt,
          timestamp: parseInt(receipt.timestamp as string),
        },
        explorerUrl: txHash ? getExplorerTxUrl(txHash) : undefined,
      });
    }

    return NextResponse.json({ settled: false, callId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://voisss-agent-hotline.vercel.app',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
