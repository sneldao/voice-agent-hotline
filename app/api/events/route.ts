import { NextRequest, NextResponse } from 'next/server';
import { storeEvents, queryEvents } from '@/lib/events-store';

/**
 * Event store API — backed by Upstash Redis.
 *
 * Events are persisted across server restarts.
 * Max stored events: 10,000 (oldest are trimmed).
 */

// POST /api/events — Receive a batch of client-side events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { events: batch } = body as { events: Array<{ event: string; data?: Record<string, unknown>; timestamp: number; url: string }> };

    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    await storeEvents(batch);
    return NextResponse.json({ ok: true, count: batch.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to store events';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// GET /api/events — Retrieve stored events (for dashboards/debugging)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 1000);
  const eventFilter = searchParams.get('event');

  try {
    const result = await queryEvents({ limit, eventFilter });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      total: 0,
      filter: eventFilter || null,
      summary: {},
      events: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to query events',
    }, { status: 500 });
  }
}
