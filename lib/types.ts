// Core types for Voice Agent Hotline

export type AgentStatus = 'active' | 'pending' | 'rejected';

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  rating: number;
  calls: number;
  rate: number; // dollars per minute
  avatar: string;
  color: string;
  online: boolean;
  // Optional display fields
  category?: string;
  verified?: boolean;
  totalRatings?: number;
  totalCalls?: number;
  tags?: string[];
  // Wallet / payout
  wallet?: string;
  wallet_address?: string;
  // Registration fields
  status?: AgentStatus;
  elevenlabs_agent_id?: string;
  system_prompt?: string;
  contact_email?: string;
}

export interface CallSession {
  id: string;
  agentId: string;
  userWallet: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  cost: number; // dollars
  paid: boolean;
}

export interface PaymentState {
  status: 'free' | 'pending' | 'active' | 'completed';
  balance: number;
  perMinuteRate: number;
  freeMinutes: number;
  minutesUsed: number;
}

export interface Feedback {
  agentId: string;
  rating: number; // 1-5
  tag: 'helpful' | 'knowledgeable' | 'slow' | 'unclear' | 'other';
  comment?: string;
}

// Agent self-registration payload (submitted by external developers)
export interface AgentSubmission {
  name: string;
  description: string;
  specialty: string;
  category: string;
  elevenlabs_agent_id: string;
  voice_id: string;
  system_prompt: string;
  rate: number;
  wallet_address: string;
  contact_email: string;
}

// ERC-8004 Types
export interface AgentRegistration {
  tokenId: bigint;
  owner: string;
  agentURI: string;
  timestamp: bigint;
}

export interface ReputationScore {
  agentId: bigint;
  average: number;
  total: number;
  distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

// x402 Types
export interface PaymentRequirements {
  scheme: 'exact' | 'upto';
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  description: string;
  mimeType: string;
}

export interface PaymentAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}
