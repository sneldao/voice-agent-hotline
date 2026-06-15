import type { Agent } from '@/lib/types';

interface Persona {
  desk: string;
  tone: string;
  line: string;
  voiceId: string;
}

const AGENT_PERSONAS: Record<string, Persona> = {
  solana_sage: { desk: 'Chain Desk', tone: 'Precise', line: 'Wallets, transactions, DeFi signals', voiceId: 'Josh' },
  code_reviewer: { desk: 'Debug Desk', tone: 'Direct', line: 'Architecture, bugs, repo reviews', voiceId: 'Antoni' },
  general_helper: { desk: 'Life Admin', tone: 'Warm', line: 'Booking, reminders, everyday tasks', voiceId: 'Adam' },
  tour_master: { desk: 'Travel Desk', tone: 'Upbeat', line: 'Trips, routes, local plans', voiceId: 'Rachel' },
  web_researcher: { desk: 'Research Desk', tone: 'Thorough', line: 'Sources, summaries, current info', voiceId: 'Steve' },
  medical_advisor: { desk: 'Health Prep', tone: 'Calm', line: 'Questions, symptoms, visit prep', voiceId: 'Sarah' },
};

const DEFAULT_PERSONA: Omit<Persona, 'voiceId'> & { voiceId: string } = {
  desk: 'Hotline Desk',
  tone: 'helpful',
  line: '',
  voiceId: 'Custom',
};

/** Returns a display persona for an agent, falling back to category/specialty. */
export function getPersona(agent: Agent): Persona {
  return (
    AGENT_PERSONAS[agent.id] || {
      ...DEFAULT_PERSONA,
      desk: agent.category ? `${agent.category} Desk` : DEFAULT_PERSONA.desk,
      line: agent.specialty,
    }
  );
}
