// ERC-8004 Agent Registry - Demo

// Demo agents storage
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
    });
  });
}

seedDemoAgents();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === 'register') {
      const { name, bio, specialty, ratePerMinute, voiceId, owner } = params;
      const id = `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      agents.set(id, {
        id, name, bio, specialty: specialty || [], ratePerMinute, voiceId, owner,
        rating: 0, totalRatings: 0, totalCalls: 0, verified: false,
      });

      return Response.json({
        success: true,
        data: { agent: { id, name, rating: 0 }, tokenId: `0x${Date.now().toString(16)}` },
      });
    }

    if (action === 'feedback') {
      const { agentId, rating, tag } = params;
      const agent = agents.get(agentId);
      
      if (!agent) {
        return Response.json({ error: 'Agent not found' }, { status: 404 });
      }

      agent.totalRatings++;
      agent.rating = ((agent.rating * (agent.totalRatings - 1)) + Math.min(5, Math.max(1, rating))) / agent.totalRatings;

      return Response.json({
        success: true,
        data: { agentId, newRating: agent.rating, totalRatings: agent.totalRatings },
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get('specialty');
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  const search = searchParams.get('search');

  let results = Array.from(agents.values());

  if (specialty) {
    results = results.filter(a => a.specialty.some(s => s.toLowerCase().includes(specialty.toLowerCase())));
  }

  if (minRating > 0) {
    results = results.filter(a => a.rating >= minRating);
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(a => a.name.toLowerCase().includes(q) || a.bio.toLowerCase().includes(q));
  }

  results.sort((a, b) => b.rating - a.rating);

  return Response.json({
    success: true,
    data: {
      agents: results.map(a => ({
        id: a.id, name: a.name, bio: a.bio, specialty: a.specialty,
        ratePerMinute: a.ratePerMinute, voiceId: a.voiceId, rating: a.rating,
        totalRatings: a.totalRatings, totalCalls: a.totalCalls, verified: a.verified,
      })),
      total: results.length,
    },
  });
}
