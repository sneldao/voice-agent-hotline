// ============================================
// Superfluid x402 Streaming Integration
// ============================================
// Enables continuous USDCx streaming payments for voice calls
// Reference: https://x402.superfluid.org/

import { Address, Hash } from 'viem';

// ============================================
// Configuration
// ============================================

// Base Mainnet addresses
const SUPERFLUID_CONFIG = {
  // USDC on Base
  usdcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // Super Token (USDCx)
  usdcxToken: '0xd04383398dd2426297da660f9cca3d439af9ce1b',
  // Constant Flow Agreement V1 Forwarder
  cfaV1Forwarder: '0xcfA132E353cB4E3180835bd80aA1126F87b751Ee',
  // Flow Executor
  flowExecutor: '0xeE567A1712e4306c68bf96b1879C67b57dC9a9A5',
  // Default stream rate (USDC per month)
  defaultMonthlyRate: '1000000000000000000', // 1 USDC/month
} as const;

// ============================================
// Types
// ============================================

export interface StreamingPaymentRequest {
  recipient: Address;
  monthlyAmount: string; // in USDC (18 decimals after wrapping)
  account: Address;
}

export interface StreamingPaymentState {
  status: 'idle' | 'pending' | 'streaming' | 'stopped' | 'error';
  streamId?: Hash;
  flowRate?: string;
  startedAt?: Date;
  stoppedAt?: Date;
  error?: string;
}

export interface StreamInfo {
  exists: boolean;
  currentFlowRate: string;
  deposit: string;
  owedDeposit: string;
}

// ============================================
// Superfluid Service
// ============================================

export class SuperfluidStreamingService {
  private account: Address;
  private wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> };

  constructor(
    account: Address,
    wallet: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> }
  ) {
    this.account = account;
    this.wallet = wallet;
  }

  /**
   * Calculate flow rate from monthly amount
   * Formula: monthlyAmount / (30 days * 24 hours * 60 minutes * 60 seconds)
   */
  static calculateFlowRate(monthlyUSDC: string): string {
    const monthly = BigInt(monthlyUSDC);
    const secondsPerMonth = BigInt(30 * 24 * 60 * 60);
    const flowRate = monthly / secondsPerMonth;
    return flowRate.toString();
  }

  /**
   * Grant ACL permissions to facilitator (one-time)
   */
  async grantPermissions(facilitatorAddress: Address): Promise<{ success: boolean; error?: string }> {
    try {
      // In production, this would call CFAV1Forwarder.grantPermissions
      // For now, we return a mock success
      console.log(`Granting permissions to facilitator: ${facilitatorAddress}`);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Permission grant failed'
      };
    }
  }

  /**
   * Check if stream exists to recipient
   */
  async checkStream(recipient: Address): Promise<StreamInfo> {
    try {
      // In production, this would query the Superfluid subgraph or contract
      // For now, return mock data
      return {
        exists: false,
        currentFlowRate: '0',
        deposit: '0',
        owedDeposit: '0',
      };
    } catch {
      return {
        exists: false,
        currentFlowRate: '0',
        deposit: '0',
        owedDeposit: '0',
      };
    }
  }

  /**
   * Start streaming payment to recipient
   */
  async startStream(request: StreamingPaymentRequest): Promise<StreamingPaymentState> {
    try {
      const flowRate = SuperfluidStreamingService.calculateFlowRate(request.monthlyAmount);
      
      // In production, this would:
      // 1. Check for existing stream
      // 2. Create USDC → USDCx wrap (if needed)
      // 3. Call CFAV1Forwarder.createFlow
      
      console.log(`Starting stream to ${request.recipient}`);
      console.log(`Monthly rate: ${request.monthlyAmount} USDC`);
      console.log(`Flow rate: ${flowRate} USDCx/second`);
      
      return {
        status: 'streaming',
        flowRate,
        startedAt: new Date(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Stream creation failed'
      };
    }
  }

  /**
   * Update existing stream flow rate
   */
  async updateStream(recipient: Address, newMonthlyAmount: string): Promise<StreamingPaymentState> {
    try {
      const newFlowRate = SuperfluidStreamingService.calculateFlowRate(newMonthlyAmount);
      
      // In production: CFAV1Forwarder.updateFlow
      console.log(`Updating stream to ${recipient} with new rate: ${newFlowRate}`);
      
      return {
        status: 'streaming',
        flowRate: newFlowRate,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Stream update failed'
      };
    }
  }

  /**
   * Stop streaming payment
   */
  async stopStream(recipient: Address): Promise<StreamingPaymentState> {
    try {
      // In production: CFAV1Forwarder.deleteFlow
      console.log(`Stopping stream to ${recipient}`);
      
      return {
        status: 'stopped',
        stoppedAt: new Date(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Stream stop failed'
      };
    }
  }

  /**
   * Get current streaming balance (USDCx)
   */
  async getBalance(): Promise<string> {
    try {
      // In production: Query Superfluid resolver or token contract
      return '0';
    } catch {
      return '0';
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate cost per second from monthly rate
 */
export function calculatePerSecondCost(monthlyUSDC: number): number {
  const secondsPerMonth = 30 * 24 * 60 * 60;
  return monthlyUSDC / secondsPerMonth;
}

/**
 * Format flow rate for display
 */
export function formatFlowRate(flowRate: string): string {
  const rate = Number(flowRate) / 1e18; // Convert from wei
  if (rate < 0.001) {
    return `${(rate * 1e6).toFixed(2)} µUSDC/s`;
  }
  return `${rate.toFixed(4)} USDC/s`;
}

/**
 * Calculate total streamed amount from flow rate and duration
 */
export function calculateStreamedAmount(flowRate: string, durationSeconds: number): string {
  const rate = BigInt(flowRate);
  const total = rate * BigInt(durationSeconds);
  return total.toString();
}
