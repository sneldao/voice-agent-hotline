// ============================================
// Yellow Network State Channel Integration
// ============================================
// Decentralized clearing via state channels.
// Payments: instant, gasless, off-chain.
// Settlement: on-chain only when channel closes.
// Docs: https://docs.yellow.org
// SDK: @erc7824/nitrolite

import type { Address, Hex } from 'viem';

// ============================================
// Configuration
// ============================================

export const YELLOW_CONFIG = {
  /** Sandbox clearnode (use for dev/testing) */
  sandboxWsUrl: 'wss://clearnet-sandbox.yellow.com/ws',
  /** Production clearnode */
  wsUrl: 'wss://clearnet.yellow.com/ws',
  /** Default asset for voice payments */
  defaultAsset: 'usdc',
  /** Suggested minimum deposit (USDC, 6 decimals) */
  minDeposit: '1000000', // 1 USDC
};

// ============================================
// Types
// ============================================

export interface YellowAppDefinition {
  application: string;
  protocol: string;
  participants: [Address, Address];
  weights: [number, number];
  quorum: number;
  challenge: number;
  nonce: number;
}

export interface YellowAllocation {
  participant: Address;
  asset: string;
  amount: string;
}

export interface YellowSession {
  sessionId: string;
  status: 'pending' | 'open' | 'closing' | 'closed';
  definition: YellowAppDefinition;
  allocations: YellowAllocation[];
  payments: YellowPaymentRecord[];
  createdAt: number;
}

export interface YellowPaymentRecord {
  amount: string;
  asset: string;
  from: Address;
  to: Address;
  timestamp: number;
}

// ============================================
// WebSocket Client
// ============================================

type MessageHandler = (data: any) => void;

export class YellowClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler>();
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private sessions = new Map<string, YellowSession>();

  constructor(private wsUrl: string = YELLOW_CONFIG.sandboxWsUrl) {}

  /** Connect to ClearNode */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = () => resolve();
        this.ws.onerror = (e) => reject(new Error('WebSocket connection failed'));
        this.ws.onmessage = (event) => this.onMessage(event.data);
        this.ws.onclose = () => console.log('[Yellow] Disconnected');
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Authenticate using EIP-712 auth signer */
  async authenticate(signer: (payload: any) => Promise<Hex>, address: Address): Promise<void> {
    const {
      createAuthRequestMessage,
      createAuthVerifyMessageFromChallenge,
    } = await import('@erc7824/nitrolite');

    // Step 1: Request challenge
    const authMsg = await createAuthRequestMessage({
      address,
      session_key: address,
      application: 'voisss-voice-agent',
      allowances: [{ asset: 'usdc', amount: '10000000' }],
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 86400),
      scope: 'voice-payments',
    });
    const challenge = await this.sendAndWait(authMsg);

    // Step 2: Sign and verify
    await this.sendAndWait(
      await createAuthVerifyMessageFromChallenge(signer, challenge.challenge || challenge)
    );
  }

  /** Create an app session for payments */
  async createSession(
    signer: (payload: any) => Promise<Hex>,
    agentAddress: Address,
    depositAmount: string = YELLOW_CONFIG.minDeposit,
    asset: string = YELLOW_CONFIG.defaultAsset,
    userAddress: Address
  ): Promise<YellowSession> {
    const { createAppSessionMessage, RPCProtocolVersion } = await import('@erc7824/nitrolite');

    const definition = {
      application: 'voisss-voice-agent',
      protocol: RPCProtocolVersion.NitroRPC_0_4,
      participants: [userAddress, agentAddress] as [Address, Address],
      weights: [50, 50] as [number, number],
      quorum: 100,
      challenge: 0,
      nonce: Date.now(),
    };

    const allocations = [
      { participant: userAddress, asset, amount: depositAmount },
      { participant: agentAddress, asset, amount: '0' },
    ];

    const msg = await createAppSessionMessage(signer, { definition, allocations });
    const response = await this.sendAndWait(msg);

    const sessionId = response.app_session_id || response.sessionId || `ys_${Date.now()}`;
    const session: YellowSession = {
      sessionId,
      status: 'open',
      definition,
      allocations,
      payments: [],
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /** Send instant gasless payment */
  async sendPayment(
    signer: (payload: any) => Promise<Hex>,
    sessionId: string,
    amount: string,
    from: Address,
    to: Address,
    asset: string = YELLOW_CONFIG.defaultAsset
  ): Promise<YellowPaymentRecord> {
    const { createTransferMessage } = await import('@erc7824/nitrolite');

    const msg = await createTransferMessage(signer, {
      destination: to,
      allocations: [{ asset, amount }],
    });
    await this.sendAndWait(msg);

    const payment: YellowPaymentRecord = { amount, asset, from, to, timestamp: Date.now() };
    const session = this.sessions.get(sessionId);
    if (session) {
      session.payments.push(payment);
      // Update local allocation tracking
      const userAlloc = session.allocations.find(a => a.participant === from);
      const agentAlloc = session.allocations.find(a => a.participant === to);
      if (userAlloc) userAlloc.amount = (BigInt(userAlloc.amount) - BigInt(amount)).toString();
      if (agentAlloc) agentAlloc.amount = (BigInt(agentAlloc.amount) + BigInt(amount)).toString();
    }
    return payment;
  }

  /** Close session and settle on-chain */
  async closeSession(
    signer: (payload: any) => Promise<Hex>,
    sessionId: string
  ): Promise<void> {
    const { createCloseAppSessionMessage } = await import('@erc7824/nitrolite');

    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.status = 'closing';
    const msg = await createCloseAppSessionMessage(signer, {
      app_session_id: sessionId as Hex,
      allocations: session.allocations.map(a => ({
        participant: a.participant,
        asset: a.asset,
        amount: a.amount,
      })),
    });
    await this.sendAndWait(msg);
    session.status = 'closed';
  }

  /** Get session */
  getSession(sessionId: string): YellowSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Get total spent in a session */
  getTotalSpent(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '0';
    return session.payments.reduce((t, p) => (BigInt(t) + BigInt(p.amount)).toString(), '0');
  }

  /** Get ledger balances from clearnode */
  async getBalances(signer: (payload: any) => Promise<Hex>): Promise<Record<string, string>> {
    const { createGetLedgerBalancesMessage } = await import('@erc7824/nitrolite');
    const msg = await createGetLedgerBalancesMessage(signer);
    const response = await this.sendAndWait(msg);
    return response.balances || {};
  }

  /** Disconnect */
  disconnect(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
    }
    this.pending.clear();
    this.handlers.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Internal ──

  private sendAndWait(message: string, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `resp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('ClearNode response timeout'));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(message);
    });
  }

  private onMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      // Resolve first pending request
      if (this.pending.size > 0) {
        const [id, entry] = this.pending.entries().next().value!;
        clearTimeout(entry.timer);
        this.pending.delete(id);
        if (msg.error) {
          entry.reject(new Error(msg.error));
        } else {
          entry.resolve(msg);
        }
        return;
      }

      // Route to handler
      const handler = this.handlers.get(msg.type);
      if (handler) handler(msg);
    } catch {
      // Non-JSON, ignore
    }
  }
}

// ============================================
// Singleton
// ============================================

let instance: YellowClient | null = null;

export function getYellowClient(sandbox = true): YellowClient {
  if (!instance) {
    instance = new YellowClient(sandbox ? YELLOW_CONFIG.sandboxWsUrl : YELLOW_CONFIG.wsUrl);
  }
  return instance;
}
