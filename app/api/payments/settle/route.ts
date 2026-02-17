// ============================================
// Payment Settlement API
// ============================================
// Handles on-chain settlement of x402 payments

import { NextRequest, NextResponse } from 'next/server';
import { 
  paymentSettlement, 
  SignedAuthorization,
  CELO_TOKENS 
} from '@/lib/payment-settlement';
import { redis } from '@/lib/redis';

// ============================================
// POST /api/payments/settle
// Settle a payment authorization on-chain
// ============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      authorization,
      callId,
      token = 'cUSD',
    }: {
      authorization: SignedAuthorization;
      callId: string;
      token?: 'cUSD' | 'USDC';
    } = body;

    // Validate required fields
    if (!authorization || !callId) {
      return NextResponse.json(
        { error: 'Missing required fields: authorization, callId' },
        { status: 400 }
      );
    }

    // Validate authorization structure
    if (!authorization.from || !authorization.to || !authorization.value) {
      return NextResponse.json(
        { error: 'Invalid authorization structure' },
        { status: 400 }
      );
    }

    console.log('[API:Settle] Processing settlement:', {
      callId,
      from: authorization.from,
      to: authorization.to,
      value: authorization.value.toString(),
      token,
    });

    // Check if already settled
    const existingReceipt = paymentSettlement.getReceipt(callId);
    if (existingReceipt?.settled) {
      return NextResponse.json({
        success: true,
        alreadySettled: true,
        receipt: existingReceipt,
      });
    }

    // Get token address
    const tokenAddress = token === 'USDC' ? CELO_TOKENS.USDC : CELO_TOKENS.cUSD;

    // Execute settlement
    const result = await paymentSettlement.settlePayment(
      authorization,
      tokenAddress,
      callId
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Settlement failed',
          details: result.error,
        },
        { status: 400 }
      );
    }

    // Store settlement in Redis for persistence
    await redis.hset(`settlement:${callId}`, {
      callId,
      txHash: result.txHash,
      blockNumber: result.blockNumber?.toString(),
      amount: result.actualAmount,
      token,
      timestamp: Date.now().toString(),
      settled: 'true',
    });

    // Update agent revenue
    const call = await redis.hgetall(`call:${callId}`);
    if (call && call.agentId) {
      const agentKey = `agent:${call.agentId}`;
      const agent = await redis.hgetall(agentKey);
      if (agent) {
        const currentRevenue = parseFloat((agent.totalRevenue as string) || '0');
        const newRevenue = currentRevenue + parseFloat(result.actualAmount || '0');
        await redis.hset(agentKey, {
          ...agent,
          totalRevenue: newRevenue.toString(),
        });
      }
    }

    console.log('[API:Settle] ✅ Settlement complete:', {
      callId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
    });

    return NextResponse.json({
      success: true,
      receipt: {
        callId,
        txHash: result.txHash,
        blockNumber: result.blockNumber?.toString(),
        amount: result.actualAmount,
        token,
        gasUsed: result.gasUsed?.toString(),
        timestamp: Date.now(),
      },
      explorerUrl: `https://celoscan.io/tx/${result.txHash}`,
    });

  } catch (error: any) {
    console.error('[API:Settle] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/payments/settle?callId=xxx
// Get settlement receipt for a call
// ============================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json(
        { error: 'Missing callId parameter' },
        { status: 400 }
      );
    }

    // Try memory first
    const receipt = paymentSettlement.getReceipt(callId);
    
    if (receipt) {
      return NextResponse.json({
        settled: true,
        receipt,
        explorerUrl: `https://celoscan.io/tx/${receipt.txHash}`,
      });
    }

    // Try Redis
    const redisReceipt = await redis.hgetall(`settlement:${callId}`);
    
    if (redisReceipt && redisReceipt.settled === 'true') {
      return NextResponse.json({
        settled: true,
        receipt: {
          ...redisReceipt,
          blockNumber: parseInt(redisReceipt.blockNumber as string),
          timestamp: parseInt(redisReceipt.timestamp as string),
        },
        explorerUrl: `https://celoscan.io/tx/${redisReceipt.txHash}`,
      });
    }

    return NextResponse.json({
      settled: false,
      callId,
    });

  } catch (error: any) {
    console.error('[API:Settle:GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// OPTIONS handler for CORS
// ============================================
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
