// WebRTC Signaling Endpoint
// Handles SDP offer/answer exchange and ICE candidate relay

export const dynamic = 'force-dynamic';

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  callId: string;
  agentId?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

// In-memory session store for development (use Redis in production)
const sessions = new Map<string, {
  agentId: string;
  offer?: string;
  answer?: string;
  iceCandidates: RTCIceCandidateInit[];
}>();

/**
 * POST /api/webrtc/signal
 * Handles WebRTC signaling: offer, answer, ice-candidate
 */
export async function POST(request: Request) {
  try {
    const body: SignalMessage = await request.json();
    const { type, callId, agentId, sdp, candidate } = body;

    if (!callId || !type) {
      return Response.json(
        { error: 'Missing required fields: callId, type' },
        { status: 400 }
      );
    }

    console.log(`[Signal] ${type} for call ${callId}`);

    switch (type) {
      case 'offer': {
        // Store offer and create session
        if (!agentId || !sdp) {
          return Response.json(
            { error: 'Missing agentId or sdp for offer' },
            { status: 400 }
          );
        }

        sessions.set(callId, {
          agentId,
          offer: sdp,
          iceCandidates: [],
        });

        // In production: forward offer to AI agent backend (ElevenLabs, OpenClaw, etc.)
        // For now, simulate acceptance with a mock answer
        // TODO: Integrate with real voice agent infrastructure
        
        const mockAnswer = `v=0
o=- ${Date.now()} 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
m=audio 9 UDP/TLS/RTP/SAVPF 111
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:mock
a=ice-pwd:mockpassword123456
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00
a=setup:active
a=mid:0
a=recvonly
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1`;

        // Update session with answer
        const session = sessions.get(callId);
        if (session) {
          session.answer = mockAnswer;
        }

        return Response.json({
          type: 'answer',
          callId,
          sdp: mockAnswer,
          message: 'Mock answer - integrate with real voice agent backend',
        });
      }

      case 'ice-candidate': {
        // Store ICE candidate for relay
        const session = sessions.get(callId);
        if (!session) {
          return Response.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }

        if (candidate) {
          session.iceCandidates.push(candidate);
        }

        return Response.json({ 
          received: true,
          candidateCount: session.iceCandidates.length,
        });
      }

      case 'answer': {
        // Handle answer from callee (for future bidirectional calls)
        const session = sessions.get(callId);
        if (!session) {
          return Response.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }

        if (sdp) {
          session.answer = sdp;
        }

        return Response.json({ received: true });
      }

      default:
        return Response.json(
          { error: `Unknown signal type: ${type}` },
          { status: 400 }
        );
    }
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
 * Poll for pending signals (ICE candidates, answers)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get('callId');

  if (!callId) {
    return Response.json(
      { error: 'Missing callId parameter' },
      { status: 400 }
    );
  }

  const session = sessions.get(callId);
  if (!session) {
    return Response.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  // Return pending ICE candidates
  const candidates = session.iceCandidates.splice(0);

  return Response.json({
    callId,
    answer: session.answer,
    candidates,
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
    sessions.delete(callId);
    console.log(`[Signal] Session ${callId} deleted`);
  }

  return Response.json({ deleted: true });
}
