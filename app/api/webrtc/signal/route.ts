// WebRTC Signaling Endpoint
// Bridges frontend to ElevenLabs Conversational AI

export const dynamic = 'force-dynamic';

import { AGENT_REGISTRY } from '@/lib/agent-registry';
import { redis } from '@/lib/redis';
import { verifyVoiceCallAuth } from '@/lib/api-auth';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface SignalMessage {
  type: 'offer' | 'get-token' | 'ice-candidate';
  callId: string;
  agentId?: string;
  userId?: string;
}

interface Session {
  agentId: string;
  elevenLabsAgentId: string;
  startTime: number;
}

// ── Rate limiting ──────────────────────────────────────────────────────────
async function checkRateLimit(ip: string, key: string, max: number, windowSec: number): Promise<boolean> {
  const rlKey = `ratelimit:${key}:${ip}`;
  const count = await redis.incr(rlKey);
  if (count === 1) await redis.expire(rlKey, windowSec);
  return count <= max;
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

// ── Redis-backed session store ─────────────────────────────────────────────
async function getSession(callId: string): Promise<Session | null> {
  const data = await redis.hgetall(`signal_session:${callId}`);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    agentId: data.agentId as string,
    elevenLabsAgentId: data.elevenLabsAgentId as string,
    startTime: Number(data.startTime),
  };
}

async function setSession(callId: string, session: Session): Promise<void> {
  await redis.hset(`signal_session:${callId}`, {
    agentId: session.agentId,
    elevenLabsAgentId: session.elevenLabsAgentId,
    startTime: session.startTime.toString(),
  });
  // Auto-expire after 1 hour to avoid orphaned keys
  await redis.expire(`signal_session:${callId}`, 3600);
}

async function deleteSession(callId: string): Promise<void> {
  await redis.del(`signal_session:${callId}`);
}

/**
 * Get ElevenLabs conversation token for WebRTC
 * This is the proper integration - client uses @elevenlabs/client SDK
 */
