/**
 * x402 Payment API
 * 
 * Handles per-minute micropayments on Celo via x402 protocol.
 * Supports cUSD and USDC with automatic conversion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';

// Celo mainnet addresses
const CUSD_TOKEN = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const USDC_TOKEN = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C';

// In-memory session storage (use Redis in production)
const paymentSessions = new Map<string, {
  callId: string;
  userWallet: string;
  agentId: string;
  ratePerMinute: bigint;
  freeMinutes: number;
  minutesUsed: number;
  status: 'free' | 'pending' | 'active' | 'completed';
  createdAt: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, callId, userWallet, agentId, ratePerMinuteCents } = body;

    switch (action) {
      case 'create':
        return handleCreateSession({ callId, userWallet, agentId, ratePerMinuteCents });
      case 'authorize':
        return handleAuthorize(callId, request);
      case 'verify':
        return handleVerify(request);
      case 'status':
        return handleStatus(callId);
      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Payments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Create a new payment session for a call
 */
function handleCreateSession({
  callId,
  userWallet,
  agentId,
  ratePerMinuteCents,
}: {
  callId: string;
  userWallet: string;
  agentId: string;
  ratePerMinuteCents: number;
}): NextResponse {
  // Check for existing session
  if (paymentSessions.has(callId)) {
    const existing = paymentSessions.get(callId)!;
    if (existing.status !== 'completed') {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: callId,
          status: existing.status,
          freeMinutesRemaining: Math.max(0, 1 - existing.minutesUsed),
          ratePerMinute: existing.ratePerMinute.toString(),
        },
      });
    }
  }

  // Create new session with 1 free minute
  const session = {
    callId,
    userWallet,
    agentId,
    ratePerMinute: BigInt(ratePerMinuteCents * 100), // Convert to micro-cents
    freeMinutes: 1,
    minutesUsed: 0,
    status: 'free' as const,
    createdAt: Date.now(),
  };

  paymentSessions.set(callId, session);

  console.log(`[Payments] Session created: ${callId}`);

  return NextResponse.json({
    success: true,
    data: {
      sessionId: callId,
      status: 'free',
      freeMinutesRemaining: 1,
      ratePerMinute: session.ratePerMinute.toString(),
      requirements: {
        scheme: 'exact',
        network: 'celo',
        maxAmountRequired: '0', // Free for first minute
        payTo: process.env.PAYMENT_RECEIVER || '0x0000000000000000000000000000000000000000',
        asset: CUSD_TOKEN,
        description: `Voice call with agent ${agentId}`,
        mimeType: 'application/json',
      },
    },
  });
}

/**
 * Generate x402 payment authorization requirements
 */
async function handleAuthorize(callId: string, request: NextRequest): Promise<NextResponse> {
  const session = paymentSessions.get(callId);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Check if free minute is still available
  if (session.minutesUsed < session.freeMinutes) {
    return NextResponse.json({
      success: true,
      data: {
        status: 'free',
        minutesRemaining: session.freeMinutes - session.minutesUsed,
        requirements: null, // No payment needed
      },
    });
  }

  // Calculate amount for next minute
  const amount = session.ratePerMinute;
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

  // Generate nonce
  const nonce = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Return payment requirements for EIP-712 signing
  const requirements = {
    scheme: 'exact' as const,
    network: 'celo',
    maxAmountRequired: amount.toString(),
    payTo: process.env.PAYMENT_RECEIVER || '0x0000000000000000000000000000000000000000',
    asset: CUSD_TOKEN,
    description: `Additional minute with agent ${session.agentId}`,
    mimeType: 'application/json',
    extra: {
      callId,
      agentId: session.agentId,
      validUntil: validUntil.toString(),
      nonce,
    },
  };

  console.log(`[Payments] Authorization requested: ${callId}, amount: ${amount}`);

  return NextResponse.json({
    success: true,
    data: {
      status: 'pending',
      amount: amount.toString(),
      currency: 'cUSD',
      requirements,
      validFor: 3600, // 1 hour in seconds
    },
  });
}

/**
 * Verify x402 payment authorization and activate session
 */
async function handleVerify(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const { callId, authorization } = body;

  const session = paymentSessions.get(callId);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
      { status: 404 }
    );
  }

  // In production, verify the EIP-712 signature against the blockchain
  // For now, validate structure
  if (!authorization || !authorization.signature) {
    return NextResponse.json(
      { error: 'Invalid authorization', code: 'INVALID_AUTH' },
      { status: 400 }
    );
  }

  // Update session status
  session.status = 'active';
  session.minutesUsed++;

  console.log(`[Payments] Payment verified: ${callId}, total minutes: ${session.minutesUsed}`);

  return NextResponse.json({
    success: true,
    data: {
      status: 'active',
      minutesUsed: session.minutesUsed,
      nextPaymentDue: session.minutesUsed < session.freeMinutes 
        ? null 
        : Math.floor(Date.now() / 1000) + 60,
    },
  });
}

/**
 * Get session status
 */
function handleStatus(callId: string): NextResponse {
  const session = paymentSessions.get(callId);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
      { status: 404 }
    );
  }

  const minutesUsed = session.minutesUsed;
  const freeMinutesRemaining = Math.max(0, session.freeMinutes - minutesUsed);
  const currentCost = Math.max(0, minutesUsed - session.freeMinutes) 
    * Number(session.ratePerMinute) / 100000000; // Convert from micro-cents

  return NextResponse.json({
    success: true,
    data: {
      callId,
      status: session.status,
      agentId: session.agentId,
      ratePerMinute: session.ratePerMinute.toString(),
      freeMinutesRemaining,
      minutesUsed,
      totalCost: currentCost.toFixed(4),
      currency: 'cUSD',
    },
  });
}

/**
 * GET endpoint for session info
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get('callId');

  if (!callId) {
    return NextResponse.json(
      { error: 'callId required', code: 'MISSING_PARAM' },
      { status: 400 }
    );
  }

  return handleStatus(callId);
}
