// WebRTC Signaling Endpoint
// Bridges frontend to ElevenLabs Conversational AI

export const dynamic = 'force-dynamic';

import { AGENT_REGISTRY, findByElevenLabsId } from '@/lib/agent-registry';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface SignalMessage {
  type: 'offer' | 'get-token' | 'ice-candidate';
  callId: string;
  agentId?: string;
  userId?: string;
}

// In-memory session store for development (use Redis in production)
const sessions = new Map<string, {
  agentId: string;
  elevenLabsAgentId: string | null;
  conversationId?: string;
  startTime: number;
}>();

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
    const body: SignalMessage = await request.json();
    const { type, callId, agentId, userId } = body;

    console.log(`[Signal] ${type} for call ${callId}, agent ${agentId}`);

    // Handle token request (primary flow for ElevenLabs integration)
    if (type === 'get-token' || type === 'offer') {
      if (!agentId) {
        return Response.json(
          { error: 'Missing agentId' },
          { status: 400 }
        );
      }

      // Look up agent in registry to get ElevenLabs agent ID
      const registryEntry = AGENT_REGISTRY[agentId];
      
      if (!registryEntry) {
        return Response.json(
          { error: `Agent ${agentId} not found in registry` },
          { status: 404 }
        );
      }

      const elevenLabsAgentId = registryEntry.elevenLabsAgentId;

      if (!elevenLabsAgentId) {
        // Agent not seeded in ElevenLabs yet
        return Response.json({
          error: 'Agent not configured in ElevenLabs',
          hint: 'Run `npx tsx scripts/seed-elevenlabs.ts` to seed agents',
          agentId,
        }, { status: 503 });
      }

      // Create session
      sessions.set(callId, {
        agentId,
        elevenLabsAgentId,
        startTime: Date.now(),
      });

      try {
        // Get conversation token for WebRTC
        const token = await getConversationToken(elevenLabsAgentId);

        // Also get signed URL as fallback
        const signedUrl = await getSignedUrl(elevenLabsAgentId);

        return Response.json({
          type: 'token',
          callId,
          token,
          signedUrl,
          elevenLabsAgentId,
          connectionType: 'webrtc', // Client can use 'websocket' with signedUrl
          voiceId: registryEntry.voiceId,
          agentName: registryEntry.name,
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
      const session = sessions.get(callId);
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

  const session = sessions.get(callId);
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

  if (callId && sessions.has(callId)) {
    const session = sessions.get(callId);
    sessions.delete(callId);
    console.log(`[Signal] Session ${callId} ended (agent: ${session?.agentId})`);
  }

  return Response.json({ deleted: true });
}
