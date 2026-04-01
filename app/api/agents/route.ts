import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { elevenLabsService } from '@/lib/elevenlabs';
import { composioService } from '@/lib/composio';

export const dynamic = 'force-dynamic';
/**
 * Agent Management API
 * Enhanced with ElevenLabs Conversational AI support
 */

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const agentId = searchParams.get('id');

    if (agentId) {
      // Get single agent
      const agent = await redis.hgetall(`agent:${agentId}`);
      if (!agent || Object.keys(agent).length === 0) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      return NextResponse.json({ agent });
    }

    // Pagination and filtering params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const category = (searchParams.get('category') || '').toLowerCase().trim();

    // List all agents via Set index (non-blocking unlike KEYS)
    const agentIds = await redis.smembers('agent_index');
    if (agentIds.length === 0) {
      return NextResponse.json({ agents: [], total: 0, page: 1, hasMore: false });
    }

    // Batch fetch with pipeline instead of N individual roundtrips
    const pipeline = redis.pipeline();
    agentIds.forEach(id => pipeline.hgetall(`agent:${id}`));
    const results = await pipeline.exec();
    let agents = (results || [])
      .map((r: any) => r[1])
      .filter((a: any) => a && Object.keys(a).length > 0);

    // Server-side filtering
    if (search) {
      agents = agents.filter((a: any) => {
        const name = (a.name || '').toLowerCase();
        const specialty = (a.specialty || '').toLowerCase();
        return name.includes(search) || specialty.includes(search);
      });
    }

    if (category && category !== 'all') {
      agents = agents.filter((a: any) => (a.category || '').toLowerCase() === category);
    }

    const total = agents.length;
    const start = (page - 1) * limit;
    const paginatedAgents = agents.slice(start, start + limit);
    const hasMore = start + limit < total;

    return NextResponse.json(
      { agents: paginatedAgents, total, page, hasMore },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' } }
    );
  } catch (error: any) {
    console.error('[Agents API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const NATIVE_TOOLS = {
  book: {
    name: 'book_appointment',
    description: 'Book an appointment, reservation, or service',
    parameters: {
      type: 'object',
      properties: {
        businessName: { type: 'string', description: 'Name of the business or provider' },
        serviceType: { type: 'string', enum: ['restaurant', 'appointment', 'travel', 'event', 'other'] },
        dateTime: { type: 'string', description: 'ISO 8601 date time string' },
        partySize: { type: 'integer' },
        notes: { type: 'string' }
      },
      required: ['businessName', 'serviceType', 'dateTime']
    }
  },
  order: {
    name: 'create_order',
    description: 'Place an order for food, goods, or services',
    parameters: {
      type: 'object',
      properties: {
        vendor: { type: 'string', description: 'Name of the vendor or restaurant' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'integer' },
              price: { type: 'number', description: 'Price in cents' }
            }
          }
        },
        deliveryAddress: { type: 'string' }
      },
      required: ['vendor', 'items']
    }
  },
  schedule: {
    name: 'set_reminder',
    description: 'Schedule a reminder or notification',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        dateTime: { type: 'string', description: 'ISO 8601 date time string' },
        description: { type: 'string' }
      },
      required: ['title', 'dateTime']
    }
  },
  research: {
    name: 'search_web',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      voice_id,
      system_prompt,
      skills = [],
      price_per_minute,
      conversational_enabled = true,
      wallet_address = '',
      erc8004_id = '',
      // Self-registration fields
      register = false,
      elevenlabs_agent_id: submitted_elevenlabs_id = '',
      specialty = '',
      category = '',
      contact_email = '',
    } = body;

    // Validation
    if (!name || !system_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: name, system_prompt' },
        { status: 400 }
      );
    }
    if (!register && !voice_id) {
      return NextResponse.json(
        { error: 'Missing required field: voice_id' },
        { status: 400 }
      );
    }
    if (register && !submitted_elevenlabs_id) {
      return NextResponse.json(
        { error: 'Missing required field: elevenlabs_agent_id for self-registration' },
        { status: 400 }
      );
    }

    // Rate-limit self-registrations: max 3 per IP per hour
    if (register) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rateLimitKey = `ratelimit:register:${ip}`;
      const count = await redis.incr(rateLimitKey);
      if (count === 1) await redis.expire(rateLimitKey, 3600);
      if (count > 3) {
        return NextResponse.json(
          { error: 'Too many registration attempts. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Generate agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Self-registration: store as pending, skip ElevenLabs creation
    if (register) {
      const agent = {
        id: agentId,
        name,
        description: description || '',
        specialty: specialty || category || '',
        category: category || '',
        voice_id: voice_id || '',
        system_prompt,
        skills: JSON.stringify(skills),
        price_per_minute: price_per_minute || 0.1,
        elevenlabs_agent_id: submitted_elevenlabs_id,
        wallet_address,
        contact_email,
        erc8004_id: '',
        conversational_enabled: 'true',
        status: 'pending',
        active: 'false',
        created_at: new Date().toISOString(),
        rating: '0',
        total_calls: '0',
        total_revenue: '0',
      };
      await redis.hset(`agent:${agentId}`, agent);
      await redis.sadd('agent_index', agentId);
      console.log('[Agents API] Self-registration submitted:', agentId, name);
      return NextResponse.json({ agent, message: 'Registration submitted for review' }, { status: 201 });
    }

    // Create ElevenLabs conversational agent (if enabled)
    let elevenlabs_agent_id = null;
    if (conversational_enabled && process.env.ELEVENLABS_CONVERSATIONAL_ENABLED === 'true') {
      try {
        console.log('[Agents API] Resolving workspace tools...');
        const workspaceTools = await elevenLabsService.listTools();

        const toolMap: Record<string, string> = {
          'research': 'search_web',
          'book': 'book_appointment',
          'order': 'create_order',
          'schedule': 'set_reminder'
        };
        const toolIds: string[] = [];
        skills.forEach((skill: string) => {
          const toolName = toolMap[skill] || skill;
          const tool = workspaceTools.find((t: any) => t.name === toolName);
          if (tool) toolIds.push(tool.tool_id);
        });

        const result = await elevenLabsService.createAgent({
          name, system_prompt, voice_id, model: 'gpt-4', language: 'en', tool_ids: toolIds,
        });
        elevenlabs_agent_id = result.agent_id;
        console.log('[Agents API] Created ElevenLabs agent:', elevenlabs_agent_id);
      } catch (error: any) {
        console.error('[Agents API] ElevenLabs creation failed:', error);
      }
    }

    // Store agent in Redis
    const agent = {
      id: agentId,
      name,
      description: description || '',
      specialty: specialty || '',
      voice_id,
      system_prompt,
      skills: JSON.stringify(skills),
      price_per_minute: price_per_minute || 0.1,
      elevenlabs_agent_id: elevenlabs_agent_id || '',
      wallet_address,
      erc8004_id,
      conversational_enabled: conversational_enabled.toString(),
      status: 'active',
      active: 'true',
      created_at: new Date().toISOString(),
      rating: '0',
      total_calls: '0',
      total_revenue: '0',
    };

    await redis.hset(`agent:${agentId}`, agent);
    await redis.sadd('agent_index', agentId);

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error: any) {
    console.error('[Agents API] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    const agent = await redis.hgetall(`agent:${id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Update ElevenLabs agent if needed
    const elevenLabsAgentId = agent.elevenlabs_agent_id as string;
    if (elevenLabsAgentId && (updates.system_prompt || updates.voice_id)) {
      try {
        await elevenLabsService.updateAgent(elevenLabsAgentId, {
          system_prompt: updates.system_prompt,
          voice_id: updates.voice_id,
        });
      } catch (error: any) {
        console.error('[Agents API] ElevenLabs update failed:', error);
      }
    }

    // Serialize arrays/objects
    if (updates.skills && Array.isArray(updates.skills)) {
      updates.skills = JSON.stringify(updates.skills);
    }

    await redis.hset(`agent:${id}`, updates);

    const updatedAgent = await redis.hgetall(`agent:${id}`);
    return NextResponse.json({ agent: updatedAgent });
  } catch (error: any) {
    console.error('[Agents API] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    const deleted = await redis.del(`agent:${id}`);
    await redis.srem('agent_index', id);

    if (deleted === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Agents API] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
