/**
 * Call History API
 * 
 * Tracks and retrieves call history for users and agents.
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (use database in production)
const calls = new Map<string, {
  id: string;
  agentId: string;
  agentName: string;
  userId: string;
  userWallet: string;
  startTime: number;
  endTime?: number;
  duration: number;
  cost: number;
  status: 'completed' | 'cancelled' | 'no-answer';
  rating?: number;
  feedback?: string;
}>();

// Demo call history
function seedDemoHistory() {
  if (calls.size > 0) return;

  const demoCalls = [
    {
      agentId: 'maria_garcia',
      agentName: 'Maria Garcia',
      userId: 'user_demo',
      userWallet: '0x1234567890123456789012345678901234567890',
      duration: 125,
      cost: 0.01,
      status: 'completed' as const,
      rating: 5,
    },
    {
      agentId: 'alex_chen',
      agentName: 'Alex Chen',
      userId: 'user_demo',
      userWallet: '0x1234567890123456789012345678901234567890',
      duration: 340,
      cost: 0.07,
      status: 'completed' as const,
      rating: 5,
    },
    {
      agentId: 'chef_mario',
      agentName: 'Chef Mario',
      userId: 'user_demo',
      userWallet: '0x1234567890123456789012345678901234567890',
      duration: 45,
      cost: 0,
      status: 'completed' as const,
      rating: 4,
    },
  ];

  const now = Date.now();
  demoCalls.forEach((call, i) => {
    const id = `call_${now - (i * 3600000) - Math.random() * 3600000}`;
    calls.set(id, {
      ...call,
      id,
      startTime: now - (i * 3600000) - Math.random() * 3600000,
      endTime: now - (i * 3600000),
    });
  });
}

seedDemoHistory();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'create':
        return handleCreate(params);
      case 'end':
        return handleEnd(params);
      case 'rate':
        return handleRate(params);
      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[CallsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Create a new call session
 */
function handleCreate({
  agentId,
  agentName,
  userId,
  userWallet,
}: {
  agentId: string;
  agentName: string;
  userId: string;
  userWallet: string;
}): NextResponse {
  const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const call = {
    id,
    agentId,
    agentName,
    userId,
    userWallet,
    startTime: Date.now(),
    duration: 0,
    cost: 0,
    status: 'no-answer' as const, // Will be updated when ended
  };

  calls.set(id, call);

  console.log(`[CallsAPI] Call created: ${id}`);

  return NextResponse.json({
    success: true,
    data: {
      callId: id,
      startTime: call.startTime,
      message: 'Call session started. End call to finalize.',
    },
  });
}

/**
 * End a call and calculate final cost
 */
function handleEnd({
  callId,
  status = 'completed',
}: {
  callId: string;
  status?: 'completed' | 'cancelled' | 'no-answer';
}): NextResponse {
  const call = calls.get(callId);
  
  if (!call) {
    return NextResponse.json(
      { error: 'Call not found', code: 'CALL_NOT_FOUND' },
      { status: 404 }
    );
  }

  call.endTime = Date.now();
  call.status = status;
  call.duration = Math.floor((call.endTime - call.startTime) / 1000);

  // Calculate cost (first 60 seconds free)
  const billableSeconds = Math.max(0, call.duration - 60);
  const ratePerSecond = 0.01 / 60; // $0.01/min = $0.000166.../sec
  call.cost = Number((billableSeconds * ratePerSecond).toFixed(4));

  console.log(`[CallsAPI] Call ended: ${id}, duration: ${call.duration}s, cost: $${call.cost}`);

  return NextResponse.json({
    success: true,
    data: {
      callId: call.id,
      agentId: call.agentId,
      agentName: call.agentName,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      cost: call.cost,
      status: call.status,
    },
  });
}

/**
 * Rate a completed call
 */
function handleRate({
  callId,
  rating,
  feedback,
}: {
  callId: string;
  rating: number;
  feedback?: string;
}): NextResponse {
  const call = calls.get(callId);
  
  if (!call) {
    return NextResponse.json(
      { error: 'Call not found', code: 'CALL_NOT_FOUND' },
      { status: 404 }
    );
  }

  if (call.status !== 'completed') {
    return NextResponse.json(
      { error: 'Cannot rate incomplete call', code: 'INVALID_STATE' },
      { status: 400 }
    );
  }

  call.rating = Math.min(5, Math.max(1, rating));
  call.feedback = feedback;

  console.log(`[CallsAPI] Call rated: ${callId}, rating: ${call.rating}`);

  return NextResponse.json({
    success: true,
    data: {
      callId: call.id,
      rating: call.rating,
      message: 'Thank you for your feedback!',
    },
  });
}

/**
 * GET call history
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const agentId = searchParams.get('agentId');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!userId && !agentId) {
    return NextResponse.json(
      { error: 'userId or agentId required', code: 'MISSING_PARAM' },
      { status: 400 }
    );
  }

  let results = Array.from(calls.values());

  // Apply filters
  if (userId) {
    results = results.filter(c => c.userId === userId);
  }

  if (agentId) {
    results = results.filter(c => c.agentId === agentId);
  }

  if (status) {
    results = results.filter(c => c.status === status);
  }

  // Sort by start time (newest first)
  results.sort((a, b) => b.startTime - a.startTime);

  // Paginate
  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);

  // Calculate stats
  const stats = {
    totalCalls: results.length,
    totalDuration: results.reduce((sum, c) => sum + c.duration, 0),
    totalCost: results.reduce((sum, c) => sum + c.cost, 0),
    averageRating: results.filter(c => c.rating).length > 0
      ? results.filter(c => c.rating).reduce((sum, c) => sum + c.rating!, 0) / 
        results.filter(c => c.rating).length
      : null,
  };

  return NextResponse.json({
    success: true,
    data: {
      calls: paginatedResults.map(c => ({
        id: c.id,
        agentId: c.agentId,
        agentName: c.agentName,
        startTime: c.startTime,
        endTime: c.endTime,
        duration: c.duration,
        cost: c.cost,
        status: c.status,
        rating: c.rating,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats,
    },
  });
}
