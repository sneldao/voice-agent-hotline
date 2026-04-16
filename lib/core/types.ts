export type AgentStatus = 'active' | 'pending' | 'rejected';

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  rating: number;
  calls: number;
  rate: number;
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

export interface PaymentAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}

export type SkillType = 'book' | 'order' | 'schedule' | 'research';

export interface Skill {
  type: SkillType;
  name: string;
  description: string;
  icon: string;
  requiredScope: keyof Pick<DelegationScope, 'canBook' | 'canOrder' | 'canSchedule' | 'canResearch'>;
}

export interface BookingRequest {
  serviceType: 'restaurant' | 'appointment' | 'travel' | 'event' | 'other';
  businessName: string;
  dateTime: string;
  duration?: number;
  partySize?: number;
  notes?: string;
  preferences?: {
    location?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    amenities?: string[];
  };
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

export interface OrderRequest {
  vendor: string;
  category: 'food' | 'groceries' | 'retail' | 'services';
  items: OrderItem[];
  deliveryAddress?: {
    street: string;
    city: string;
    zip: string;
    instructions?: string;
  };
  scheduledTime?: string;
  paymentMethod?: string;
  tip?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  options?: Record<string, string>;
}

export interface OrderConfirmation {
  orderId: string;
  status: 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
  estimatedDelivery?: string;
  trackingNumber?: string;
  totalCost: number;
  items: OrderItem[];
}

export interface ReminderRequest {
  title: string;
  description?: string;
  scheduledTime: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  channels?: ('push' | 'email' | 'sms' | 'call')[];
  priority?: 'low' | 'medium' | 'high';
  linkedResource?: {
    type: 'url' | 'document' | 'contact';
    value: string;
  };
}

export interface ReminderConfirmation {
  reminderId: string;
  status: 'scheduled' | 'sent' | 'dismissed' | 'completed';
  scheduledTime: string;
  channels: string[];
}

export interface ResearchRequest {
  topic: string;
  type: 'general' | 'news' | 'academic' | 'product' | 'price' | 'location';
  filters?: {
    dateRange?: { start: string; end: string };
    sources?: string[];
    location?: string;
    maxResults?: number;
  };
  outputFormat?: 'summary' | 'detailed' | 'comparison';
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

export interface ResearchConfirmation {
  researchId: string;
  status: 'in_progress' | 'completed' | 'failed';
  results?: ResearchResult[];
  totalResults?: number;
  estimatedTime?: number;
}

export interface SkillExecutionContext {
  userId: string;
  agentId: string;
  delegationId: string;
  scope: DelegationScope;
  userPreferences?: {
    preferredVendors?: string[];
    dietaryRestrictions?: string[];
    defaultLocation?: string;
    defaultPaymentMethod?: string;
  };
  budgetLimits?: {
    perTransaction: number;
    daily: number;
    monthly: number;
  };
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

export class UtilityFlowService {
  private context: SkillExecutionContext;

  constructor(context: SkillExecutionContext) {
    this.context = context;
  }

