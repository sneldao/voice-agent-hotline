export const HOUSE = Object.freeze({
  name: 'Claflin',
  title: 'Claflin — your trading desk',
  description: 'A considered approach to tokenized stocks on Base. Explore Hetty’s desk, review live estimates, and make explicit decisions. Paper trading only for now.',
  mode: 'paper' as const,
  liveExecutionEnabled: false as const,
  voiceConversationEnabled: false as const,
});

export const HOUSE_DESKS = Object.freeze([
  Object.freeze({ id: 'hetty', name: 'Hetty', market: 'Base', approach: 'Independent judgment. Capital preservation. Deliberate decisions.', status: 'paper' as const }),
  Object.freeze({ id: 'jesse', name: 'Jesse Livermore', market: 'Solana', approach: 'Price action, timing, and disciplined speculation.', status: 'planned' as const }),
  Object.freeze({ id: 'isabel', name: 'Isabel Benham', market: 'Robinhood Chain', approach: 'Fundamental analysis and patient investigation.', status: 'planned' as const }),
  Object.freeze({ id: 'arbitrum', name: 'A future desk', market: 'Arbitrum', approach: 'Mandate and broker to be defined after the first three desks.', status: 'planned' as const }),
]);

export const RETIRED_CLIENT_PATHS = Object.freeze([
  '/marketplace', '/demo', '/dashboard', '/profile', '/list-your-broker', '/admin', '/admin/analytics',
]);

export function isRetiredMarketplaceApi(path: string): boolean {
  const normalized = path.replace(/\/$/, '');
  return normalized === '/api/agents' || normalized.startsWith('/api/agents/') ||
    normalized === '/api/ratings' || normalized === '/api/sdk/register';
}
