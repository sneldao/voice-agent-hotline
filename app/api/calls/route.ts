/**
 * Call History API - Edge Runtime
 */

export const runtime = 'edge';

const calls = new Map<string, {
  id: string;
  agentId: string;
  agentName: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  cost: number;
  status: string;
  rating?: number;
}>();

// Seed demo history
function seedDemoHistory() {
  if (calls.size > 0) return;

  const now = Date.now();
  const demoCalls = [
    { agentId: 'maria_garcia', agentName: 'Maria Garcia', duration: 125, cost: 0.01, rating: 5 },
    { agentId: 'alex_chen', agentName: 'Alex Chen', duration: 340, cost: 0.07, rating: 5 },
    { agentId: 'chef_mario', agentName: 'Chef Mario', duration: 45, cost: 0, rating: 4 },
  ];

  demoCalls.forEach((call, i) => {
    const id = `call_${now - (i * 3600000)}`;
    calls.set(id, {
      ...call,
      id,
      userId: 'user_demo',
      startTime: now - (i * 3600000),
      endTime: now - (i * 3600000) + call.duration * 1000,
      status: 'completed',
    });
  });
}

seedDemoHistory();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === 'create') {
      const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const call = {
        id,
        agentId: params.agentId,
        agentName: params.agentName,
        userId: params.userId,
        startTime: Date.now(),
        duration: 0,
        cost: 0,
        status: 'active',
      };
      calls.set(id, call);
      return Response.json({ success: true, data: { callId: id } });
    }

    if (action === 'end') {
      const call = calls.get(params.callId);
      if (!call) {
        return Response.json({ error: 'Call not found' }, { status: 404 });
      }

      call.endTime = Date.now();
      call.status = params.status || 'completed';
      call.duration = Math.floor((call.endTime! - call.startTime) / 1000);
      call.cost = Math.max(0, call.duration - 60) * 0.01 / 60;

      return Response.json({
        success: true,
        data: { callId: call.id, duration: call.duration, cost: call.cost },
      });
    }

    if (action === 'rate') {
      const call = calls.get(params.callId);
      if (call) {
        call.rating = Math.min(5, Math.max(1, params.rating));
      }
      return Response.json({ success: true, data: { rating: call?.rating } });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '20');

  let results = Array.from(calls.values());
  if (userId) results = results.filter(c => c.userId === userId);
  results.sort((a, b) => b.startTime - a.startTime);

  const stats = {
    totalCalls: results.length,
    totalDuration: results.reduce((sum, c) => sum + c.duration, 0),
    totalCost: results.reduce((sum, c) => sum + c.cost, 0),
  };

  return Response.json({
    success: true,
    data: {
      calls: results.slice(0, limit).map(c => ({
        id: c.id, agentId: c.agentId, agentName: c.agentName,
        duration: c.duration, cost: c.cost, rating: c.rating,
        date: new Date(c.startTime).toLocaleDateString(),
      })),
      stats,
    },
  });
}
