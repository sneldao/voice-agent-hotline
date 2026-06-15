import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { elevenLabsService } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';
/**
 * Call Management API
 * Enhanced with ElevenLabs Conversational AI support
 */

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');
    const callerAddress = searchParams.get('caller_address');

    if (sessionId) {
      const session = await redis.hgetall(`call:${sessionId}`);
      if (!session || Object.keys(session).length === 0) {
        return NextResponse.json({ error: 'Call not found' }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    // Filter by caller address
    if (callerAddress) {
      const callIds = await redis.smembers(`call_index:${callerAddress.toLowerCase()}`);
      if (callIds.length === 0) return NextResponse.json({ calls: [] });

      // Batch fetch with pipeline
      const pipeline = redis.pipeline();
      callIds.forEach(id => pipeline.hgetall(`call:${id}`));
      const results = await pipeline.exec();

      const calls = (results || [])
        .map((r: any) => {
          if (!r || Object.keys(r).length === 0) return null;
          if (r.transcripts && typeof r.transcripts === 'string') {
            try { r.transcripts = JSON.parse(r.transcripts); } catch { r.transcripts = []; }
          }
          return r;
        })
        .filter(Boolean)
        .slice(0, 50);

      return NextResponse.json({ calls });
    }

    // List recent calls (admin) — use index set instead of KEYS
    const callIds = await redis.smembers('call_index:all');
    if (callIds.length === 0) return NextResponse.json({ calls: [] });

    const pipeline = redis.pipeline();
    callIds.slice(0, 50).forEach(id => pipeline.hgetall(`call:${id}`));
    const results = await pipeline.exec();
    const calls = (results || [])
      .map((r: any) => r)
      .filter((c: any) => c && Object.keys(c).length > 0);

    return NextResponse.json(
      { calls },
      { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } }
    );
  } catch (error: any) {
    console.error('[Calls API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent_id, caller_address, transcripts, duration, cost, agent_name, agent_specialty, metadata = {} } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    }

    // Completed call save (from client on hang-up)
    if (transcripts) {
      const callId = body.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const callData: Record<string, string> = {
        id: callId,
        agent_id,
        agent_name: agent_name || '',
        agent_specialty: agent_specialty || '',
        caller_address: (caller_address || 'anonymous').toLowerCase(),
        status: 'completed',
        duration_seconds: String(duration || 0),
        total_cost: String(cost || 0),
        transcripts: JSON.stringify(transcripts),
        ended_at: new Date().toISOString(),
        started_at: new Date(Date.now() - (duration || 0) * 1000).toISOString(),
      };

      await redis.hset(`call:${callId}`, callData);

      // Maintain caller index for efficient per-user queries
      if (callData.caller_address !== 'anonymous') {
        await redis.sadd(`call_index:${callData.caller_address}`, callId);
      }
      await redis.sadd('call_index:all', callId);

      // Increment agent stats
      await redis.hincrby(`agent:${agent_id}`, 'total_calls', 1);

      return NextResponse.json({ call: callData }, { status: 201 });
    }

    // New session creation (existing flow)
    // Get agent details
    const agent = await redis.hgetall(`agent:${agent_id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start ElevenLabs conversation if enabled
    let conversation_id = null;
    let call_url = null;

    const elevenLabsAgentId = agent.elevenlabs_agent_id as string;
    if (elevenLabsAgentId && String(agent.conversational_enabled) === 'true') {
      try {
        const conversation = await elevenLabsService.startConversation({
          agent_id: elevenLabsAgentId,
          metadata: {
            session_id: sessionId,
            caller_address,
            ...metadata,
          },
        });

        conversation_id = conversation.conversation_id;
        call_url = conversation.call_url;

        console.log('[Calls API] Started ElevenLabs conversation:', conversation_id);
      } catch (error: any) {
        console.error('[Calls API] ElevenLabs conversation failed:', error);
        return NextResponse.json(
          { error: 'Failed to start conversation', details: error.message },
          { status: 500 }
        );
      }
    } else {
      // Fallback to legacy WebRTC flow
      call_url = `/call/${sessionId}`;
    }

    // Store call session
    const session = {
      id: sessionId,
      agent_id,
      caller_address: caller_address || 'anonymous',
      conversation_id: conversation_id || '',
      call_url,
      status: 'active',
      started_at: new Date().toISOString(),
      price_per_minute: agent.price_per_minute || '0.1',
      total_cost: '0',
      duration_seconds: '0',
    };

    await redis.hset(`call:${sessionId}`, session);

    // Increment agent call count
    await redis.hincrby(`agent:${agent_id}`, 'total_calls', 1);

    return NextResponse.json({ session, call_url }, { status: 201 });
  } catch (error: any) {
    console.error('[Calls API] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, status, duration_seconds } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const session = await redis.hgetall(`call:${session_id}`);
    if (!session || Object.keys(session).length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updates: any = {};

    if (status) {
      updates.status = status;
      if (status === 'ended') {
        updates.ended_at = new Date().toISOString();

        // End ElevenLabs conversation if exists
        const conversationId = session.conversation_id as string;
        if (conversationId) {
          try {
            await elevenLabsService.endConversation(conversationId);
          } catch (error: any) {
            console.error('[Calls API] ElevenLabs end failed:', error);
          }
        }
      }
    }

    if (duration_seconds !== undefined) {
      updates.duration_seconds = duration_seconds.toString();

      // Calculate cost
      const pricePerMinute = parseFloat((session.price_per_minute as string) || '0.1');
      const totalCost = (duration_seconds / 60) * pricePerMinute;
      updates.total_cost = (totalCost || 0).toFixed(4);

      // Update agent revenue
      await redis.hincrbyfloat(
        `agent:${session.agent_id}`,
        'total_revenue',
        totalCost
      );
    }

    await redis.hset(`call:${session_id}`, updates);

    const updatedSession = await redis.hgetall(`call:${session_id}`);
    return NextResponse.json({ session: updatedSession });
  } catch (error: any) {
    console.error('[Calls API] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
