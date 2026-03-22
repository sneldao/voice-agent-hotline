import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET /api/agents/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await redis.hgetall(`agent:${params.id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/agents/[id] — approve, reject, or general field updates
// Approve:  { action: 'approve' }
// Reject:   { action: 'reject', reason?: string }
// Update:   { field: value, ... }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await redis.hgetall(`agent:${params.id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, reason, ...fields } = body;

    if (action === 'approve') {
      await redis.hset(`agent:${params.id}`, {
        status: 'active',
        active: 'true',
        approved_at: new Date().toISOString(),
      });
      console.log('[Agents API] Approved agent:', params.id);
      return NextResponse.json({ message: 'Agent approved', id: params.id });
    }

    if (action === 'reject') {
      await redis.hset(`agent:${params.id}`, {
        status: 'rejected',
        active: 'false',
        rejection_reason: reason || '',
        rejected_at: new Date().toISOString(),
      });
      console.log('[Agents API] Rejected agent:', params.id);
      return NextResponse.json({ message: 'Agent rejected', id: params.id });
    }

    if (Object.keys(fields).length > 0) {
      await redis.hset(`agent:${params.id}`, fields);
    }

    const updated = await redis.hgetall(`agent:${params.id}`);
    return NextResponse.json({ agent: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/agents/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await redis.del(`agent:${params.id}`);
    if (!deleted) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Agent deleted', id: params.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
