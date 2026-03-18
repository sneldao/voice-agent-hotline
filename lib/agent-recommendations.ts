export interface RecommendableAgent {
  id: string;
  name: string;
  specialty: string;
  rate: number;
  rating?: number;
  avatar?: string;
  color?: string;
  category?: string;
  tags?: string[];
}

export interface AgentRecommendation {
  id: string;
  name: string;
  specialty: string;
  rate: number;
  reason: string;
  avatar?: string;
  color?: string;
}

export function getRelatedAgentRecommendations(
  selectedAgent: RecommendableAgent | null | undefined,
  agents: RecommendableAgent[],
  limit = 3
): AgentRecommendation[] {
  if (!selectedAgent || agents.length === 0) {
    return [];
  }

  const selectedCategory = normalize(selectedAgent.category);
  const selectedTags = normalizeList(selectedAgent.tags);
  const selectedTerms = tokenize(selectedAgent.specialty);

  return agents
    .filter((agent) => agent.id !== selectedAgent.id)
    .map((agent) => {
      const category = normalize(agent.category);
      const tags = normalizeList(agent.tags);
      const specialtyTerms = tokenize(agent.specialty);
      const sharedTags = intersection(selectedTags, tags);
      const sharedTerms = intersection(selectedTerms, specialtyTerms);
      const priceGap = Math.abs(Number(agent.rate) - Number(selectedAgent.rate));

      let score = 0;
      let reason = 'Popular with similar callers';

      if (selectedCategory && category && selectedCategory === category) {
        score += 5;
        reason = `Similar ${formatLabel(category)} workflows`;
      }

      if (sharedTags.length > 0) {
        score += 4;
        reason = `Shared focus on ${formatLabel(sharedTags[0])}`;
      } else if (sharedTerms.length > 0) {
        score += 3;
        reason = `Covers related ${sharedTerms[0]} requests`;
      }

      if (priceGap <= 0.03) {
        score += 2;
      } else if (Number(agent.rate) < Number(selectedAgent.rate)) {
        score += 1;
        reason = `Lower-cost option for ${agent.specialty.toLowerCase()}`;
      }

      score += Math.min(Number(agent.rating || 0), 5);

      return {
        id: agent.id,
        name: agent.name,
        specialty: agent.specialty,
        rate: Number(agent.rate),
        reason,
        avatar: agent.avatar,
        color: agent.color,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || left.rate - right.rate)
    .slice(0, limit)
    .map(({ score, ...recommendation }) => recommendation);
}

function normalize(value?: string) {
  return value?.trim().toLowerCase() || '';
}

function normalizeList(values?: string[]) {
  return (values || [])
    .map((value) => normalize(value))
    .filter(Boolean);
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

function intersection(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function formatLabel(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
