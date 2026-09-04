import type { Agent } from '@/lib/types';

interface Persona {
  desk: string;
  tone: string;
  line: string;
  voiceId: string;
}

const AGENT_PERSONAS: Record<string, Persona> = {
  general_helper: { desk: 'Main Desk', tone: 'Warm', line: 'Tokenized stocks, conservative execution', voiceId: 'Adam' },
  solana_sage: { desk: 'Research Desk', tone: 'Analytical', line: 'Fundamentals, earnings, valuation', voiceId: 'Josh' },
  code_reviewer: { desk: 'Momentum Desk', tone: 'Direct', line: 'Growth baskets, themes, catalysts', voiceId: 'Antoni' },
  tour_master: { desk: 'Concierge Desk', tone: 'Upbeat', line: 'Account questions, routing, help', voiceId: 'Rachel' },
  web_researcher: { desk: 'Macro Desk', tone: 'Thorough', line: 'Rates, markets, news', voiceId: 'Steve' },
  medical_advisor: { desk: 'Risk Desk', tone: 'Calm', line: 'Position sizing, portfolio health', voiceId: 'Sarah' },
};

const DEFAULT_PERSONA: Omit<Persona, 'voiceId'> & { voiceId: string } = {
  desk: 'Broker Desk',
  tone: 'helpful',
  line: '',
  voiceId: 'Custom',
};

/** Returns a display persona for a broker, falling back to category/specialty. */
export function getPersona(agent: Agent): Persona {
  return (
    AGENT_PERSONAS[agent.id] || {
      ...DEFAULT_PERSONA,
      desk: agent.category ? `${agent.category} Desk` : DEFAULT_PERSONA.desk,
      line: agent.specialty,
    }
  );
}
