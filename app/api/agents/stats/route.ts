import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * Agent Stats API
 * Returns aggregate and per-agent statistics for OpenClaw and social integrations.
 *
 * GET /api/agents/stats
 */
export async function GET() {
  try {
    const agentIds = await redis.smembers('agent_index');
    if (agentIds.length === 0) {
      return NextResponse.json({
        summary: { totalAgents: 0, totalCalls: 0, avgRating: 0, topAgent: null, generatedAt: new Date().toISOString() },
        agents: [],
      });
    }

    const pipeline = redis.pipeline();
    agentIds.forEach(id => pipeline.hgetall(`agent:${id}`));
    const results = await pipeline.exec();
    const agents = (results || [])
      .map((r: any) => r[1])
      .filter((a: any) => a && Object.keys(a).length > 0);

    const activeAgents = agents.filter((a: any) => a && (a.active === 'true' || a.active === true || String(a.active).toLowerCase() === 'true'));

    const totalCalls = activeAgents.reduce((sum, a) => sum + (parseInt(String(a?.totalCalls ?? '0')) || 0), 0);
    const totalAgents = activeAgents.length;

    const avgRating =
      totalAgents > 0
        ? activeAgents.reduce((sum, a) => sum + (parseFloat(String(a?.rating ?? '0')) || 0), 0) / totalAgents
        : 0;

    const topAgent = activeAgents.reduce<{ name: string; calls: number; category: string; avatar: string } | null>(
      (best, a) => {
        const calls = parseInt(String(a?.totalCalls ?? '0')) || 0;
        if (!best || calls > best.calls) {
          return { name: String(a?.name ?? ''), calls, category: String(a?.category ?? ''), avatar: String(a?.avatar ?? '') };
        }
        return best;
      },
      null
    );

    const perAgent = activeAgents.map(a => ({
      id: a?.id,
      name: a?.name,
      category: a?.category,
      avatar: a?.avatar,
      rating: parseFloat(String(a?.rating ?? '0')) || 0,
      totalCalls: parseInt(String(a?.totalCalls ?? '0')) || 0,
      rate: parseFloat(String(a?.rate ?? '0')) || 0,
      online: a?.online === 'true',
    }));

    return NextResponse.json({
      summary: {
        totalAgents,
        totalCalls,
        avgRating: parseFloat(avgRating.toFixed(2)),
        topAgent,
        generatedAt: new Date().toISOString(),
      },
      agents: perAgent,
    });
  } catch (error: any) {
    console.error('[Stats API] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
