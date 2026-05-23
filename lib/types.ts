export type AgentStatus = 'active' | 'pending' | 'rejected';

/**
 * Canonical Agent type used throughout the frontend.
 *
 * Backend (lib/db.ts) stores a superset of these fields using snake_case
 * Redis keys. API routes normalise between the two representations.
 * `rate` and `ratePerMinute` are aliases — `rate` is the display value.
 */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  specialty: string;
  bio: string;
  rating: number;
  calls: number;
  /** Per-minute rate in USD — preferred display field */
  rate: number;
  /** Alias for `rate`, used by backend / db layer */
  ratePerMinute?: number;
  avatar: string;
  color: string;
  online: boolean;
  category?: string;
  verified?: boolean;
  totalRatings?: number;
  totalCalls?: number;
  tags?: string[];
  wallet?: string;
  wallet_address?: string;
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
  duration: number;
  cost: number;
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
  rating: number;
  tag: 'helpful' | 'knowledgeable' | 'slow' | 'unclear' | 'other';
  comment?: string;
}

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

export interface PaymentRequirements {
  scheme: 'exact' | 'upto';
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  description: string;
  mimeType: string;
}

export interface EIP712Signature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface SignedAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
  signature: EIP712Signature;
}

export interface SettlementResult {
  success: boolean;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
  gasUsed?: bigint;
  actualAmount?: string;
  taskId?: string;
  error?: string;
}

export type SkillType = 'book' | 'order' | 'schedule' | 'research';

export interface Skill {
  type: SkillType;
  name: string;
  description: string;
  icon: string;
  requiredScope: keyof Pick<DelegationScope, 'canBook' | 'canOrder' | 'canSchedule' | 'canResearch'>;
}

export interface BookingConfirmation {
  bookingId: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  businessName: string;
  dateTime: string;
  confirmationCode?: string;
  cancellationPolicy?: string;
  estimatedCost?: string;
}

export interface OrderConfirmation {
  orderId: string;
  status: 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
  estimatedDelivery?: string;
  trackingNumber?: string;
  totalCost: number;
  items: { productId: string; name: string; quantity: number; price: number; options?: Record<string, string> }[];
}

export interface ResearchResult {
  id: string;
  title: string;
  summary: string;
  source?: string;
  url?: string;
  relevanceScore: number;
  metadata?: Record<string, string>;
}

export interface SkillResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  requiresApproval?: boolean;
  approvalAmount?: number;
  gasEstimate?: number;
}

export interface DelegationScope {
  canBook: boolean;
  canOrder: boolean;
  canSchedule: boolean;
  canResearch: boolean;
  maxSpend?: number;
}
