import { NextRequest } from 'next/server';

/**
 * SSE Endpoint for Live Transcript Streaming
 *
 * Uses Server-Sent Events to stream transcript updates in real-time.
 * Polls Redis for new transcript segments since the last index.
 *
 * Query params:
 *   - callId: The conversation ID (required)
 *   - index: Starting index for polling (optional, default: 0)
 *
 * Redis key format: `transcript:{conversation_id}`
 * Each entry is a JSON string: { text, speaker, timestamp, isFinal }
 */

// Redis key prefix
const TRANSCRIPT_KEY_PREFIX = 'transcript:';

/**
 * Parse callId from various formats:
 * - Direct: "abc123"
 * - Prefixed: "el_abc123" (from ElevenLabs)
 * - URL-encoded
 */
function parseCallId(callId: string | null): string | null {
  if (!callId) return null;
  // Remove common prefixes
  return callId.replace(/^(el_|widget_)/, '');
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const callId = parseCallId(req.nextUrl.searchParams.get('callId'));

  if (!callId) {
    return new Response('Missing required callId parameter', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let lastIndex = 0;
      let isClosed = false;
      const channel = `transcript:${callId}`;

      // Helper to send SSE message
      const send = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream may be closed
        }
      };

      // Send initial connection message
      send('connected', { callId, timestamp: Date.now() });

      // Poll for new transcripts
      // Note: In production, consider using Redis pub/sub with a dedicated
      // worker service for true real-time. This polling approach works
      // reliably in serverless environments.
      const pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const { getRedis } = await import('@/lib/redis');
          const redis = getRedis();
          const key = `${TRANSCRIPT_KEY_PREFIX}${callId}`;

          // Get transcript count
          const count = await redis.llen(key);

          if (count > lastIndex) {
            // Get new entries (from lastIndex to count-1)
            // LRANGE returns oldest first, so we get the range and reverse
            const startIdx = lastIndex;
            const endIdx = count - 1;
            const entries = await redis.lrange(key, startIdx, endIdx);

            for (const entry of entries) {
              try {
                const transcript = JSON.parse(entry);
                send('transcript', transcript);
              } catch {
                // Skip malformed entries
              }
            }

            lastIndex = count;
          }

          // Check for client disconnect via close event
          // The controller will be closed by the client
        } catch (err) {
          console.error('[Transcripts SSE] Poll error:', err);
          send('error', { message: 'Polling error' });
        }
      }, 1000); // Poll every 1 second

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(pollInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}