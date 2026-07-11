// x402 Payment API - Demo with built-in data

export const dynamic = 'force-dynamic';
import { ACTIVE_USDC } from '@/lib/arbitrum-chain';

// In-memory storage for demo (use Redis/KV in production)
const paymentSessions = new Map<string, {
  callId: string;
  userWallet: string;
  agentId: string;
  ratePerMinute: string;
  freeMinutes: number;
  minutesUsed: number;
  status: 'free' | 'pending' | 'active' | 'completed';
  createdAt: number;
}>();

const USDC_TOKEN = ACTIVE_USDC;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, callId, userWallet, agentId, ratePerMinuteCents } = body;

    switch (action) {
      case 'create':
        return handleCreateSession({ callId, userWallet, agentId, ratePerMinuteCents });
      case 'authorize':
        return handleAuthorize(callId);
      case 'verify':
        return handleVerify(await request.json());
      case 'status':
        return handleStatus(callId);
      default:
        return Response.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Payments] Error:', error);
    return Response.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

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
}): Response {
  const existing = paymentSessions.get(callId);
  
  if (existing && existing.status !== 'completed') {
    return Response.json({
      success: true,
      data: {
        sessionId: callId,
        status: existing.status,
        freeMinutesRemaining: Math.max(0, 1 - existing.minutesUsed),
        ratePerMinute: existing.ratePerMinute,
      },
    });
  }

  const session = {
    callId,
    userWallet,
    agentId,
    ratePerMinute: String(ratePerMinuteCents * 100),
    freeMinutes: 1,
    minutesUsed: 0,
    status: 'free' as const,
    createdAt: Date.now(),
  };

  paymentSessions.set(callId, session);

  return Response.json({
    success: true,
    data: {
      sessionId: callId,
      status: 'free',
      freeMinutesRemaining: 1,
      ratePerMinute: session.ratePerMinute,
      requirements: {
        scheme: 'exact',
        network: 'arbitrum',
        maxAmountRequired: '0',
        payTo: process.env.PAYMENT_RECEIVER || '0x0000',
        asset: USDC_TOKEN,
        description: `Voice call with agent ${agentId}`,
        mimeType: 'application/json',
      },
    },
  });
}

function handleAuthorize(callId: string): Response {
  const session = paymentSessions.get(callId);
  
  if (!session) {
    return Response.json(
      { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
      { status: 404 }
    );
  }

  if (session.minutesUsed < session.freeMinutes) {
    return Response.json({
      success: true,
      data: {
        status: 'free',
        minutesRemaining: session.freeMinutes - session.minutesUsed,
        requirements: null,
      },
    });
  }

  const amount = session.ratePerMinute;
  const validUntil = Math.floor(Date.now() / 1000) + 3600;
  const nonce = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return Response.json({
    success: true,
    data: {
      status: 'pending',
      amount,
      currency: 'USDC',
      requirements: {
        scheme: 'exact',
        network: 'arbitrum',
        maxAmountRequired: amount,
        payTo: process.env.PAYMENT_RECEIVER || '0x0000',
        asset: USDC_TOKEN,
        description: `Additional minute with agent ${session.agentId}`,
        mimeType: 'application/json',
        extra: { callId, agentId: session.agentId, validUntil: String(validUntil), nonce },
      },
      validFor: 3600,
    },
  });
}

function handleVerify({ callId, authorization }: { callId: string; authorization: any }): Response {
  const session = paymentSessions.get(callId);
  
  if (!session) {
    return Response.json(
      { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
      { status: 404 }
    );
  }

  if (!authorization?.signature) {
    return Response.json(
      { error: 'Invalid authorization', code: 'INVALID_AUTH' },
      { status: 400 }
    );
  }

  session.status = 'active';
  session.minutesUsed++;

  return Response.json({
    success: true,
    data: {
      status: 'active',
      minutesUsed: session.minutesUsed,
      nextPaymentDue: session.minutesUsed < session.freeMinutes ? null : Math.floor(Date.now() / 1000) + 60,
    },
  });
}

function handleStatus(callId: string): Response {
  const session = paymentSessions.get(callId);
  
  if (!session) {
    return Response.json(
      { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
      { status: 404 }
    );
  }

  const minutesUsed = session.minutesUsed;
  const freeMinutesRemaining = Math.max(0, session.freeMinutes - minutesUsed);
  const totalCost = Math.max(0, minutesUsed - session.freeMinutes) * Number(session.ratePerMinute) / 100000000;

  return Response.json({
    success: true,
    data: {
      callId,
      status: session.status,
      agentId: session.agentId,
      ratePerMinute: session.ratePerMinute,
      freeMinutesRemaining,
      minutesUsed,
      totalCost: (totalCost || 0).toFixed(4),
      currency: 'USDC',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get('callId');

  if (!callId) {
    return Response.json(
      { error: 'callId required', code: 'MISSING_PARAM' },
      { status: 400 }
    );
  }

  return handleStatus(callId);
}
