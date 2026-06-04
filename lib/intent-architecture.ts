// ============================================
// Intent-Based Agentic Architecture
// ============================================
// Intent parsing and execution
// No private keys on servers - ever

import type { Address } from 'viem';

// ============================================
// Intent Types (What user wants to do)
// ============================================
export type IntentAction = 
  | 'start_call'      // Begin voice call with agent
  | 'authorize_payment' // Authorize up to X amount
  | 'stream_payment'  // Start streaming payments
  | 'end_call'        // End call and settle
  | 'dispute_call'    // File a dispute
  | 'stake_agent'     // Stake ETH as agent
  | 'unstake_agent';  // Request unstake

export interface Intent {
  id: string;
  action: IntentAction;
  user: Address;
  constraints: IntentConstraints;
  context: IntentContext;
  expiry: number;
  signature?: `0x${string}`;
}

export interface IntentConstraints {
  maxAmount?: bigint;        // Maximum amount willing to spend
  maxDuration?: number;      // Maximum call duration in seconds
  agentId?: string;          // Target agent
  token?: Address;           // Payment token (USDC, USDT)
  ratePerMinute?: number;    // For streaming payments
}

export interface IntentContext {
  callId?: string;
  sessionKey?: Address;      // Authorized session key
  previousIntents?: string[]; // Chain of intents
  metadata?: Record<string, any>;
}

// ============================================
// Intent Parser (Natural language → Structured intent)
// ============================================
export class IntentParser {
  /**
   * Parse natural language or UI action into structured intent
   */
  parse(input: string, user: Address): Intent | null {
    // Pattern: "Call [agent] for [duration] with max [amount]"
    const callPattern = /call\s+(\w+)\s+for\s+(\d+)\s*(min|minutes?)\s+(?:with\s+)?max\s+\$?(\d+\.?\d*)/i;
    
    const callMatch = input.match(callPattern);
    if (callMatch) {
      const [, agentName, duration, , amount] = callMatch;
      return {
        id: `intent_${Date.now()}`,
        action: 'start_call',
        user,
        constraints: {
          maxAmount: BigInt(parseFloat(amount) * 1e18),
          maxDuration: parseInt(duration) * 60,
          agentId: this.resolveAgentName(agentName),
        },
        context: {},
        expiry: Date.now() + 300000, // 5 min
      };
    }

    // Pattern: "Authorize $[amount] for agent [id]"
    const authPattern = /authorize\s+\$?(\d+\.?\d*)\s+for\s+agent\s+(\w+)/i;
    
    const authMatch = input.match(authPattern);
    if (authMatch) {
      const [, amount, agentId] = authMatch;
      return {
        id: `intent_${Date.now()}`,
        action: 'authorize_payment',
        user,
        constraints: {
          maxAmount: BigInt(parseFloat(amount) * 1e18),
          agentId,
        },
        context: {},
        expiry: Date.now() + 3600000, // 1 hour
      };
    }

    // Pattern: "End call [id]"
    const endPattern = /end\s+call\s+(\w+)/i;
    
    const endMatch = input.match(endPattern);
    if (endMatch) {
      const [, callId] = endMatch;
      return {
        id: `intent_${Date.now()}`,
        action: 'end_call',
        user,
        constraints: {},
        context: { callId },
        expiry: Date.now() + 60000, // 1 min
      };
    }

    return null;
  }

