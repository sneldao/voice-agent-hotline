// ============================================
// Payment Settlement API (User-Settled Mode)
// ============================================
// Tracking-only endpoint. Users settle payments directly on-chain
// via their own wallet. This route mirrors settlements for analytics
// and ledgers the 80/20 marketplace split — it does NOT move funds.

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getExplorerTxUrl } from '@/lib/arbitrum-chain';
import { splitRevenue, AGENT_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from '@/lib/fees';
import { verifyWalletAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export async function POST(req: NextRequest) {
  try {
    // Authenticate: caller must prove wallet ownership via EIP-191 signature
    const auth = await verifyWalletAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      callId,
      txHash,
      from,
      to,
      amount,
      amountUsdc,
      agentShareUsdc,
      platformShareUsdc,
      agentWallet,
      agentId,
      token,
      method,
      splitMode,
    } = body;

    if (!callId || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: callId, txHash' },
        { status: 400 }
      );
    }

    if (typeof txHash !== 'string' || !TX_HASH_RE.test(txHash)) {
      return NextResponse.json(
        { error: 'Invalid txHash — must be a 0x-prefixed 32-byte hash' },
        { status: 400 }
      );
    }

    // Prefer explicit USDC human amount; fall back to raw 6-decimal units
    let grossUsdc = typeof amountUsdc === 'number' ? amountUsdc : parseFloat(amountUsdc || '');
    if (!Number.isFinite(grossUsdc)) {
      const raw = typeof amount === 'string' || typeof amount === 'number' ? String(amount) : '0';
      // USDC has 6 decimals — never treat as 18-decimal wei
      grossUsdc = parseFloat(raw) / 1e6;
    }
    if (!Number.isFinite(grossUsdc) || grossUsdc < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const split = splitRevenue(grossUsdc);
    const agentShare =
      typeof agentShareUsdc === 'number' && Number.isFinite(agentShareUsdc)
        ? agentShareUsdc
        : split.agentShare;
    const platformShare =
      typeof platformShareUsdc === 'number' && Number.isFinite(platformShareUsdc)
        ? platformShareUsdc
        : split.platformShare;

    // Record settlement mirror (chain remains source of truth)
    await redis.hset(`settlement:${callId}`, {
      callId,
      txHash,
      from: from || '',
      to: to || '',
      amount: amount?.toString?.() || String(amount || ''),
      amountUsdc: grossUsdc.toFixed(6),
      agentShareUsdc: agentShare.toFixed(6),
      platformShareUsdc: platformShare.toFixed(6),
      agentWallet: agentWallet || '',
      agentId: agentId || '',
      token: token || 'USDC',
      method: method || 'user_settled',
      // ledger = split is accounting only; on_chain would require PaymentRouter
      splitMode: splitMode === 'on_chain' ? 'on_chain' : 'ledger',
      agentSharePercent: String(AGENT_SHARE_PERCENT),
      platformSharePercent: String(PLATFORM_SHARE_PERCENT),
      timestamp: Date.now().toString(),
      settled: 'true',
    });

    // Resolve agent for revenue ledger
    let resolvedAgentId = typeof agentId === 'string' ? agentId : '';
    if (!resolvedAgentId) {
      const call = await redis.hgetall(`call:${callId}`);
      resolvedAgentId = (call?.agentId || call?.agent_id || '') as string;
    }

    if (resolvedAgentId) {
      const agentKey = `agent:${resolvedAgentId}`;
      const agent = await redis.hgetall(agentKey);
      if (agent && Object.keys(agent).length > 0) {
        const currentRevenue = parseFloat((agent.totalRevenue as string) || (agent.total_revenue as string) || '0');
        const currentPlatformRevenue = parseFloat((agent.platformRevenue as string) || '0');
        await redis.hset(agentKey, {
          totalRevenue: (currentRevenue + agentShare).toFixed(6),
          total_revenue: (currentRevenue + agentShare).toFixed(6),
          platformRevenue: (currentPlatformRevenue + platformShare).toFixed(6),
          // Ledger only — not proof of agent wallet credit
          revenueLedgerNote: 'agent_share_ledgered_pending_payout',
        });
        console.log(
          `[API:Settle] Ledger split (not on-chain dual transfer): agent=${agentShare.toFixed(6)} USDC (${AGENT_SHARE_PERCENT}%), platform=${platformShare.toFixed(6)} USDC (${PLATFORM_SHARE_PERCENT}%)`
        );
      }
    }

    console.log('[API:Settle] Recorded user-settled payment mirror:', { callId, txHash, grossUsdc });

    return NextResponse.json({
      success: true,
      receipt: {
        callId,
        txHash,
        settled: true,
        amountUsdc: grossUsdc,
        agentShareUsdc: agentShare,
        platformShareUsdc: platformShare,
        splitMode: splitMode === 'on_chain' ? 'on_chain' : 'ledger',
      },
      explorerUrl: getExplorerTxUrl(txHash),
    });
  } catch (error: unknown) {
    console.error('[API:Settle] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
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

    if (receipt && String(receipt.settled) === 'true') {
      const txHash = typeof receipt.txHash === 'string' ? receipt.txHash : undefined;
      // Only report settled when we have a plausible tx hash
      if (!txHash || !TX_HASH_RE.test(txHash)) {
        return NextResponse.json({ settled: false, callId, reason: 'missing_tx_hash' });
      }
      return NextResponse.json({
        settled: true,
        receipt: {
          ...receipt,
          timestamp: parseInt(receipt.timestamp as string, 10),
        },
        explorerUrl: getExplorerTxUrl(txHash),
      });
    }

    return NextResponse.json({ settled: false, callId });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
