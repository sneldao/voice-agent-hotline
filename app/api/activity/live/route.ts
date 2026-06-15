import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * Live activity endpoint — honest "proof of life" data for the marketplace ticker.
 *
 * Returns:
 *   - active: number of calls currently with status='active'
 *   - lastHour: number of calls that started in the last 60 minutes
 *   - activeAgentIds: array of agent ids that currently have an active call
 */
export async function GET() {
  try {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const callIds = await redis.smembers('call_index:all');

    if (!callIds || callIds.length === 0) {
      return NextResponse.json({ active: 0, lastHour: 0, activeAgentIds: [] });
    }

    // Pipeline fetch to avoid N+1 round-trips
    const pipeline = redis.pipeline();
    for (const id of callIds) {
      pipeline.hgetall(`call:${id}`);
    }
    const results = await pipeline.exec();

    let active = 0;
    let lastHour = 0;
    const activeAgentIds = new Set<string>();
    const seen = new Set<string>();

    for (const r of results || []) {
      const call = r as unknown as Record<string, string> | null;
      if (!call || !call.id) continue;
      // Dedup — pipeline can return the same call twice if the index has duplicates
      if (seen.has(call.id)) continue;
      seen.add(call.id);

      const startedAt = call.started_at ? new Date(call.started_at).getTime() : 0;

      if (call.status === 'active') {
        active++;
        if (call.agent_id) activeAgentIds.add(call.agent_id);
      }
      if (startedAt >= oneHourAgo) {
        lastHour++;
      }
    }

    return NextResponse.json({
      active,
      lastHour,
      activeAgentIds: Array.from(activeAgentIds),
    });
  } catch (err: any) {
    console.error('[activity/live] error:', err);
    return NextResponse.json(
      { active: 0, lastHour: 0, activeAgentIds: [], error: err.message },
      { status: 200 } // fail-soft: ticker just hides
    );
  }
}
