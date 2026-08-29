import { NextRequest, NextResponse } from 'next/server';
import type { TraceStep } from '@/components/AgentTrace';

/**
 * GET /api/calls/[id]/trace
 *
 * Returns the tool-execution trace for a call. Entries are stored by the
 * ElevenLabs webhook under `trace:el_{conversationId}` (or `trace:{callId}`
 * for locally-known ids) as a JSON list, newest-first.
 *
 * Fails soft: no key, malformed entries, or a Redis outage all produce an
 * empty `steps` array — never an error that blocks the call summary.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();

    const keys = id.startsWith('el_') ? [`trace:${id}`] : [`trace:${id}`, `trace:el_${id}`];

    let raw: string[] = [];
    for (const key of keys) {
      const list = await redis.lrange(key, 0, 49);
      if (list && list.length > 0) {
        raw = list;
        break;
      }
    }

    // lpush stores newest-first; reverse for chronological order.
    const steps: TraceStep[] = raw
      .slice()
      .reverse()
      .map((entry) => {
        try {
          const parsed = JSON.parse(entry);
          return {
            id: parsed.id ?? entry,
            label: parsed.label ?? parsed.tool_name ?? 'Tool call',
            detail: parsed.detail,
            mono: parsed.mono,
            icon: parsed.icon ?? 'check',
            status: parsed.status ?? 'done',
          } as TraceStep;
        } catch {
          return null as unknown as TraceStep;
        }
      })
      .filter((step) => step !== null);

    return NextResponse.json({ steps });
  } catch (err) {
    console.warn('[CallTrace] Fetch failed (non-fatal):', err);
    return NextResponse.json({ steps: [] });
  }
}