// ERC-8004 Agent Registry - Demo

import { validateRequest, AgentRegistrationSchema, createErrorResponse, createSuccessResponse } from '@/lib/validation';
import { checkRateLimit, apiLimiter, createRateLimitHeaders } from '@/lib/rate-limit';
import { sanitizeInput, sanitizeObject, getClientIP, requireJSON, validateBodySize, withSecurityHeaders, handleCORS, sanitizeURL } from '@/lib/security';

// Demo agents storage (in-memory for demo)
const agents = new Map<string, {
  id: string;
  name: string;
  bio: string;
  specialty: string[];
  ratePerMinute: number;
  voiceId: string;
  rating: number;
  totalRatings: number;
  totalCalls: number;
  owner: string;
  verified: boolean;
  createdAt: number;
}>();

// Seed demo agents
function seedDemoAgents() {
  if (agents.size > 0) return;

  const demoAgents = [
    { id: 'maria_garcia', name: 'Maria Garcia', specialty: ['Spanish', 'Language', 'Conversation'], ratePerMinute: 0.01, voiceId: 'Rachel', bio: 'Native Spanish tutor', verified: true },
    { id: 'alex_chen', name: 'Alex Chen', specialty: ['JavaScript', 'Python', 'Debugging'], ratePerMinute: 0.03, voiceId: 'Josh', bio: 'Full-stack developer', verified: true },
    { id: 'chef_mario', name: 'Chef Mario', specialty: ['Italian', 'Recipes'], ratePerMinute: 0.01, voiceId: 'Antoni', bio: 'Italian cuisine expert', verified: true },
    { id: 'sofia_travel', name: 'Sofia Williams', specialty: ['Travel', 'Culture'], ratePerMinute: 0.02, voiceId: 'Bella', bio: 'Travel expert', verified: false },
  ];

  demoAgents.forEach(a => {
    agents.set(a.id, {
      ...a,
      rating: 4.5 + Math.random() * 0.5,
      totalRatings: Math.floor(Math.random() * 500) + 100,
      totalCalls: Math.floor(Math.random() * 2000) + 500,
      owner: '0xdemo',
      createdAt: Date.now(),
    });
  });
}

seedDemoAgents();

export async function OPTIONS(request: Request) {
  return handleCORS(request) || new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  // Security checks
  const corsResponse = handleCORS(request);
  if (corsResponse) return corsResponse;

  const sizeCheck = await validateBodySize(request);
  if (sizeCheck) return withSecurityHeaders(sizeCheck);

  const contentTypeCheck = requireJSON(request);
  if (contentTypeCheck) return withSecurityHeaders(contentTypeCheck);

  // Rate limiting check
  const clientIp = getClientIP(request);
  const { limited, headers: rateLimitHeaders } = checkRateLimit(apiLimiter, clientIp);
  
  if (limited) {
    return withSecurityHeaders(new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...rateLimitHeaders, 'Content-Type': 'application/json' },
    }));
  }

  try {
    const body = await request.json();
    
    // Sanitize input
    const sanitizedBody = sanitizeObject(body, {
      maxStringLength: 500,
      allowedFields: ['action', 'name', 'bio', 'specialty', 'ratePerMinute', 'rate', 'voiceId', 'agentId', 'rating', 'owner'],
    });

    const { action, ...params } = sanitizedBody;

    if (action === 'register') {
      // Validate request
      const validation = validateRequest(AgentRegistrationSchema, params);
      if (!validation.success) {
        return withSecurityHeaders(createErrorResponse(validation.error, 'VALIDATION_ERROR', 400));
      }

      const { name, bio, specialty, rate, voiceId } = validation.data;
      
      // Sanitize name and bio
      const sanitizedName = sanitizeInput(name);
      const sanitizedBio = sanitizeInput(bio);
      
      const id = `${sanitizedName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      agents.set(id, {
        id,
        name: sanitizedName,
        bio: sanitizedBio,
        specialty: Array.isArray(specialty) ? specialty : [specialty],
        ratePerMinute: rate,
        voiceId: voiceId || '',
        rating: 0,
        totalRatings: 0,
        totalCalls: 0,
        owner: '0x0',
        verified: false,
        createdAt: Date.now(),
      });

      return withSecurityHeaders(createSuccessResponse({
        agent: { id, name: sanitizedName, rating: 0 },
        tokenId: `0x${Date.now().toString(16)}`,
      }, rateLimitHeaders));
    }

    if (action === 'feedback') {
      const { agentId, rating } = params;
      
      // Validate agent ID format
      if (!agentId || typeof agentId !== 'string') {
        return withSecurityHeaders(createErrorResponse('Invalid agent ID', 'INVALID_AGENT_ID', 400));
      }

      const agent = agents.get(agentId);
      
      if (!agent) {
        return withSecurityHeaders(createErrorResponse('Agent not found', 'AGENT_NOT_FOUND', 404));
      }

      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return withSecurityHeaders(createErrorResponse('Rating must be between 1 and 5', 'INVALID_RATING', 400));
      }

      agent.totalRatings++;
      agent.rating = ((agent.rating * (agent.totalRatings - 1)) + Math.min(5, Math.max(1, rating))) / agent.totalRatings;

      return withSecurityHeaders(createSuccessResponse({
        agentId,
        newRating: agent.rating,
        totalRatings: agent.totalRatings,
      }, rateLimitHeaders));
    }

    return withSecurityHeaders(createErrorResponse('Invalid action', 'INVALID_ACTION', 400));
  } catch (error) {
    return withSecurityHeaders(createErrorResponse('Internal error', 'INTERNAL_ERROR', 500));
  }
}

export async function GET(request: Request) {
  // Security checks
  const corsResponse = handleCORS(request);
  if (corsResponse) return corsResponse;

  // Rate limiting check
  const clientIp = getClientIP(request);
  const { headers: rateLimitHeaders } = checkRateLimit(apiLimiter, clientIp);

  const { searchParams } = new URL(request.url);
  
  // Sanitize query parameters
  const specialty = sanitizeInput(searchParams.get('specialty') || '');
  const search = sanitizeInput(searchParams.get('search') || '');
  const minRating = Math.max(0, Math.min(5, parseFloat(searchParams.get('minRating') || '0') || 0));
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20') || 20));

  let results = Array.from(agents.values());

  if (specialty) {
    results = results.filter(a => 
      a.specialty.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
    );
  }

  if (minRating > 0) {
    results = results.filter(a => a.rating >= minRating);
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(a => 
      a.name.toLowerCase().includes(q) || a.bio.toLowerCase().includes(q)
    );
  }

  // Sort by rating
  results.sort((a, b) => b.rating - a.rating);

  // Paginate
  const start = (page - 1) * pageSize;
  const paginatedResults = results.slice(start, start + pageSize);

  return withSecurityHeaders(createSuccessResponse({
    agents: paginatedResults.map(a => ({
      id: a.id,
      name: a.name,
      bio: a.bio,
      specialty: a.specialty,
      ratePerMinute: a.ratePerMinute,
      voiceId: a.voiceId,
      rating: a.rating,
      totalRatings: a.totalRatings,
      totalCalls: a.totalCalls,
      verified: a.verified,
    })),
    total: results.length,
    page,
    pageSize,
    hasMore: start + pageSize < results.length,
  }, rateLimitHeaders));
}
