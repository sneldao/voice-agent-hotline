import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * Free call (trial) tracking — server-side.
 *
 * One trial call per IP fingerprint. The agent is NOT paid for trial calls.
 * The platform absorbs the ElevenLabs cost as marketing.
 *
 * POST /api/free-call/check  → { available: boolean, usedAt?: string }
 * POST /api/free-call/claim  → { claimed: boolean }  (marks as used)
 */

// 2-minute cap for trial calls (not exported — Next.js route constraint)
const TRIAL_CALL_CAP_SECONDS = 120;

function getFingerprint(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  // Simple hash — not cryptographic, just for uniqueness
  let hash = 0;
  const str = `${ip}:${ua}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'check';
    const fp = getFingerprint(req);
    const key = `free-call:${fp}`;

    if (action === 'check') {
      const record = await redis.hgetall(key);
      if (record && record.used === 'true') {
        return NextResponse.json({
          available: false,
          usedAt: record.usedAt || null,
          capSeconds: TRIAL_CALL_CAP_SECONDS,
        });
      }
      return NextResponse.json({
        available: true,
        capSeconds: TRIAL_CALL_CAP_SECONDS,
      });
    }

    if (action === 'claim') {
      const agentId = body.agentId || 'unknown';
      const record = await redis.hgetall(key);
      if (record && record.used === 'true') {
        return NextResponse.json({
          claimed: false,
          error: 'Trial already used',
          usedAt: record.usedAt,
        }, { status: 409 });
      }
      await redis.hset(key, {
        used: 'true',
        usedAt: new Date().toISOString(),
        agentId,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
      });
      // Keep the record for 30 days so users can't just clear localStorage
      await redis.expire(key, 60 * 60 * 24 * 30);
      return NextResponse.json({ claimed: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Free Call API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