  /**
   * Parse from UI action (structured)
   */
  parseFromUI(
    action: IntentAction,
    params: {
      user: Address;
      maxAmount?: string;
      maxDuration?: number;
      agentId?: string;
      callId?: string;
    }
  ): Intent {
    return {
      id: `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      user: params.user,
      constraints: {
        maxAmount: params.maxAmount ? BigInt(params.maxAmount) : undefined,
        maxDuration: params.maxDuration,
        agentId: params.agentId,
      },
      context: {
        callId: params.callId,
      },
      expiry: Date.now() + (action === 'start_call' ? 300000 : 3600000),
    };
  }

  private resolveAgentName(name: string): string {
    // Map common names to agent IDs
    const nameMap: Record<string, string> = {
      'sage': 'agent_2101khgsy8aqfxv8yr3r9548bqrx',
      'code': 'agent_0201khgsya1dfcgv6p5ch10995b9',
      'tournament': 'agent_6701khgsyb70fdebb2ce36dfjs2m',
      'helper': 'agent_2101khgsyd02fnvshvr7rzb50qj6',
    };
    return nameMap[name.toLowerCase()] || name;
  }
}

// ============================================
// Intent Validator (Check if intent is valid/safe)
// ============================================
export class IntentValidator {
  private maxAmountPerIntent = parseEther('100'); // $100 max per intent
  private maxDurationPerCall = 3600; // 1 hour max

  async validate(intent: Intent): Promise<{
    valid: boolean;
    risk: 'low' | 'medium' | 'high';
    warnings: string[];
    simulation?: {
      estimatedCost: bigint;
      gasEstimate: bigint;
      success: boolean;
    };
  }> {
    const warnings: string[] = [];

    // Check expiry
    if (Date.now() > intent.expiry) {
      return { valid: false, risk: 'high', warnings: ['Intent expired'] };
    }

    // Check amount limits
    if (intent.constraints.maxAmount) {
      if (intent.constraints.maxAmount > this.maxAmountPerIntent) {
        warnings.push(`Amount exceeds recommended maximum ($100)`);
      }
    }

    // Check duration limits
    if (intent.constraints.maxDuration) {
      if (intent.constraints.maxDuration > this.maxDurationPerCall) {
        warnings.push(`Duration exceeds recommended maximum (1 hour)`);
      }
    }

    // Check if agent exists and is active
    if (intent.constraints.agentId) {
      const agent = await this.checkAgent(intent.constraints.agentId);
      if (!agent) {
        return { valid: false, risk: 'high', warnings: ['Agent not found'] };
      }
      if (!agent.active) {
        warnings.push('Agent is currently inactive');
      }
      if (agent.reputation < 50) {
        warnings.push('Agent has low reputation score');
      }
    }

    // Simulate execution (would call smart contract)
    const simulation = await this.simulateExecution(intent);

    // Determine risk level
    let risk: 'low' | 'medium' | 'high' = 'low';
    if (warnings.length > 2 || !simulation.success) {
      risk = 'high';
    } else if (warnings.length > 0) {
      risk = 'medium';
    }

    return {
      valid: simulation.success,
      risk,
      warnings,
      simulation,
    };
  }

  private async checkAgent(agentId: string): Promise<{
    active: boolean;
    reputation: number;
  } | null> {
    // Would query smart contract or API
    // Mock for now
    return {
      active: true,
      reputation: 75,
    };
  }

  private async simulateExecution(intent: Intent): Promise<{
    estimatedCost: bigint;
    gasEstimate: bigint;
    success: boolean;
  }> {
    // Would use Tenderly or similar for simulation
    // Mock for now
    return {
      estimatedCost: intent.constraints.maxAmount || 0n,
      gasEstimate: 150000n,
      success: true,
    };
  }
}

// ============================================
// Intent Executor (Cloud Agent - No Keys Needed!)
// ============================================
export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalEstimatedCost: bigint;
  fallbackActions: FallbackAction[];
}

export interface ExecutionStep {
  id: string;
  type: 'contract_call' | 'api_call' | 'condition';
  target: Address | string;
  data: any;
  estimatedGas: bigint;
  condition?: string; // e.g., "balance > 100"
}

export interface FallbackAction {
  condition: string;
  action: ExecutionStep;
}

export class IntentExecutor {
  /**
   * Convert intent to execution plan
   * Cloud agent figures out HOW, user only specified WHAT
   */
  createExecutionPlan(intent: Intent): ExecutionPlan {
    switch (intent.action) {
      case 'start_call':
        return this.planStartCall(intent);
      case 'authorize_payment':
        return this.planAuthorizePayment(intent);
      case 'end_call':
        return this.planEndCall(intent);
      default:
        throw new Error(`Unknown action: ${intent.action}`);
    }
  }

  private planStartCall(intent: Intent): ExecutionPlan {
    const steps: ExecutionStep[] = [
      {
        id: '1',
        type: 'contract_call',
        target: '0xSessionKeyFactory', // Would be actual address
        data: {
          method: 'createSessionKey',
          params: {
            owner: intent.user,
            expiry: intent.expiry,
            maxAmount: intent.constraints.maxAmount,
            allowedAgent: intent.constraints.agentId,
          },
        },
        estimatedGas: 100000n,
      },
      {
        id: '2',
        type: 'api_call',
        target: '/api/webrtc/initiate',
        data: {
          agentId: intent.constraints.agentId,
          sessionKey: '${step1.output}',
        },
        estimatedGas: 0n,
      },
    ];

    return {
      steps,
      totalEstimatedCost: intent.constraints.maxAmount || 0n,
      fallbackActions: [
        {
          condition: 'session_key_creation_fails',
          action: {
            id: 'fallback_1',
            type: 'api_call',
            target: '/api/payments/escrow',
            data: { amount: intent.constraints.maxAmount },
            estimatedGas: 0n,
          },
        },
      ],
    };
  }

  private planAuthorizePayment(intent: Intent): ExecutionPlan {
    return {
      steps: [
        {
          id: '1',
          type: 'contract_call',
          target: '0xSmartWallet',
          data: {
            method: 'authorizeSession',
            params: {
              maxAmount: intent.constraints.maxAmount,
              agentId: intent.constraints.agentId,
              expiry: intent.expiry,
            },
          },
          estimatedGas: 80000n,
        },
      ],
      totalEstimatedCost: intent.constraints.maxAmount || 0n,
      fallbackActions: [],
    };
  }

  private planEndCall(intent: Intent): ExecutionPlan {
    return {
      steps: [
        {
          id: '1',
          type: 'api_call',
          target: '/api/calls/end',
          data: { callId: intent.context.callId },
          estimatedGas: 0n,
        },
        {
          id: '2',
          type: 'contract_call',
          target: '0xSmartWallet',
          data: {
            method: 'settlePayment',
            params: {
              callId: intent.context.callId,
              actualAmount: '${step1.actualAmount}',
            },
          },
          estimatedGas: 120000n,
          condition: 'step1.success',
        },
        {
          id: '3',
          type: 'contract_call',
          target: '0xSmartWallet',
          data: {
            method: 'revokeSession',
          },
          estimatedGas: 50000n,
        },
      ],
      totalEstimatedCost: 0n,
      fallbackActions: [
        {
          condition: 'settle_fails',
          action: {
            id: 'fallback_dispute',
            type: 'api_call',
            target: '/api/disputes/auto-file',
            data: { callId: intent.context.callId },
            estimatedGas: 0n,
          },
        },
      ],
    };
  }

  /**
   * Execute plan via user's smart contract wallet
   * NO PRIVATE KEYS - User signs via their wallet
   */
  async executePlan(
    plan: ExecutionPlan,
    userWallet: Address
  ): Promise<{
    success: boolean;
    txHashes: Hash[];
    results: any[];
  }> {
    const results: any[] = [];
    const txHashes: Hash[] = [];

    for (const step of plan.steps) {
      try {
        // For contract calls, we create a UserOperation (ERC-4337)
        // User signs it with their wallet (MetaMask, Rainbow, etc.)
        // Cloud agent just submits it to bundler
        
        if (step.type === 'contract_call') {
          const userOp = await this.createUserOperation(step, userWallet);
          
          // Return to user for signing - NEVER sign ourselves!
          return {
            success: false,
            txHashes,
            results: [...results, {
              step: step.id,
              requiresUserSignature: true,
              userOp,
            }],
          };
        }

        // API calls don't need signing
        if (step.type === 'api_call') {
          const result = await fetch(step.target as string, {
            method: 'POST',
            body: JSON.stringify(step.data),
          });
          results.push(await result.json());
        }
      } catch (error) {
        // Try fallback
        const fallback = plan.fallbackActions.find(
          f => f.condition.includes(step.id)
        );
        if (fallback) {
          console.log(`[Intent] Executing fallback for step ${step.id}`);
          // Execute fallback...
        } else {
          throw error;
        }
      }
    }

    return { success: true, txHashes, results };
  }

  private async createUserOperation(
    step: ExecutionStep,
    userWallet: Address
  ): Promise<any> {
    // Create ERC-4337 UserOperation
    // This goes to user's wallet for signing
    return {
      sender: userWallet,
      target: step.target,
      callData: step.data,
      gasLimit: step.estimatedGas,
    };
  }
}

// ============================================
// Session Key Manager (User controls access)
// ============================================
export interface SessionKey {
  id: string;
  publicKey: Address;
  owner: Address;
  createdAt: number;
  expiresAt: number;
  maxAmount: bigint;
  spentAmount: bigint;
  allowedAgents: string[];
  revoked: boolean;
}

export class SessionKeyManager {
  private sessions: Map<string, SessionKey> = new Map();

  /**
   * Create new session key
   * Called by user's wallet - we never see the private key!
   */
  async createSession(params: {
    owner: Address;
    publicKey: Address;
    maxAmount: bigint;
    duration: number;
    allowedAgents: string[];
  }): Promise<SessionKey> {
    const session: SessionKey = {
      id: `session_${Date.now()}`,
      publicKey: params.publicKey,
      owner: params.owner,
      createdAt: Date.now(),
      expiresAt: Date.now() + params.duration,
      maxAmount: params.maxAmount,
      spentAmount: 0n,
      allowedAgents: params.allowedAgents,
      revoked: false,
    };

    this.sessions.set(session.id, session);

    // Store in smart contract wallet
    // await smartWallet.authorizeSession(session.publicKey, ...);

    console.log('[Session] Created:', session.id);
    return session;
  }

  /**
   * Record spend against session
   */
  async recordSpend(sessionId: string, amount: bigint): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.revoked) return false;
    if (Date.now() > session.expiresAt) return false;

    const newSpent = session.spentAmount + amount;
    if (newSpent > session.maxAmount) return false;

    session.spentAmount = newSpent;
    return true;
  }

  /**
   * Revoke session (instant)
   */
  async revokeSession(sessionId: string, owner: Address): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.owner !== owner) return false;

    session.revoked = true;
    
    // Also revoke in smart contract
    // await smartWallet.revokeSession(session.publicKey);

    console.log('[Session] Revoked:', sessionId);
    return true;
  }

  getSession(id: string): SessionKey | undefined {
    return this.sessions.get(id);
  }
}

// ============================================
// Cloud Agent Interface (TEE Attestation)
// ============================================
export interface CloudAgent {
  id: string;
  type: 'payment' | 'voice' | 'reputation' | 'dispute';
  enclavePublicKey: Address;
  attestationDocument: string; // AWS Nitro / Intel SGX attestation
  capabilities: string[];
  lastHeartbeat: number;
}

export class CloudAgentRegistry {
  private agents: Map<string, CloudAgent> = new Map();

  /**
   * Register cloud agent with attestation
   */
  async registerAgent(agent: CloudAgent): Promise<boolean> {
    // Verify attestation document
    const valid = await this.verifyAttestation(agent.attestationDocument);
    if (!valid) {
      console.error('[CloudAgent] Invalid attestation:', agent.id);
      return false;
    }

    this.agents.set(agent.id, agent);
    console.log('[CloudAgent] Registered:', agent.id, agent.type);
    return true;
  }

  /**
   * Verify TEE attestation
   * Ensures agent runs in genuine secure enclave
   */
  private async verifyAttestation(document: string): Promise<boolean> {
    // Would verify AWS Nitro or Intel SGX attestation
    // This proves:
    // 1. Code is running in genuine TEE
    // 2. Code hash matches expected
    // 3. No debugger attached
    // 4. Memory is encrypted
    
    // Mock for now
    return document.length > 100;
  }

  /**
   * Get agent by capability
   */
  getAgentForCapability(capability: string): CloudAgent | undefined {
    return Array.from(this.agents.values()).find(
      a => a.capabilities.includes(capability) && 
           Date.now() - a.lastHeartbeat < 60000 // 1 min heartbeat
    );
  }

  /**
   * Update heartbeat
   */
  heartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
    }
  }
}

// ============================================
// Utilities
// ============================================
function parseEther(value: string): bigint {
  return BigInt(Math.floor(parseFloat(value) * 1e18));
}

type Hash = `0x${string}`;

// ============================================
// Singleton Exports
// ============================================
export const intentParser = new IntentParser();
export const intentValidator = new IntentValidator();
export const intentExecutor = new IntentExecutor();
export const sessionKeyManager = new SessionKeyManager();
export const cloudAgentRegistry = new CloudAgentRegistry();
