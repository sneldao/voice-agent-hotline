// ============================================
// Agent Skills & Utility Flows
// Everyday utility features for delegated AI agents
// ============================================

import { DelegationScope } from './erc8004';

// ============================================
// Skill Types
// ============================================

export type SkillType = 'book' | 'order' | 'schedule' | 'research';

export interface Skill {
  type: SkillType;
  name: string;
  description: string;
  icon: string;
  requiredScope: keyof Pick<DelegationScope, 'canBook' | 'canOrder' | 'canSchedule' | 'canResearch'>;
}

export const SKILLS: Skill[] = [
  {
    type: 'book',
    name: 'Book Appointment',
    description: 'Schedule appointments, reservations, and services',
    icon: '📅',
    requiredScope: 'canBook',
  },
  {
    type: 'order',
    name: 'Place Order',
    description: 'Order food, goods, and services',
    icon: '🛒',
    requiredScope: 'canOrder',
  },
  {
    type: 'schedule',
    name: 'Set Reminder',
    description: 'Schedule reminders and notifications',
    icon: '⏰',
    requiredScope: 'canSchedule',
  },
  {
    type: 'research',
    name: 'Research',
    description: 'Gather information and analysis',
    icon: '🔍',
    requiredScope: 'canResearch',
  },
];

// ============================================
// Booking Flow Types
// ============================================

export interface BookingRequest {
  serviceType: 'restaurant' | 'appointment' | 'travel' | 'event' | 'other';
  businessName: string;
  dateTime: string; // ISO format
  duration?: number; // minutes
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

// ============================================
// Ordering Flow Types
// ============================================

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
  price: number; // in cents
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

// ============================================
// Scheduling Flow Types
// ============================================

export interface ReminderRequest {
  title: string;
  description?: string;
  scheduledTime: string; // ISO format
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

// ============================================
// Research Flow Types
// ============================================

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
  relevanceScore: number; // 0-1
  metadata?: Record<string, string>;
}

export interface ResearchConfirmation {
  researchId: string;
  status: 'in_progress' | 'completed' | 'failed';
  results?: ResearchResult[];
  totalResults?: number;
  estimatedTime?: number; // seconds
}

// ============================================
// Skill Execution Context
// ============================================

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

// ============================================
// Skill Execution Result
// ============================================

export interface SkillResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  requiresApproval?: boolean;
  approvalAmount?: number;
  gasEstimate?: number;
}

// ============================================
// Utility Flow Service
// ============================================

export class UtilityFlowService {
  private context: SkillExecutionContext;

  constructor(context: SkillExecutionContext) {
    this.context = context;
  }

  // ========================================
  // Booking Operations
  // ========================================

