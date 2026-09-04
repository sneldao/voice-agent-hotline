import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWalletAuth, requireAdminAuth } from '@/lib/api-auth';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET /api/agents/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await redis.hgetall(`agent:${id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Accept either wallet-based admin auth (browser) or API key auth (SDK/CLI)
    const walletAuth = await requireAdminWalletAuth(req);
    if (walletAuth) {
      const apiKeyAuth = requireAdminAuth(req);
      if (apiKeyAuth) return walletAuth;
    }

    const agent = await redis.hgetall(`agent:${id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, reason, ...fields } = body;

    if (action === 'approve') {
      // Approval only sets the listing status — ERC-8004 identity mint is
      // performed client-side by the agent developer from their dashboard.
      await redis.hset(`agent:${id}`, {
        status: 'active',
        active: 'true',
        approved_at: new Date().toISOString(),
      });
      console.log('[Agents API] Approved agent:', id);

      // Notify via webhook if configured
      await sendNotification('approved', agent, id);

      return NextResponse.json({ message: 'Broker approved', id });
    }

    if (action === 'reject') {
      await redis.hset(`agent:${id}`, {
        status: 'rejected',
        active: 'false',
        rejection_reason: reason || '',
        rejected_at: new Date().toISOString(),
      });
      console.log('[Agents API] Rejected agent:', id);

      // Notify via webhook if configured
      await sendNotification('rejected', agent, id, reason);

      return NextResponse.json({ message: 'Broker rejected', id });
    }

    if (Object.keys(fields).length > 0) {
      await redis.hset(`agent:${id}`, fields);
    }

    const updated = await redis.hgetall(`agent:${id}`);
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
        platform: 'claflin',
      }),
    });
  } catch (err: any) {
    console.warn('[Agents API] Notification webhook failed (non-fatal):', err.message);
  }
}

// DELETE /api/agents/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Accept either wallet-based admin auth (browser) or API key auth (SDK/CLI)
    const walletAuth = await requireAdminWalletAuth(req);
    if (walletAuth) {
      const apiKeyAuth = requireAdminAuth(req);
      if (apiKeyAuth) return walletAuth;
    }

    const agent = await redis.hgetall(`agent:${id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    await redis.srem('agent_index', id);
    await redis.del(`agent:${id}`);
    return NextResponse.json({ message: 'Broker deleted', id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