async function getConversationToken(elevenLabsAgentId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(
    `${ELEVENLABS_API_URL}/convai/conversation/token?agent_id=${elevenLabsAgentId}`,
    {
      headers: {
        'xi-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get conversation token: ${error}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Get signed URL for WebSocket connection (alternative to WebRTC token)
 */
async function getSignedUrl(elevenLabsAgentId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(
    `${ELEVENLABS_API_URL}/convai/conversation/get-signed-url?agent_id=${elevenLabsAgentId}`,
    {
      headers: {
        'xi-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get signed URL: ${error}`);
  }

  const data = await response.json();
  return data.signed_url;
}

/**
 * POST /api/webrtc/signal
 * Main entry point - returns ElevenLabs conversation token for voice calls
 */
export async function POST(request: Request) {
  try {
    // Rate limit: 10 token requests per IP per minute
    const ip = getClientIp(request);
    if (!(await checkRateLimit(ip, 'signal_post', 10, 60))) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body: SignalMessage = await request.json();
    const { type, callId, agentId, userId } = body;

    // Verify wallet signature when auth headers are present
    if (request.headers.get('x-wallet-address') && callId && agentId) {
      const auth = await verifyVoiceCallAuth(request.headers, callId, agentId);
      if (!auth.authenticated) {
        return Response.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
      }
    }

    console.log(`[Signal] ${type} for call ${callId}, agent ${agentId}`);

    // Handle token request (primary flow for ElevenLabs integration)
    if (type === 'get-token' || type === 'offer') {
      if (!agentId) {
        return Response.json(
          { error: 'Missing agentId' },
          { status: 400 }
        );
      }

      // Look up agent: first in static registry, then fall back to Redis
      const registryEntry = AGENT_REGISTRY[agentId];
      let elevenLabsAgentId: string | null = null;
      let voiceId = '';
      let agentName = '';

      if (registryEntry) {
        elevenLabsAgentId = registryEntry.elevenLabsAgentId;
        voiceId = registryEntry.voiceId;
        agentName = registryEntry.name;
      } else {
        // Dynamic agent — look up in Redis
        const redisAgent = await redis.hgetall(`agent:${agentId}`);
        if (redisAgent && Object.keys(redisAgent).length > 0) {
          elevenLabsAgentId = (redisAgent.elevenlabs_agent_id as string) || null;
          voiceId = (redisAgent.voice_id as string) || '';
          agentName = (redisAgent.name as string) || '';
        }
      }

      if (!elevenLabsAgentId) {
        return Response.json({
          error: 'Agent not configured in ElevenLabs',
          hint: registryEntry
            ? 'Run `npx tsx scripts/seed-elevenlabs.ts` to seed agents'
            : 'Agent has no ElevenLabs ID set',
          agentId,
        }, { status: registryEntry ? 503 : 404 });
      }

      // Create session
      await setSession(callId, {
        agentId,
        elevenLabsAgentId,
        startTime: Date.now(),
      });

      try {
        // Fetch conversation token and signed URL in parallel
        const [token, signedUrl] = await Promise.all([
          getConversationToken(elevenLabsAgentId),
          getSignedUrl(elevenLabsAgentId),
        ]);

        // Attach our callId as a dynamic variable so the ElevenLabs webhook
        // can echo it back on transcript events — this is the bridge that
        // lets the frontend's SSE subscription (/api/transcripts?callId=…)
        // receive live transcripts keyed by OUR call id, not ElevenLabs'
        // conversation id. Unknown params are ignored by ElevenLabs.
        const bridgedSignedUrl = `${signedUrl}${
          signedUrl.includes('?') ? '&' : '?'
        }dynamic_vars=${encodeURIComponent(JSON.stringify({ claflin_call_id: callId }))}`;

        return Response.json({
          type: 'token',
          callId,
          token,
          signedUrl: bridgedSignedUrl,
          elevenLabsAgentId,
          connectionType: 'webrtc',
          voiceId,
          agentName,
        });
      } catch (error) {
        console.error('[Signal] Failed to get ElevenLabs token:', error);
        return Response.json({
          error: 'Failed to initialize voice session',
          details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // ICE candidate handling (for future direct WebRTC if needed)
    if (type === 'ice-candidate') {
      const session = await getSession(callId);
      if (!session) {
        return Response.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      return Response.json({ received: true });
    }

    return Response.json(
      { error: `Unknown signal type: ${type}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Signal] Error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webrtc/signal?callId=xxx
 * Get session status
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get('callId');
  const checkAgentId = url.searchParams.get('agentId');

  // Lightweight availability check — no token minting
  if (checkAgentId) {
    // Rate limit: 30 availability checks per IP per minute
    const ip = getClientIp(request);
    if (!(await checkRateLimit(ip, 'signal_check', 30, 60))) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const registryEntry = AGENT_REGISTRY[checkAgentId];
    if (registryEntry?.elevenLabsAgentId) {
      return Response.json({ available: true });
    }
    const redisAgent = await redis.hgetall(`agent:${checkAgentId}`);
    if (redisAgent && redisAgent.elevenlabs_agent_id) {
      return Response.json({ available: true });
    }
    return Response.json({ error: 'Agent not configured' }, { status: 404 });
  }

  if (!callId) {
    // Health check - return registry status
    const registryStatus = Object.values(AGENT_REGISTRY).map(e => ({
      key: e.key,
      name: e.name,
      elevenLabsConfigured: !!e.elevenLabsAgentId,
    }));
    
    return Response.json({
      status: 'ok',
      agents: registryStatus,
    });
  }

  const session = await getSession(callId);
  if (!session) {
    return Response.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return Response.json({
    callId,
    agentId: session.agentId,
    duration: Math.floor((Date.now() - session.startTime) / 1000),
  });
}

/**
 * DELETE /api/webrtc/signal?callId=xxx
 * Clean up session
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get('callId');

  if (callId) {
    const session = await getSession(callId);
    if (session) {
      await deleteSession(callId);
      console.log(`[Signal] Session ${callId} ended (agent: ${session.agentId})`);
    }
  }

  return Response.json({ deleted: true });
}
