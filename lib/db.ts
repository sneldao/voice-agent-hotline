// Upstash Redis Database for Voice Hotline

import { Redis } from '@upstash/redis';

// Types
interface User {
  id: string;
  address: string;
  username?: string;
  bio?: string;
  balance: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Backend Agent record stored in Redis.
 *
 * See also `Agent` in lib/types.ts for the frontend-facing type.
 * API routes map between the two representations.
 */
interface DbAgent {
  id: string;
  owner: string;
  name: string;
  type: 'ai' | 'human';
  specialty: string[];
  bio: string;
  voiceId?: string;
  ratePerMinute: number;
  rating: number;
  totalRatings: number;
  verified: boolean;
  status: 'online' | 'offline' | 'busy';
  createdAt: number;
  updatedAt: number;
}

// Re-export for callers that still reference the old name
type Agent = DbAgent;

interface CallSession {
  id: string;
  agentId: string;
  userId: string;
  status: 'pending' | 'connecting' | 'connected' | 'ended';
  duration: number;
  cost: number;
  rating?: number;
  feedback?: string;
  createdAt: number;
  endedAt?: number;
}

interface Delegation {
  id: string;
  userId: string;
  agentId: string;
  scope: {
    canBook: boolean;
    canOrder: boolean;
    canSchedule: boolean;
    canResearch: boolean;
    maxSpend: number;
  };
  status: 'active' | 'revoked' | 'expired';
  expiresAt: number;
  createdAt: number;
}

// Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

function key(...parts: string[]): string {
  return parts.join(':');
}

// ==================== USER OPERATIONS ====================

export async function createUser(user: User): Promise<User> {
  await redis.hset(key('user', user.id), user as any);
  await redis.set(key('user:by:address', user.address), user.id);
  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  return await redis.hgetall(key('user', id)) as User | null;
}

export async function getUserByAddress(address: string): Promise<User | null> {
  const id = await redis.get<string>(key('user:by:address', address));
  if (!id) return null;
  return await getUserById(id);
}

export async function updateUserBalance(id: string, amount: number): Promise<void> {
  await redis.hincrby(key('user', id), 'balance', amount);
  await redis.hset(key('user', id), { updatedAt: Date.now() } as any);
}

export async function getUserAgents(userId: string): Promise<Agent[]> {
  const agentIds = await redis.smembers<string[]>(key('user', userId, 'agents'));
  if (!agentIds.length) return [];
  const agents = await Promise.all(agentIds.map(id => getAgentById(id)));
  return agents.filter((a): a is Agent => a !== null);
}

// ==================== AGENT OPERATIONS ====================

export async function createAgent(agent: Agent): Promise<Agent> {
  await redis.hset(key('agent', agent.id), agent as any);
  await redis.sadd(key('user', agent.owner, 'agents'), agent.id);
  await redis.zadd(key('agents:online'), { score: Date.now(), member: agent.id });
  return agent;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  return await redis.hgetall(key('agent', id)) as Agent | null;
}

export async function updateAgentStatus(id: string, status: Agent['status']): Promise<void> {
  await redis.hset(key('agent', id), { status, updatedAt: Date.now() } as any);
  if (status === 'online') {
    await redis.zadd(key('agents:online'), { score: Date.now(), member: id });
  } else {
    await redis.zrem(key('agents:online'), id);
  }
}

export async function getOnlineAgents(): Promise<Agent[]> {
  const agentIds = await redis.zrange<string[]>(key('agents:online'), 0, -1);
  if (!agentIds.length) return [];
  const agents = await Promise.all(agentIds.map(id => getAgentById(id)));
  return agents.filter((a): a is Agent => a !== null && a.status === 'online');
}

export async function searchAgents(query: {
  type?: 'ai' | 'human';
  category?: string;
  minRating?: number;
  maxRate?: number;
  limit?: number;
}): Promise<Agent[]> {
  let agents = await getOnlineAgents();
  if (query.type) agents = agents.filter(a => a.type === query.type);
  if (query.category) agents = agents.filter(a => a.specialty.includes(query.category!));
  if (query.minRating) agents = agents.filter(a => a.rating >= query.minRating!);
  if (query.maxRate) agents = agents.filter(a => a.ratePerMinute <= query.maxRate!);
  return agents.slice(0, query.limit || 20);
}

export async function rateAgent(agentId: string, rating: number): Promise<void> {
  const agent = await getAgentById(agentId);
  if (!agent) return;
  const newTotalRatings = agent.totalRatings + 1;
  const newRating = ((agent.rating * agent.totalRatings) + rating) / newTotalRatings;
  await redis.hset(key('agent', agentId), { rating: newRating, totalRatings: newTotalRatings, updatedAt: Date.now() } as any);
}

// ==================== CALL SESSION OPERATIONS ====================

export async function createSession(session: CallSession): Promise<CallSession> {
  await redis.hset(key('session', session.id), session as any);
  await redis.sadd(key('user', session.userId, 'sessions'), session.id);
  await redis.sadd(key('agent', session.agentId, 'sessions'), session.id);
  await redis.sadd('session_index:all', session.id);
  return session;
}

export async function getSessionById(id: string): Promise<CallSession | null> {
  return await redis.hgetall(key('session', id)) as CallSession | null;
}

export async function updateSession(id: string, updates: Partial<CallSession>): Promise<void> {
  await redis.hset(key('session', id), { ...updates, updatedAt: Date.now() } as any);
}

export async function endSession(id: string, duration: number, cost: number): Promise<CallSession | null> {
  const session = await getSessionById(id);
  if (!session) return null;
  const updated = { ...session, status: 'ended' as const, duration, cost, endedAt: Date.now() };
  await redis.hset(key('session', id), updated as any);
  return updated;
}

export async function getUserSessions(userId: string, limit: number = 10): Promise<CallSession[]> {
  const sessionIds = await redis.smembers<string[]>(key('user', userId, 'sessions'));
  if (!sessionIds.length) return [];
  const sessions = await Promise.all(sessionIds.map(id => getSessionById(id)));
  return sessions.filter((s): s is CallSession => s !== null).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export async function getAgentSessions(agentId: string, limit: number = 10): Promise<CallSession[]> {
  const sessionIds = await redis.smembers<string[]>(key('agent', agentId, 'sessions'));
  if (!sessionIds.length) return [];
  const sessions = await Promise.all(sessionIds.map(id => getSessionById(id)));
  return sessions.filter((s): s is CallSession => s !== null).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

// ==================== DELEGATION OPERATIONS ====================

export async function createDelegation(delegation: Delegation): Promise<Delegation> {
  await redis.hset(key('delegation', delegation.id), delegation as any);
  await redis.sadd(key('user', delegation.userId, 'delegations'), delegation.id);
  return delegation;
}

export async function getDelegationById(id: string): Promise<Delegation | null> {
  return await redis.hgetall(key('delegation', id)) as Delegation | null;
}

export async function revokeDelegation(id: string): Promise<void> {
  await redis.hset(key('delegation', id), { status: 'revoked' as const } as any);
}

export async function getActiveDelegations(userId: string): Promise<Delegation[]> {
  const ids = await redis.smembers<string[]>(key('user', userId, 'delegations'));
  if (!ids.length) return [];
  const delegations = await Promise.all(ids.map(id => getDelegationById(id)));
  return delegations.filter((d): d is Delegation => d !== null && d.status === 'active' && Date.now() < d.expiresAt);
}

// ==================== ANALYTICS ====================

export async function getPlatformStats(): Promise<{
  totalUsers: number;
  totalAgents: number;
  onlineAgents: number;
  totalCalls: number;
  totalRevenue: number;
}> {
  const sessionIds = await redis.smembers<string[]>('session_index:all');
  if (!sessionIds.length) return { totalUsers: 0, totalAgents: 0, onlineAgents: 0, totalCalls: 0, totalRevenue: 0 };
  const pipeline = redis.pipeline();
  sessionIds.slice(0, 100).forEach(id => pipeline.hgetall(key('session', id)));
  const results = await pipeline.exec();
  const uniqueAgents = new Set<string>();
  const uniqueUsers = new Set<string>();
  let totalRevenue = 0;
  for (const raw of (results || [])) {
    const session = (raw as [Error | null, any])[1] as CallSession | null;
    if (session) {
      uniqueAgents.add(session.agentId);
      uniqueUsers.add(session.userId);
      if (session.status === 'ended') totalRevenue += session.cost;
    }
  }
  return {
    totalUsers: uniqueUsers.size,
    totalAgents: uniqueAgents.size,
    onlineAgents: await redis.zcard(key('agents:online')),
    totalCalls: sessionIds.length,
    totalRevenue,
  };
}

// ==================== CACHE HELPERS ====================

export async function cacheWithTTL<T>(k: string, v: T, ttl: number = 300): Promise<void> {
  await redis.setex(k, ttl, JSON.stringify(v));
}

export async function getCached<T>(k: string): Promise<T | null> {
  const val = await redis.get<string>(k);
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
}

export async function invalidateCache(k: string): Promise<void> {
  await redis.del(k);
}

export { redis };
