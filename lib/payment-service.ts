// x402 Payment Service for Micropayments on Celo (Simplified)

interface PaymentAuthorization {
  id: string;
  payer: string;
  payee: string;
  amount: number; // in cents
  token: string;
  expiresAt: number;
}

interface SessionPayment {
  sessionId: string;
  authorizationId: string;
  totalAuthorized: number;
  spent: number;
  lastUpdate: number;
}

export class X402PaymentService {
  private authorization: PaymentAuthorization | null = null;
  private sessionPayment: SessionPayment | null = null;

  // Authorize payment for a call
  async authorizePayment(
    payer: string,
    payee: string,
    amountCents: number,
    durationSeconds: number
  ): Promise<PaymentAuthorization> {
    const expiresAt = Date.now() + durationSeconds * 1000 + 300000;

    const authorization: PaymentAuthorization = {
      id: crypto.randomUUID(),
      payer,
      payee,
      amount: amountCents,
      token: 'USDC',
      expiresAt,
    };

    this.authorization = authorization;
    return authorization;
  }

  // Verify payment authorization
  async verifyAuthorization(auth: PaymentAuthorization): Promise<boolean> {
    if (Date.now() > auth.expiresAt) {
      return false;
    }
    return true;
  }

  // Start per-second billing session
  async startSession(sessionId: string): Promise<void> {
    if (!this.authorization) {
      throw new Error('No authorization found');
    }

    this.sessionPayment = {
      sessionId,
      authorizationId: this.authorization.id,
      totalAuthorized: this.authorization.amount,
      spent: 0,
      lastUpdate: Date.now(),
    };
  }

  // Record time spent and calculate cost
  async recordTime(durationSeconds: number): Promise<number> {
    if (!this.sessionPayment || !this.authorization) {
      throw new Error('No active session');
    }

    const costThisInterval = this.calculateCost(durationSeconds);
    this.sessionPayment.spent += costThisInterval;
    this.sessionPayment.lastUpdate = Date.now();

    const remaining = this.sessionPayment.totalAuthorized - this.sessionPayment.spent;
    if (remaining < 0) {
      throw new Error('Payment limit exceeded');
    }

    return remaining;
  }

  // End session and settle payment
  async endSession(): Promise<{ success: boolean; totalCost: number; refund: number }> {
    if (!this.sessionPayment || !this.authorization) {
      throw new Error('No active session');
    }

    const totalCost = this.sessionPayment.spent;
    const refund = this.sessionPayment.totalAuthorized - totalCost;

    this.sessionPayment = null;
    this.authorization = null;

    return { success: true, totalCost, refund };
  }

  // Get current session status
  getSessionStatus(): { spent: number; remaining: number; duration: number } | null {
    if (!this.sessionPayment || !this.authorization) {
      return null;
    }

    const remaining = this.sessionPayment.totalAuthorized - this.sessionPayment.spent;
    return {
      spent: this.sessionPayment.spent,
      remaining,
      duration: Math.floor((Date.now() - this.sessionPayment.lastUpdate) / 1000),
    };
  }

  // Get authorization for frontend
  getAuthorization(): PaymentAuthorization | null {
    return this.authorization;
  }

  // Calculate cost for duration
  private calculateCost(seconds: number): number {
    if (!this.sessionPayment || !this.authorization) {
      throw new Error('No session');
    }
    const perSecond = this.authorization.amount / 60;
    return perSecond * seconds;
  }
}

// ERC-8004 Delegation Token for Agent Actions

interface DelegationToken {
  id: string;
  delegator: string;
  delegate: string;
  scope: DelegationScope;
  expiresAt: number;
}

interface DelegationScope {
  canBook: boolean;
  canOrder: boolean;
  canSchedule: boolean;
  canResearch: boolean;
  maxSpend: number;
}

export class DelegationService {
  private tokens: Map<string, DelegationToken> = new Map();

  // Create delegation token
  createDelegation(
    delegator: string,
    delegate: string,
    scope: DelegationScope,
    expiresInMinutes: number = 60
  ): DelegationToken {
    const token: DelegationToken = {
      id: crypto.randomUUID(),
      delegator,
      delegate,
      scope,
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
    };

    this.tokens.set(token.id, token);
    return token;
  }

  // Verify delegation token
  verifyToken(tokenId: string, action: string): { valid: boolean; reason?: string } {
    const token = this.tokens.get(tokenId);
    if (!token) {
      return { valid: false, reason: 'Token not found' };
    }

    if (Date.now() > token.expiresAt) {
      return { valid: false, reason: 'Token expired' };
    }

    switch (action) {
      case 'book':
        if (!token.scope.canBook) return { valid: false, reason: 'Booking not permitted' };
        break;
      case 'order':
        if (!token.scope.canOrder) return { valid: false, reason: 'Ordering not permitted' };
        break;
      case 'schedule':
        if (!token.scope.canSchedule) return { valid: false, reason: 'Scheduling not permitted' };
        break;
      case 'research':
        if (!token.scope.canResearch) return { valid: false, reason: 'Research not permitted' };
        break;
      default:
        return { valid: false, reason: 'Unknown action' };
    }

    return { valid: true };
  }

  // Revoke delegation
  revokeDelegation(tokenId: string): boolean {
    return this.tokens.delete(tokenId);
  }

  // Get active delegations for a delegate
  getDelegationsForDelegate(delegate: string): DelegationToken[] {
    return Array.from(this.tokens.values()).filter(
      t => t.delegate === delegate && Date.now() < t.expiresAt
    );
  }
}

// Export singleton instances
export const paymentService = new X402PaymentService();
export const delegationService = new DelegationService();
