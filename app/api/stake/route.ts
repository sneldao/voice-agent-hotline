// ============================================
// Staking API
// ============================================

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { reputationStaking } from '@/lib/reputation-staking';
import { parseEther } from 'viem';

// GET /api/stake?agentId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    const stake = await reputationStaking.getStake(agentId);

    if (!stake) {
      return NextResponse.json({
        agentId,
        staked: false,
        amount: '0',
        status: 'none',
      });
    }

    return NextResponse.json({
      agentId,
      staked: true,
      amount: stake.amount.toString(),
      amountFormatted: (Number(stake.amount) / 1e18).toString(),
      status: stake.status,
      stakedAt: stake.stakedAt,
      unlockTime: stake.unlockTime,
      canUnstake: stake.status === 'active',
      canWithdraw: stake.status === 'unstaking' && Date.now() >= stake.unlockTime,
    });

  } catch (error: any) {
    console.error('[API:Stake:GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/stake - Stake ETH
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      agentId,
      walletAddress,
      amount, // in ETH (e.g., "100")
    }: {
      agentId: string;
      walletAddress: string;
      amount: string;
    } = body;

    if (!agentId || !walletAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, walletAddress, amount' },
        { status: 400 }
      );
    }

    const amountWei = parseEther(amount);

    const result = await reputationStaking.stake(
      agentId,
      walletAddress as `0x${string}`,
      amountWei
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      message: `Successfully staked ${amount} ETH`,
    });

  } catch (error: any) {
    console.error('[API:Stake:POST] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/stake - Request unstake or withdraw
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      agentId,
      action, // 'unstake' or 'withdraw'
    }: {
      agentId: string;
      action: 'unstake' | 'withdraw';
    } = body;

    if (!agentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, action' },
        { status: 400 }
      );
    }

    if (action === 'unstake') {
      const result = await reputationStaking.requestUnstake(agentId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Unstake requested. 7-day cooldown period started.',
      });
    }

    if (action === 'withdraw') {
      const result = await reputationStaking.withdrawStake(agentId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Stake withdrawn successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "unstake" or "withdraw"' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[API:Stake:PUT] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
