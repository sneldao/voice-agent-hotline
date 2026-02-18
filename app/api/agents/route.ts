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

    // List all agents
    const agentKeys = await redis.keys('agent:*');
    const agents = await Promise.all(
      agentKeys.map(key => redis.hgetall(key))
    );

    return NextResponse.json({ agents });
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
    } = body;

    // Validation
    if (!name || !voice_id || !system_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: name, voice_id, system_prompt' },
        { status: 400 }
      );
    }

    // Generate agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create ElevenLabs conversational agent (if enabled)
    let elevenlabs_agent_id = null;
    if (conversational_enabled && process.env.ELEVENLABS_CONVERSATIONAL_ENABLED === 'true') {
      try {
        // Map skills to tools
        const tools: any[] = [];

        // Add Native Tools
        skills.forEach((skill: string) => {
          if (NATIVE_TOOLS[skill as keyof typeof NATIVE_TOOLS]) {
            tools.push(NATIVE_TOOLS[skill as keyof typeof NATIVE_TOOLS]);
          }
        });

        // Add Composio Tools (as descriptions for LLM to know it can call them)
        const composioTools = skills.flatMap((skill: string) =>
          composioService.getToolsForSkill(skill)
        );

        composioTools.forEach((slug: string) => {
          tools.push({
            name: slug.toLowerCase(),
            description: `Execute ${slug} action`,
            parameters: { type: 'object', properties: { query: { type: 'string' } } }
          });
        });

        const agentConfig = {
          name,
          system_prompt,
          voice_id,
          model: 'gpt-4',
          language: 'en',
          tools: tools,
          webhook_url: `${process.env.NEXT_PUBLIC_WEBHOOK_URL}/api/webhooks/elevenlabs`,
        };

        const result = await elevenLabsService.createAgent(agentConfig);
        elevenlabs_agent_id = result.agent_id;

        console.log('[Agents API] Created ElevenLabs agent with tools:', elevenlabs_agent_id, tools.map(t => t.name));
      } catch (error: any) {
        console.error('[Agents API] ElevenLabs creation failed:', error);
      }
    }

    // Store agent in Redis
    const agent = {
      id: agentId,
      name,
      description: description || '',
      voice_id,
      system_prompt,
      skills: JSON.stringify(skills),
      price_per_minute: price_per_minute || 0.1,
      elevenlabs_agent_id: elevenlabs_agent_id || '',
      wallet_address,
      erc8004_id,
      conversational_enabled: conversational_enabled.toString(),
      created_at: new Date().toISOString(),
      rating: '0',
      total_calls: '0',
      total_revenue: '0',
    };

    await redis.hset(`agent:${agentId}`, agent);

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

    if (deleted === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Agents API] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
