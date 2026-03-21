// WDK x402 Payment API
// Handles payment requirements, verification, and settlement via Tether WDK

import { NextRequest, NextResponse } from 'next/server';
import { WDK_CHAINS } from '@/lib/wdk-wallet';
import { WDKX402Server } from '@/lib/wdk-x402';

export const dynamic = 'force-dynamic';

const paymentSessions = new Map<string, {
  callId: string;
  userWallet: string;
  agentId: string;
  ratePerMinute: string;
  chainKey: string;
  freeMinutes: number;
  minutesUsed: number;
  status: 'free' | 'pending' | 'active' | 'completed';
  createdAt: number;
}>();

function getServer(chainKey: string = 'celo'): WDKX402Server {
  return new WDKX402Server(chainKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return handleCreate(body);
      case 'requirements':
        return handleRequirements(body);
      case 'verify':
        return handleVerify(body);
      case 'settle':
        return handleSettle(body);
      case 'status':
        return handleStatus(body.callId);
      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[WDK Payments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

function handleCreate({ callId, userWallet, agentId, ratePerMinuteCents, chainKey = 'celo' }: {
  callId: string; userWallet: string; agentId: string;
  ratePerMinuteCents: number; chainKey?: string;
}) {
  const config = WDK_CHAINS[chainKey];
  if (!config) {
    return NextResponse.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });
  }

  const session = {
    callId, userWallet, agentId, chainKey,
    ratePerMinute: String(ratePerMinuteCents * (10 ** config.tokenMeta.decimals / 100)),
    freeMinutes: 1,
    minutesUsed: 0,
    status: 'free' as const,
    createdAt: Date.now(),
  };

  paymentSessions.set(callId, session);

  return NextResponse.json({
    success: true,
    data: {
      sessionId: callId,
      status: 'free',
      freeMinutesRemaining: 1,
      ratePerMinute: session.ratePerMinute,
      chain: {
        key: chainKey,
        name: config.name,
        chainId: config.chainId,
        token: config.usdtAddress,
        tokenName: config.tokenMeta.name,
        decimals: config.tokenMeta.decimals,
      },
    },
  });
}

function handleRequirements({ callId, chainKey = 'celo' }: { callId: string; chainKey?: string }) {
  const session = paymentSessions.get(callId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.minutesUsed < session.freeMinutes) {
    return NextResponse.json({
      success: true,
      data: {
        status: 'free',
        minutesRemaining: session.freeMinutes - session.minutesUsed,
        requirements: null,
      },
    });
  }

  const config = WDK_CHAINS[session.chainKey];
  const payTo = process.env.PAYMENT_RECEIVER as `0x${string}` || '0x0000000000000000000000000000000000000000';

  const server = getServer(session.chainKey);
  const requirements = server.createPaymentRequirements({
    amount: session.ratePerMinute,
    payTo,
    description: `Voice call minute with ${session.agentId}`,
  });

  return NextResponse.json({
    success: true,
    data: {
      status: 'pending',
      amount: session.ratePerMinute,
      currency: config?.tokenMeta.name || 'USD₮',
      ...requirements,
    },
  });
}

async function handleVerify({ authorization, chainKey = 'celo' }: {
  authorization: {
    from: string; to: string; value: string;
    validAfter: string; validBefore: string; nonce: `0x${string}`;
    v: number; r: `0x${string}`; s: `0x${string}`;
  };
  chainKey?: string;
}) {
  const server = getServer(chainKey);
  const result = await server.verifyPayment(
    {
      from: authorization.from as `0x${string}`,
      to: authorization.to as `0x${string}`,
      value: authorization.value,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce,
      v: authorization.v,
      r: authorization.r,
      s: authorization.s,
    },
    authorization.value
  );

  return NextResponse.json({
    success: result.valid,
    error: result.error,
    network: WDK_CHAINS[chainKey]?.x402Network,
  });
}

async function handleSettle({ authorization, callId, chainKey = 'celo' }: {
  authorization: {
    from: string; to: string; value: string;
    validAfter: string; validBefore: string; nonce: `0x${string}`;
    v: number; r: `0x${string}`; s: `0x${string}`;
  };
  callId: string;
  chainKey?: string;
}) {
  const session = paymentSessions.get(callId);
  if (session) {
    session.status = 'active';
    session.minutesUsed++;
  }

  return NextResponse.json({
    success: true,
    data: {
      status: 'active',
      minutesUsed: session?.minutesUsed ?? 0,
      settled: true,
      note: 'Settlement via facilitator. In production, the facilitator submits transferWithAuthorization on-chain.',
    },
  });
}

function handleStatus(callId: string) {
  const session = paymentSessions.get(callId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const config = WDK_CHAINS[session.chainKey];
  const decimals = config?.tokenMeta.decimals ?? 18;
  const minutesUsed = session.minutesUsed;
  const freeMinutesRemaining = Math.max(0, session.freeMinutes - minutesUsed);
  const billableMinutes = Math.max(0, minutesUsed - session.freeMinutes);
  const totalCost = billableMinutes * Number(session.ratePerMinute) / (10 ** decimals);

  return NextResponse.json({
    success: true,
    data: {
      callId,
      status: session.status,
      agentId: session.agentId,
      chain: session.chainKey,
      ratePerMinute: session.ratePerMinute,
      freeMinutesRemaining,
      minutesUsed,
      totalCost: totalCost.toFixed(4),
      currency: config?.tokenMeta.name || 'USD₮',
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get('callId');
  if (!callId) {
    return NextResponse.json({ error: 'callId required' }, { status: 400 });
  }
  return handleStatus(callId);
}