  /**
   * Execute a booking request
   */
  async book(request: BookingRequest): Promise<SkillResult<BookingConfirmation>> {
    // Validate scope
    if (!this.context.scope.canBook) {
      return { success: false, error: 'Booking permission not granted' };
    }

    // Check budget
    const estimatedCost = this.estimateBookingCost(request);
    if (estimatedCost > this.context.scope.maxSpend) {
      return { 
        success: false, 
        error: 'Estimated cost exceeds delegation limit',
        requiresApproval: true,
        approvalAmount: estimatedCost,
      };
    }

    try {
      // In production, integrate with booking APIs
      // For now, return a mock confirmation
      const confirmation: BookingConfirmation = {
        bookingId: `book_${Date.now()}`,
        status: 'confirmed',
        businessName: request.businessName,
        dateTime: request.dateTime,
        confirmationCode: this.generateConfirmationCode(),
        estimatedCost: `$${(estimatedCost / 100).toFixed(2)}`,
      };

      return { success: true, data: confirmation };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Booking failed' 
      };
    }
  }

  /**
   * Cancel an existing booking
   */
  async cancelBooking(bookingId: string): Promise<SkillResult<{ cancelled: boolean; refund?: number }>> {
    if (!this.context.scope.canBook) {
      return { success: false, error: 'Booking permission not granted' };
    }

    // In production, call booking API
    return { success: true, data: { cancelled: true, refund: 0 } };
  }

  /**
   * Search for available bookings
   */
  async searchBookings(query: {
    serviceType?: string;
    location?: string;
    dateRange?: { start: string; end: string };
  }): Promise<SkillResult<BookingConfirmation[]>> {
    // Mock search results
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

  // ========================================
  // Ordering Operations
  // ========================================

  /**
   * Execute an order request
   */
  async order(request: OrderRequest): Promise<SkillResult<OrderConfirmation>> {
    if (!this.context.scope.canOrder) {
      return { success: false, error: 'Ordering permission not granted' };
    }

    // Calculate total
    const total = request.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    if (total > this.context.scope.maxSpend) {
      return { 
        success: false, 
        error: 'Order total exceeds delegation limit',
        requiresApproval: true,
        approvalAmount: total,
      };
    }

    try {
      const confirmation: OrderConfirmation = {
        orderId: `order_${Date.now()}`,
        status: 'preparing',
        estimatedDelivery: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        totalCost: total,
        items: request.items,
      };

      return { success: true, data: confirmation };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Order failed' 
      };
    }
  }

  /**
   * Track an existing order
   */
  async trackOrder(orderId: string): Promise<SkillResult<OrderConfirmation>> {
    // Mock tracking
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

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<SkillResult<{ cancelled: boolean; refund: number }>> {
    if (!this.context.scope.canOrder) {
      return { success: false, error: 'Ordering permission not granted' };
    }

    return { success: true, data: { cancelled: true, refund: 5000 } };
  }

  // ========================================
  // Scheduling Operations
  // ========================================

  /**
   * Schedule a reminder
   */
  async scheduleReminder(request: ReminderRequest): Promise<SkillResult<ReminderConfirmation>> {
    if (!this.context.scope.canSchedule) {
      return { success: false, error: 'Scheduling permission not granted' };
    }

    const confirmation: ReminderConfirmation = {
      reminderId: `remind_${Date.now()}`,
      status: 'scheduled',
      scheduledTime: request.scheduledTime,
      channels: request.channels || ['push'],
    };

    return { success: true, data: confirmation };
  }

  /**
   * Update an existing reminder
   */
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

  /**
   * Dismiss or delete a reminder
   */
  async dismissReminder(reminderId: string): Promise<SkillResult<{ dismissed: boolean }>> {
    return { success: true, data: { dismissed: true } };
  }

  // ========================================
  // Research Operations
  // ========================================

  /**
   * Execute a research request
   */
  async research(request: ResearchRequest): Promise<SkillResult<ResearchConfirmation>> {
    if (!this.context.scope.canResearch) {
      return { success: false, error: 'Research permission not granted' };
    }

    // Mock research results
    const results: ResearchResult[] = [
      {
        id: 'result_1',
        title: `${request.topic} - Overview`,
        summary: `Comprehensive overview of ${request.topic} including key facts and analysis.`,
        source: 'Web Search',
        relevanceScore: 0.95,
        url: 'https://example.com/result1',
      },
      {
        id: 'result_2',
        title: `${request.topic} - Latest News`,
        summary: `Recent developments and news about ${request.topic}.`,
        source: 'News API',
        relevanceScore: 0.87,
        url: 'https://example.com/result2',
      },
    ];

    return {
      success: true,
      data: {
        researchId: `research_${Date.now()}`,
        status: 'completed',
        results,
        totalResults: 2,
      },
    };
  }

  /**
   * Get detailed information on a research result
   */
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

  // ========================================
  // Helper Methods
  // ========================================

  private estimateBookingCost(request: BookingRequest): number {
    // Mock pricing based on service type
    const pricing: Record<string, number> = {
      restaurant: 5000, // $50
      appointment: 10000, // $100
      travel: 50000, // $500
      event: 20000, // $200
      other: 5000, // $50
    };
    return pricing[request.serviceType] || 5000;
  }

  private generateConfirmationCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

// ============================================
// Skill Permission Checker
// ============================================

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

// ============================================
// Delegation UI Helpers
// ============================================

export interface DelegationOption {
  skill: Skill;
  enabled: boolean;
  limits?: {
    maxSpend?: number;
    expiresAt?: number;
  };
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
  
  return BigInt(maxSpend) || BigInt(100000); // Default 100k wei
}
