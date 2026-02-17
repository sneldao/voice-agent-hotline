// ============================================
// Reputation API
// ============================================

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { reputationStaking } from '@/lib/reputation-staking';

// GET /api/reputation?agentId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      // Return leaderboard
      const leaderboard = await reputationStaking.getLeaderboard(20);
      return NextResponse.json({ leaderboard });
    }

    const reputation = await reputationStaking.getReputation(agentId);
    const stats = await reputationStaking.getAgentStats(agentId);

    if (!reputation) {
      return NextResponse.json(
        { error: 'Reputation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      reputation,
      stats: {
        ...stats,
        totalRevenue: stats.totalRevenue.toString(),
        totalStaked: stats.totalStaked.toString(),
      },
    });

  } catch (error: any) {
    console.error('[API:Reputation] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
