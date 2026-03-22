// ============================================
// Agent Earnings Payout API
// ============================================
// POST /api/agents/payout — trigger on-chain cUSD payout to agent wallet
// GET  /api/agents/payout — get payout history for an agent
//
// Called by agent developers from the dashboard to withdraw accumulated earnings.
// Uses the facilitator wallet to send cUSD on Celo mainnet.

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

export const dynamic = 'force-dynamic';

// Minimum payout threshold in cUSD
const MIN_PAYOUT = 0.01;

// cUSD token address on Celo mainnet
const CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const { agentId, walletAddress } = await req.json();

    if (!agentId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, walletAddress' },
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
      return NextResponse.json({ error: 'Unauthorized: wallet does not own this agent' }, { status: 403 });
    }

    const pendingRevenue = parseFloat((agent.totalRevenue as string) || '0');
    const alreadyPaid = parseFloat((agent.totalPaid as string) || '0');
    const unpaid = pendingRevenue - alreadyPaid;

    if (unpaid < MIN_PAYOUT) {
      return NextResponse.json({
        error: `Minimum payout is ${MIN_PAYOUT} cUSD. Current unpaid balance: ${unpaid.toFixed(6)} cUSD`,
        unpaid,
      }, { status: 400 });
    }

    const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY;
    if (!facilitatorKey) {
      return NextResponse.json({ error: 'Payout not configured: missing facilitator key' }, { status: 503 });
    }

    const account = privateKeyToAccount(facilitatorKey as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: celo, transport: http('https://forno.celo.org') });
    const publicClient = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') });

    // Check facilitator cUSD balance
    const facilitatorBalance = await publicClient.readContract({
      address: CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    const payoutAmount = parseEther(unpaid.toFixed(6));
    if (facilitatorBalance < payoutAmount) {
      return NextResponse.json({
        error: `Insufficient facilitator balance. Available: ${formatEther(facilitatorBalance)} cUSD, Requested: ${unpaid.toFixed(6)} cUSD`,
      }, { status: 503 });
    }

    // Send cUSD to agent wallet
    const hash = await walletClient.writeContract({
      address: CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [walletAddress as `0x${string}`, payoutAmount],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // Record payout in Redis
    const newTotalPaid = alreadyPaid + unpaid;
    const payoutRecord = {
      agentId,
      to: walletAddress,
      amount: unpaid.toFixed(6),
      txHash: hash,
      timestamp: Date.now().toString(),
    };

    await redis.hset(`agent:${agentId}`, { totalPaid: newTotalPaid.toFixed(6) });
    await redis.lpush(`payouts:${agentId}`, JSON.stringify(payoutRecord));

    console.log(`[API:Payout] Paid ${unpaid.toFixed(6)} cUSD to ${walletAddress}, tx: ${hash}`);

    return NextResponse.json({
      success: true,
      txHash: hash,
      amount: unpaid.toFixed(6),
      explorerUrl: `https://celoscan.io/tx/${hash}`,
    });
  } catch (error: any) {
    console.error('[API:Payout] Error:', error);
    return NextResponse.json({ error: error.message || 'Payout failed' }, { status: 500 });
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
    const payouts = payoutStrings.map(p => {
      try { return JSON.parse(p as string); } catch { return null; }
    }).filter(Boolean);

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
