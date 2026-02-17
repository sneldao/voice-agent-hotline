// ============================================
// Intent-Based API
// ============================================
// OpenClaw-style intent parsing and execution
// No private keys on server!

import { NextRequest, NextResponse } from 'next/server';
import { 
  intentParser, 
  intentValidator, 
  intentExecutor,
  Intent,
  IntentAction 
} from '@/lib/intent-architecture';

// ============================================
// POST /api/intents - Parse and validate intent
// ============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      input,           // Natural language or structured
      user,            // User's wallet address
      action,          // If structured
      params,          // If structured
    } = body;

    let intent: Intent | null;

    // Parse intent from natural language or structured input
    if (input) {
      intent = intentParser.parse(input, user);
    } else if (action && params) {
      intent = intentParser.parseFromUI(action as IntentAction, {
        user,
        ...params,
      });
    } else {
      return NextResponse.json(
        { error: 'Provide either "input" (natural language) or "action" + "params" (structured)' },
        { status: 400 }
      );
    }

    if (!intent) {
      return NextResponse.json(
        { error: 'Could not parse intent' },
        { status: 400 }
      );
    }

    // Validate intent
    const validation = await intentValidator.validate(intent);

    if (!validation.valid) {
      return NextResponse.json({
        intent,
        valid: false,
        risk: 'high',
        warnings: validation.warnings,
        message: 'Intent validation failed',
      }, { status: 400 });
    }

    // Create execution plan
    const plan = intentExecutor.createExecutionPlan(intent);

    return NextResponse.json({
      intent,
      valid: true,
      risk: validation.risk,
      warnings: validation.warnings,
      simulation: validation.simulation,
      plan: {
        steps: plan.steps.length,
        totalEstimatedCost: plan.totalEstimatedCost.toString(),
        steps: plan.steps.map(s => ({
          id: s.id,
          type: s.type,
          target: s.target,
          estimatedGas: s.estimatedGas.toString(),
        })),
        fallbackActions: plan.fallbackActions.length,
      },
      message: 'Intent validated. Review and confirm execution.',
    });

  } catch (error: any) {
    console.error('[API:Intents] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/intents - Execute intent (user signs)
// ============================================
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      intent,
      userSignature,   // User signs the intent
      sessionKey,      // Or uses session key
    }: {
      intent: Intent;
      userSignature?: `0x${string}`;
      sessionKey?: `0x${string}`;
    } = body;

    if (!intent) {
      return NextResponse.json(
        { error: 'Missing intent' },
        { status: 400 }
      );
    }

    // Verify signature
    if (!userSignature && !sessionKey) {
      return NextResponse.json({
        intent,
        requiresSignature: true,
        message: 'User signature required to execute intent',
        signableData: {
          domain: {
            name: 'AgentSmartWallet',
            version: '1',
            chainId: 42220,
          },
          types: {
            Intent: [
              { name: 'action', type: 'string' },
              { name: 'maxAmount', type: 'uint256' },
              { name: 'expiry', type: 'uint256' },
            ],
          },
          value: {
            action: intent.action,
            maxAmount: intent.constraints.maxAmount?.toString() || '0',
            expiry: intent.expiry,
          },
        },
      });
    }

    // Create execution plan
    const plan = intentExecutor.createExecutionPlan(intent);

    // Execute (this returns UserOperations for user to sign, we NEVER sign!)
    const execution = await intentExecutor.executePlan(plan, intent.user);

    // If requires user signature, return the UserOperation
    if (!execution.success && execution.results.some((r: any) => r.requiresUserSignature)) {
      const userOpStep = execution.results.find((r: any) => r.requiresUserSignature);
      
      return NextResponse.json({
        requiresSignature: true,
        userOperation: userOpStep.userOp,
        message: 'Please sign this transaction in your wallet',
      });
    }

    return NextResponse.json({
      success: execution.success,
      txHashes: execution.txHashes,
      results: execution.results,
      message: 'Intent executed successfully',
    });

  } catch (error: any) {
    console.error('[API:Intents:PUT] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/intents/examples - Get example intents
// ============================================
export async function GET(req: NextRequest) {
  const examples = [
    {
      description: 'Start a call with Solana Sage for 5 minutes, max $0.50',
      input: 'Call sage for 5 min with max $0.50',
      structured: {
        action: 'start_call',
        params: {
          agentId: 'agent_2101khgsy8aqfxv8yr3r9548bqrx',
          maxDuration: 300,
          maxAmount: '500000000000000000', // $0.50 in wei
        },
      },
    },
    {
      description: 'Authorize $10 for Code Reviewer',
      input: 'Authorize $10 for agent code',
      structured: {
        action: 'authorize_payment',
        params: {
          agentId: 'agent_0201khgsya1dfcgv6p5ch10995b9',
          maxAmount: '10000000000000000000', // $10 in wei
        },
      },
    },
    {
      description: 'End current call',
      input: 'End call call_123',
      structured: {
        action: 'end_call',
        params: {
          callId: 'call_123',
        },
      },
    },
  ];

  return NextResponse.json({ examples });
}
