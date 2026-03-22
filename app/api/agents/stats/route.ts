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
    const agentKeys = await redis.keys('agent:*');
    const agents = await Promise.all(agentKeys.map(key => redis.hgetall(key)));

    const activeAgents = agents.filter(a => a && (a.active === 'true' || a.active === true || String(a.active).toLowerCase() === 'true'));

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
