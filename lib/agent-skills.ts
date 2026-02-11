// ============================================
// Agent Skills Framework
// ============================================
// Defines skill types and execution framework for agentic applications
// Following Celo's guidance on "everyday utility" for agentic apps

import { Hash, Address, parseEther } from 'viem';
import { erc8004Service, DelegationScope } from './erc8004';

// ============================================
// Skill Types
// ============================================

export type SkillType = 'book' | 'order' | 'schedule' | 'research';

export type SkillStatus = 'idle' | 'pending' | 'executing' | 'completed' | 'failed';

// Base skill result
export interface SkillResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
}

// Skill execution context
export interface SkillContext {
  skillType: SkillType;
  userId: string;
  userAddress?: Address;
  delegationId?: Hash;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

// ============================================
// Booking Skill
// ============================================

export interface BookingParams {
  serviceType: 'appointment' | 'consultation' | 'reservation';
  providerId: string;
  providerName: string;
  dateTime: string; // ISO 8601
  duration: number; // minutes
  notes?: string;
  location?: {
    type: 'virtual' | 'in-person';
    address?: string;
    meetingUrl?: string;
  };
}

export interface BookingConfirmation {
  bookingId: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  serviceType: string;
  provider: string;
  dateTime: string;
  duration: number;
  location: {
    type: string;
    address?: string;
    meetingUrl?: string;
  };
  price: {
    amount: string;
    currency: string;
  };
}

export class BookingSkill {
  private provider: string;
  private wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> };