  async book(request: BookingRequest): Promise<SkillResult<BookingConfirmation>> {
    if (!this.context.scope.canBook) {
      return { success: false, error: 'Booking permission not granted' };
    }
    const estimatedCost = this.estimateBookingCost(request);
    if (estimatedCost > (this.context.scope.maxSpend || 0)) {
      return { 
        success: false, 
        error: 'Estimated cost exceeds delegation limit',
        requiresApproval: true,
        approvalAmount: estimatedCost,
      };
    }
    const confirmation: BookingConfirmation = {
      bookingId: \`book_\${Date.now()}\`,
      status: 'confirmed',
      businessName: request.businessName,
      dateTime: request.dateTime,
      confirmationCode: this.generateConfirmationCode(),
      estimatedCost: \`\$\{(estimatedCost / 100).toFixed(2)}\`,
    };
    return { success: true, data: confirmation };
  }

  async cancelBooking(bookingId: string): Promise<SkillResult<{ cancelled: boolean; refund?: number }>> {
    if (!this.context.scope.canBook) {
      return { success: false, error: 'Booking permission not granted' };
    }
    return { success: true, data: { cancelled: true, refund: 0 } };
  }

  async searchBookings(query: {
    serviceType?: string;
    location?: string;
    dateRange?: { start: string; end: string };
  }): Promise<SkillResult<BookingConfirmation[]>> {
    return { 
      success: true, 
      data: [
        {
          bookingId: 'demo_1',
          status: 'confirmed',
          businessName: 'Demo Restaurant',
          dateTime: new Date().toISOString(),
          estimatedCost: '50.00',
        },
      ],
    };
  }

  async order(request: OrderRequest): Promise<SkillResult<OrderConfirmation>> {
    if (!this.context.scope.canOrder) {
      return { success: false, error: 'Ordering permission not granted' };
    }
    const total = request.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (total > (this.context.scope.maxSpend || 0)) {
      return { 
        success: false, 
        error: 'Order total exceeds delegation limit',
        requiresApproval: true,
        approvalAmount: total,
      };
    }
    const confirmation: OrderConfirmation = {
      orderId: \`order_\${Date.now()}\`,
      status: 'preparing',
      estimatedDelivery: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      totalCost: total,
      items: request.items,
    };
    return { success: true, data: confirmation };
  }

  async trackOrder(orderId: string): Promise<SkillResult<OrderConfirmation>> {
    return {
      success: true,
      data: {
        orderId,
        status: 'shipped',
        estimatedDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        totalCost: 5000,
        items: [],
      },
    };
  }

  async cancelOrder(orderId: string): Promise<SkillResult<{ cancelled: boolean; refund: number }>> {
    if (!this.context.scope.canOrder) {
      return { success: false, error: 'Ordering permission not granted' };
    }
    return { success: true, data: { cancelled: true, refund: 5000 } };
  }

  async scheduleReminder(request: ReminderRequest): Promise<SkillResult<ReminderConfirmation>> {
    if (!this.context.scope.canSchedule) {
      return { success: false, error: 'Scheduling permission not granted' };
    }
    const confirmation: ReminderConfirmation = {
      reminderId: \`remind_\${Date.now()}\`,
      status: 'scheduled',
      scheduledTime: request.scheduledTime,
      channels: request.channels || ['push'],
    };
    return { success: true, data: confirmation };
  }

  async updateReminder(
    reminderId: string,
    updates: Partial<ReminderRequest>
  ): Promise<SkillResult<ReminderConfirmation>> {
    return {
      success: true,
      data: {
        reminderId,
        status: 'scheduled',
        scheduledTime: updates.scheduledTime || new Date().toISOString(),
        channels: updates.channels || ['push'],
      },
    };
  }

  async dismissReminder(reminderId: string): Promise<SkillResult<{ dismissed: boolean }>> {
    return { success: true, data: { dismissed: true } };
  }

  async research(request: ResearchRequest): Promise<SkillResult<ResearchConfirmation>> {
    if (!this.context.scope.canResearch) {
      return { success: false, error: 'Research permission not granted' };
    }
    const results: ResearchResult[] = [
      {
        id: 'result_1',
        title: \`\${request.topic} - Overview\`,
        summary: \`Comprehensive overview of \${request.topic} including key facts and analysis.\`,
        source: 'Web Search',
        relevanceScore: 0.95,
        url: 'https://example.com/result1',
      },
      {
        id: 'result_2',
        title: \`\${request.topic} - Latest News\`,
        summary: \`Recent developments and news about \${request.topic}.\`,
        source: 'News API',
        relevanceScore: 0.87,
        url: 'https://example.com/result2',
      },
    ];
    return {
      success: true,
      data: {
        researchId: \`research_\${Date.now()}\`,
        status: 'completed',
        results,
        totalResults: 2,
      },
    };
  }

  async getResearchDetail(resultId: string): Promise<SkillResult<ResearchResult>> {
    return {
      success: true,
      data: {
        id: resultId,
        title: 'Detailed Research Result',
        summary: 'In-depth analysis and comprehensive details.',
        source: 'Detailed Research',
        relevanceScore: 0.98,
        metadata: {
          publishedDate: new Date().toISOString(),
          author: 'Research Agent',
        },
      },
    };
  }

  private estimateBookingCost(request: BookingRequest): number {
    const pricing: Record<string, number> = {
      restaurant: 5000,
      appointment: 10000,
      travel: 50000,
      event: 20000,
      other: 5000,
    };
    return pricing[request.serviceType] || 5000;
  }

  private generateConfirmationCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

export function hasSkillPermission(
  scope: DelegationScope,
  skillType: SkillType
): boolean {
  const permissionMap: Record<SkillType, 'canBook' | 'canOrder' | 'canSchedule' | 'canResearch'> = {
    book: 'canBook',
    order: 'canOrder',
    schedule: 'canSchedule',
    research: 'canResearch',
  };
  return !!(scope[permissionMap[skillType]]);
}

export function getSkillRequiredScope(skillType: SkillType): keyof DelegationScope {
  const permissionMap: Record<SkillType, keyof DelegationScope> = {
    book: 'canBook',
    order: 'canOrder',
    schedule: 'canSchedule',
    research: 'canResearch',
  };
  return permissionMap[skillType];
}

export function getSkillByType(type: SkillType): Skill | undefined {
  return SKILLS.find(skill => skill.type === type);
}

export function createDelegationOptions(): DelegationOption[] {
  return SKILLS.map(skill => ({
    skill,
    enabled: false,
  }));
}

export function formatDelegationForDisplay(options: DelegationOption[]): string {
  const enabled = options.filter(o => o.enabled);
  if (enabled.length === 0) return 'No permissions granted';
  return enabled.map(o => o.skill.name).join(', ');
}

export function calculateDelegationLimit(options: DelegationOption[]): bigint {
  const maxSpend = options
    .filter(o => o.enabled && o.limits?.maxSpend)
    .reduce((sum, o) => sum + (o.limits?.maxSpend || 0), 0);
  return BigInt(maxSpend) || BigInt(100000);
}
