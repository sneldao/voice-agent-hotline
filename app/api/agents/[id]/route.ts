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
      // Approval only sets the listing status — ERC-8004 identity mint is
      // performed client-side by the agent developer from their dashboard.
      await redis.hset(`agent:${params.id}`, {
        status: 'active',
        active: 'true',
        approved_at: new Date().toISOString(),
      });
      console.log('[Agents API] Approved agent:', params.id);

      // Notify via webhook if configured
      await sendNotification('approved', agent, params.id);

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

      // Notify via webhook if configured
      await sendNotification('rejected', agent, params.id, reason);

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

// ── Notification helper ──────────────────────────────────────────────────────
async function sendNotification(
  event: 'approved' | 'rejected',
  agent: Record<string, unknown>,
  agentId: string,
  reason?: string
) {
  const webhookUrl = process.env.AGENT_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: `agent.${event}`,
        agentId,
        name: agent.name,
        category: agent.category,
        wallet_address: agent.wallet_address,
        reason: reason || null,
        timestamp: new Date().toISOString(),
        platform: 'voisss',
      }),
    });
  } catch (err: any) {
    console.warn('[Agents API] Notification webhook failed (non-fatal):', err.message);
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
