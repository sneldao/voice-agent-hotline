// ============================================
// Disputes API
// ============================================

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { reputationStaking, DisputeReason } from '@/lib/reputation-staking';

// GET /api/disputes?agentId=xxx or /api/disputes?id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const disputeId = searchParams.get('id');
    const agentId = searchParams.get('agentId');
    const callId = searchParams.get('callId');

    if (disputeId) {
      const dispute = await reputationStaking.getDispute(disputeId);
      if (!dispute) {
        return NextResponse.json(
          { error: 'Dispute not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ dispute });
    }

    if (callId) {
      const dispute = await reputationStaking.getDisputeByCall(callId);
      if (!dispute) {
        return NextResponse.json(
          { error: 'No dispute found for this call' },
          { status: 404 }
        );
      }
      return NextResponse.json({ dispute });
    }

    if (agentId) {
      const disputes = await reputationStaking.getOpenDisputes(agentId);
      return NextResponse.json({ 
        agentId, 
        disputes,
        count: disputes.length 
      });
    }

    return NextResponse.json(
      { error: 'Missing parameter: id, agentId, or callId' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[API:Disputes:GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/disputes - File a new dispute
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      callId,
      agentId,
      complainant,
      reason,
      description,
      evidence,
    }: {
      callId: string;
      agentId: string;
      complainant: string;
      reason: DisputeReason;
      description: string;
      evidence?: string[];
    } = body;

    if (!callId || !agentId || !complainant || !reason || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await reputationStaking.fileDispute(
      callId,
      agentId,
      complainant as `0x${string}`,
      reason,
      description,
      evidence
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      disputeId: result.disputeId,
      message: 'Dispute filed successfully',
    });

  } catch (error: any) {
    console.error('[API:Disputes:POST] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/disputes - Resolve a dispute (arbitrator only)
export async function PUT(req: NextRequest) {
  try {
    // Verify arbitrator authorization
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.ARBITRATOR_API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      disputeId,
      inFavorOfComplainant,
      resolution,
    }: {
      disputeId: string;
      inFavorOfComplainant: boolean;
      resolution: string;
    } = body;

    if (!disputeId || typeof inFavorOfComplainant !== 'boolean' || !resolution) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await reputationStaking.resolveDispute(
      disputeId,
      inFavorOfComplainant,
      resolution
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Dispute resolved successfully',
    });

  } catch (error: any) {
    console.error('[API:Disputes:PUT] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