  constructor(provider: string, wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }) {
    this.provider = provider;
    this.wallet = wallet;
  }

  /**
   * Check delegation permissions for booking
   */
  async checkPermission(delegationId: Hash): Promise<{ allowed: boolean; error?: string }> {
    const result = await erc8004Service.verifyDelegation(delegationId, 'book');
    return { allowed: result.valid, error: result.error };
  }

  /**
   * Create a booking
   */
  async execute(params: BookingParams): Promise<SkillResult> {
    try {
      // Validate parameters
      if (!params.providerId || !params.dateTime) {
        return {
          success: false,
          error: 'Missing required parameters: providerId or dateTime',
          timestamp: new Date(),
        };
      }

      // Create booking (mock implementation)
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const confirmation: BookingConfirmation = {
        bookingId,
        status: 'confirmed',
        serviceType: params.serviceType,
        provider: params.providerName,
        dateTime: params.dateTime,
        duration: params.duration,
        location: params.location || { type: 'virtual' },
        price: {
          amount: '25.00',
          currency: 'USD',
        },
      };

      return {
        success: true,
        data: { booking: confirmation },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Booking failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Cancel a booking
   */
  async cancel(bookingId: string): Promise<SkillResult> {
    try {
      // Cancel booking logic
      return {
        success: true,
        data: { cancelled: true, bookingId },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * List bookings for a user
   */
  async list(userId: string): Promise<SkillResult> {
    try {
      // List bookings (mock)
      return {
        success: true,
        data: { bookings: [] },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list bookings',
        timestamp: new Date(),
      };
    }
  }
}

// ============================================
// Ordering Skill
// ============================================

export interface OrderParams {
  vendorId: string;
  vendorName: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: string;
  }>;
  deliveryAddress?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  specialInstructions?: string;
  paymentMethod?: 'crypto' | 'card';
}

export interface OrderConfirmation {
  orderId: string;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered';
  vendor: string;
  items: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
  subtotal: string;
  tax: string;
  total: string;
  deliveryAddress?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  estimatedDelivery?: string;
}

export class OrderingSkill {
  private wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> };

  constructor(wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }) {
    this.wallet = wallet;
  }

  /**
   * Check delegation permissions for ordering
   */
  async checkPermission(delegationId: Hash): Promise<{ allowed: boolean; error?: string }> {
    const result = await erc8004Service.verifyDelegation(delegationId, 'order');
    return { allowed: result.valid, error: result.error };
  }

  /**
   * Create an order
   */
  async execute(params: OrderParams): Promise<SkillResult> {
    try {
      if (!params.vendorId || !params.items || params.items.length === 0) {
        return {
          success: false,
          error: 'Missing required parameters: vendorId or items',
          timestamp: new Date(),
        };
      }

      const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      // Calculate totals
      const subtotal = params.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + tax;

      const confirmation: OrderConfirmation = {
        orderId,
        status: 'confirmed',
        vendor: params.vendorName,
        items: params.items.map(({ name, quantity, price }) => ({ name, quantity, price })),
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        deliveryAddress: params.deliveryAddress,
        estimatedDelivery: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      };

      return {
        success: true,
        data: { order: confirmation },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Order failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Track an order
   */
  async track(orderId: string): Promise<SkillResult> {
    try {
      return {
        success: true,
        data: {
          orderId,
          status: 'processing',
          estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          tracking: '1Z999AA10123456784',
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tracking failed',
        timestamp: new Date(),
      };
    }
  }
}

// ============================================
// Scheduling Skill
// ============================================

export interface ScheduleParams {
  eventType: 'reminder' | 'meeting' | 'call' | 'task';
  title: string;
  description?: string;
  dateTime: string;
  duration?: number; // minutes
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  reminderBefore?: number; // minutes
  attendees?: string[];
  location?: string;
}

export interface ScheduleConfirmation {
  scheduleId: string;
  eventType: string;
  title: string;
  dateTime: string;
  duration: number;
  repeat: string;
  attendees: string[];
  reminders: number[];
}

export class SchedulingSkill {
  private wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> };

  constructor(wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }) {
    this.wallet = wallet;
  }

  /**
   * Check delegation permissions for scheduling
   */
  async checkPermission(delegationId: Hash): Promise<{ allowed: boolean; error?: string }> {
    const result = await erc8004Service.verifyDelegation(delegationId, 'schedule');
    return { allowed: result.valid, error: result.error };
  }

  /**
   * Create a scheduled item
   */
  async execute(params: ScheduleParams): Promise<SkillResult> {
    try {
      if (!params.title || !params.dateTime) {
        return {
          success: false,
          error: 'Missing required parameters: title or dateTime',
          timestamp: new Date(),
        };
      }

      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const reminders: number[] = [];
      if (params.reminderBefore) {
        reminders.push(params.reminderBefore);
        // Add additional reminders
        if (params.reminderBefore >= 60) reminders.push(params.reminderBefore / 2);
        if (params.reminderBefore >= 1440) reminders.push(1440); // 1 day before
      }

      const confirmation: ScheduleConfirmation = {
        scheduleId,
        eventType: params.eventType,
        title: params.title,
        dateTime: params.dateTime,
        duration: params.duration || 30,
        repeat: params.repeat || 'none',
        attendees: params.attendees || [],
        reminders,
      };

      return {
        success: true,
        data: { schedule: confirmation },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scheduling failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * List schedules for a user
   */
  async list(userId: string, startDate?: string, endDate?: string): Promise<SkillResult> {
    try {
      return {
        success: true,
        data: {
          schedules: [],
          period: { start: startDate, end: endDate },
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list schedules',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Cancel/delete a scheduled item
   */
  async cancel(scheduleId: string): Promise<SkillResult> {
    try {
      return {
        success: true,
        data: { cancelled: true, scheduleId },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed',
        timestamp: new Date(),
      };
    }
  }
}

// ============================================
// Research Skill
// ============================================

export interface ResearchParams {
  query: string;
  sources?: string[];
  maxResults?: number;
  includeSummary?: boolean;
  filters?: {
    dateRange?: { start: string; end: string };
    topics?: string[];
  };
}

export interface ResearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    source: string;
    snippet?: string;
    publishedDate?: string;
  }>;
  summary?: string;
  totalResults: number;
}

export class ResearchSkill {
  private wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> };

  constructor(wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }) {
    this.wallet = wallet;
  }

  /**
   * Check delegation permissions for research
   */
  async checkPermission(delegationId: Hash): Promise<{ allowed: boolean; error?: string }> {
    const result = await erc8004Service.verifyDelegation(delegationId, 'research');
    return { allowed: result.valid, error: result.error };
  }

  /**
   * Execute research query
   */
  async execute(params: ResearchParams): Promise<SkillResult> {
    try {
      if (!params.query) {
        return {
          success: false,
          error: 'Missing required parameter: query',
          timestamp: new Date(),
        };
      }

      const maxResults = params.maxResults || 10;
      
      // Mock research results (in production, would call search APIs)
      const results: ResearchResult['results'] = [
        {
          title: `${params.query} - Overview`,
          url: 'https://en.wikipedia.org/wiki/Example',
          source: 'Wikipedia',
          snippet: 'This is a summary of the research topic...',
          publishedDate: new Date().toISOString(),
        },
      ];

      const researchResult: ResearchResult = {
        query: params.query,
        results,
        totalResults: results.length,
        summary: params.includeSummary 
          ? `Found ${results.length} results for "${params.query}". Key findings include...`
          : undefined,
      };

      return {
        success: true,
        data: researchResult as unknown as Record<string, unknown>,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Research failed',
        timestamp: new Date(),
      };
    }
  }
}

// ============================================
// Skill Execution Framework
// ============================================

export class AgentSkillsFramework {
  private wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> };
  private bookingSkill: BookingSkill;
  private orderingSkill: OrderingSkill;
  private schedulingSkill: SchedulingSkill;
  private researchSkill: ResearchSkill;

  constructor(wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }) {
    this.wallet = wallet;
    this.bookingSkill = new BookingSkill('default', wallet);
    this.orderingSkill = new OrderingSkill(wallet);
    this.schedulingSkill = new SchedulingSkill(wallet);
    this.researchSkill = new ResearchSkill(wallet);
  }

  /**
   * Execute a skill based on type
   */
  async executeSkill(
    skillType: SkillType,
    params: Record<string, unknown>,
    delegationId?: Hash
  ): Promise<SkillResult> {
    // Check delegation if provided
    if (delegationId) {
      const result = await erc8004Service.verifyDelegation(delegationId, skillType);
      if (!result.valid) {
        return {
          success: false,
          error: result.error || 'Delegation verification failed',
          timestamp: new Date(),
        };
      }
    }

    switch (skillType) {
      case 'book':
        return this.bookingSkill.execute(params as unknown as BookingParams);
      case 'order':
        return this.orderingSkill.execute(params as unknown as OrderParams);
      case 'schedule':
        return this.schedulingSkill.execute(params as unknown as ScheduleParams);
      case 'research':
        return this.researchSkill.execute(params as unknown as ResearchParams);
      default:
        return {
          success: false,
          error: `Unknown skill type: ${skillType}`,
          timestamp: new Date(),
        };
    }
  }

  /**
   * Create a delegation for specific skills
   */
  async createDelegation(
    delegate: Address,
    scope: {
      canBook?: boolean;
      canOrder?: boolean;
      canSchedule?: boolean;
      canResearch?: boolean;
      maxSpend?: bigint;
      expiresInDays?: number;
    }
  ): Promise<{ success: boolean; delegationId?: Hash; error?: string }> {
    const delegationScope: DelegationScope = {
      canBook: scope.canBook || false,
      canOrder: scope.canOrder || false,
      canSchedule: scope.canSchedule || false,
      canResearch: scope.canResearch || false,
      maxSpend: scope.maxSpend || parseEther('100'), // Default 100 CELO max
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + (scope.expiresInDays || 30) * 24 * 60 * 60),
    };

    return erc8004Service.createDelegation(this.wallet, delegate, delegationScope);
  }

  /**
   * Get all skills
   */
  getSkills() {
    return {
      booking: this.bookingSkill,
      ordering: this.orderingSkill,
      scheduling: this.schedulingSkill,
      research: this.researchSkill,
    };
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new skills framework instance
 */
export function createSkillsFramework(wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }) {
  return new AgentSkillsFramework(wallet);
}

/**
 * Skill type helpers
 */
export const SKILL_CONFIG = {
  book: {
    name: 'Booking',
    description: 'Book appointments, consultations, and reservations',
    icon: 'calendar',
    color: 'blue',
  },
  order: {
    name: 'Ordering',
    description: 'Order food, products, and services',
    icon: 'shopping-cart',
    color: 'green',
  },
  schedule: {
    name: 'Scheduling',
    description: 'Schedule reminders, meetings, and tasks',
    icon: 'clock',
    color: 'purple',
  },
  research: {
    name: 'Research',
    description: 'Research topics and gather information',
    icon: 'search',
    color: 'orange',
  },
};
