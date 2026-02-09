/**
 * ERC-8004 Agent Registry API
 * 
 * Manages agent registration, reputation, and feedback.
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (use database in production)
const agents = new Map<string, {
  id: string;
  name: string;
  bio: string;
  specialty: string[];
  ratePerMinute: number;
  voiceId: string;
  rating: number;
  totalRatings: number;
  ratingDistribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
  totalCalls: number;
  owner: string;
  createdAt: number;
  verified: boolean;
}>();

const feedback = new Map<string, Array<{
  agentId: string;
  from: string;
  rating: number;
  tag: string;
  comment?: string;
  createdAt: number;
}>>();

// Seed demo agents
function seedDemoAgents() {
  if (agents.size > 0) return;

  const demoAgents = [
    {
      id: 'maria_garcia',
      name: 'Maria Garcia',
      bio: 'Native Spanish speaker with 5 years of teaching experience. I help students practice conversational Spanish through engaging discussions.',
      specialty: ['Spanish', 'Language Learning', 'Conversation'],
      ratePerMinute: 0.01,
      voiceId: 'Rachel',
      owner: '0xdemo1',
      verified: true,
    },
    {
      id: 'alex_chen',
      name: 'Alex Chen',
      bio: 'Full-stack developer and coding mentor. I help beginners understand programming concepts and debug code in real-time.',
      specialty: ['JavaScript', 'Python', 'Debugging', 'React'],
      ratePerMinute: 0.03,
      voiceId: 'Josh',
      owner: '0xdemo2',
      verified: true,
    },
    {
      id: 'chef_mario',
      name: 'Chef Mario',
      bio: 'Professional chef with 15 years experience in Italian cuisine. I\'ll help you cook perfect pasta, risotto, and more.',
      specialty: ['Italian Cooking', 'Recipes', 'Techniques'],
      ratePerMinute: 0.01,
      voiceId: 'Antoni',
      owner: '0xdemo3',
      verified: true,
    },
  ];

  demoAgents.forEach(agent => {
    agents.set(agent.id, {
      ...agent,
      rating: 4.5 + Math.random() * 0.5,
      totalRatings: Math.floor(Math.random() * 500) + 100,
      ratingDistribution: { 5: 200, 4: 150, 3: 50, 2: 10, 1: 5 },
      totalCalls: Math.floor(Math.random() * 2000) + 500,
      createdAt: Date.now(),
    });
  });
}

seedDemoAgents();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'register':
        return handleRegister(params);
      case 'feedback':
        return handleFeedback(params);
      case 'verify':
        return handleVerify(params);
      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[AgentsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Register a new agent
 */
function handleRegister({
  name,
  bio,
  specialty,
  ratePerMinute,
  voiceId,
  owner,
}: {
  name: string;
  bio: string;
  specialty: string[];
  ratePerMinute: number;
  voiceId: string;
  owner: string;
}): NextResponse {
  // Validate input
  if (!name || !bio || !owner) {
    return NextResponse.json(
      { error: 'Missing required fields', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  // Generate ID
  const id = `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

  // In production, would interact with ERC-8004 smart contract
  const agent = {
    id,
    name,
    bio,
    specialty,
    ratePerMinute,
    voiceId,
    owner,
    rating: 0,
    totalRatings: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    totalCalls: 0,
    createdAt: Date.now(),
    verified: false,
  };

  agents.set(id, agent);
  feedback.set(id, []);

  console.log(`[AgentsAPI] Agent registered: ${name} (${id})`);

  return NextResponse.json({
    success: true,
    data: {
      agent,
      tokenId: `0x${Date.now().toString(16)}`, // Mock ERC-8004 token ID
      message: 'Agent registered successfully. Submit for verification to earn trust badge.',
    },
  });
}

/**
 * Submit feedback for an agent
 */
function handleFeedback({
  agentId,
  from,
  rating,
  tag,
  comment,
}: {
  agentId: string;
  from: string;
  rating: number;
  tag: string;
  comment?: string;
}): NextResponse {
  const agent = agents.get(agentId);
  
  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found', code: 'AGENT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Validate rating
  const normalizedRating = Math.min(5, Math.max(1, rating));

  // Add feedback
  const entry = {
    agentId,
    from,
    rating: normalizedRating,
    tag,
    comment,
    createdAt: Date.now(),
  };

  const agentFeedback = feedback.get(agentId) || [];
  agentFeedback.unshift(entry);
  feedback.set(agentId, agentFeedback.slice(0, 100)); // Keep last 100

  // Update agent rating
  agent.ratingDistribution[normalizedRating as 1|2|3|4|5]++;
  agent.totalRatings++;

  const totalScore = 
    agent.ratingDistribution[5] * 5 +
    agent.ratingDistribution[4] * 4 +
    agent.ratingDistribution[3] * 3 +
    agent.ratingDistribution[2] * 2 +
    agent.ratingDistribution[1];
  
  agent.rating = totalScore / agent.totalRatings;

  console.log(`[AgentsAPI] Feedback submitted: ${agentId}, rating: ${normalizedRating}`);

  return NextResponse.json({
    success: true,
    data: {
      agentId,
      newRating: agent.rating,
      totalRatings: agent.totalRatings,
    },
  });
}

/**
 * Verify agent identity (ERC-8004)
 */
function handleVerify({ agentId }: { agentId: string }): NextResponse {
  const agent = agents.get(agentId);
  
  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found', code: 'AGENT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // In production, would verify on-chain via ERC-8004
  agent.verified = true;

  return NextResponse.json({
    success: true,
    data: {
      agentId,
      verified: true,
      message: 'Agent identity verified via ERC-8004 protocol',
    },
  });
}

/**
 * GET agents with filters
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get('specialty');
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  const maxRate = parseFloat(searchParams.get('maxRate') || '100');
  const verified = searchParams.get('verified') === 'true';
  const search = searchParams.get('search');

  let results = Array.from(agents.values());

  // Apply filters
  if (specialty) {
    results = results.filter(a =>
      a.specialty.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
    );
  }

  if (minRating > 0) {
    results = results.filter(a => a.rating >= minRating);
  }

  if (maxRate < 100) {
    results = results.filter(a => a.ratePerMinute <= maxRate);
  }

  if (verified) {
    results = results.filter(a => a.verified);
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.bio.toLowerCase().includes(q) ||
      a.specialty.some(s => s.toLowerCase().includes(q))
    );
  }

  // Sort by rating
  results.sort((a, b) => b.rating - a.rating);

  return NextResponse.json({
    success: true,
    data: {
      agents: results.map(a => ({
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
      filters: { specialty, minRating, maxRate, verified, search },
    },
  });
}
