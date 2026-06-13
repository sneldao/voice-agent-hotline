// ============================================
// Delegations API
// ============================================
// User-signed delegation pattern - users pay their own gas
// GET  /api/delegations?userAddress=0x...  → active delegations for a user
// POST /api/delegations                    → create a new delegation (off-chain)
// DELETE /api/delegations?delegationId=... → revoke a delegation

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/cors';
import {
  getActiveDelegations,
  getDelegationById,
  createDelegation,
  revokeDelegation,
} from '@/lib/db';
import { parseUnits, encodeFunctionData } from 'viem';

// The VOISSS platform address that acts as delegate
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || '0x54351049081A5A64Ea93c56b666830ED5076b960';

// DelegationRegistry ABI for encoding transaction data
const DELEGATION_REGISTRY_ABI = [
  {
    name: 'createDelegation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegate', type: 'address' },
      { name: 'scope', type: 'tuple', components: [
        { name: 'canBook', type: 'bool' },
        { name: 'canOrder', type: 'bool' },
        { name: 'canSchedule', type: 'bool' },
        { name: 'canResearch', type: 'bool' },
        { name: 'maxSpend', type: 'uint256' },
        { name: 'expiresAt', type: 'uint256' },
      ]},
    ],
    outputs: [{ name: 'delegationId', type: 'bytes32' }],
  },
] as const;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    const delegationId = searchParams.get('delegationId');

    if (delegationId) {
      // Fetch a specific delegation
      const delegation = await getDelegationById(delegationId);
      if (!delegation) {
        return withCors(NextResponse.json({ error: 'Delegation not found' }, { status: 404 }), req);
      }
      return withCors(NextResponse.json({ delegation }), req);
    }

    if (!userAddress) {
      return withCors(NextResponse.json({ error: 'userAddress is required' }, { status: 400 }), req);
    }

    const delegations = await getActiveDelegations(userAddress);

    if (delegations.length === 0) {
      return withCors(NextResponse.json({ delegation: null, delegations: [] }), req);
    }

    // Return the most recent active delegation
    const latest = delegations.sort((a, b) => b.createdAt - a.createdAt)[0];
    return withCors(NextResponse.json({ delegation: latest, delegations }), req);

  } catch (error: any) {
    console.error('[API:Delegations:GET]', error);
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }), req);
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Returns unsigned transaction data for the user to sign with their wallet

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userAddress,
      scope: {
        canBook = false,
        canOrder = false,
        canSchedule = true,
        canResearch = true,
        maxSpendUSD = 10,
        maxSpendWei,
        expiresInDays = 30,
      } = {},
    } = body;

    if (!userAddress) {
      return withCors(NextResponse.json({ error: 'userAddress is required' }, { status: 400 }), req);
    }

    const delegationRegistryAddress = process.env.NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS;
    const isConfigured = delegationRegistryAddress && 
                         delegationRegistryAddress !== '0x0000000000000000000000000000000000000000';

    const maxSpend = maxSpendWei
      ? BigInt(maxSpendWei)
      : parseUnits(String(maxSpendUSD), 6);

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60);

    const delegationScope = {
      canBook,
      canOrder,
      canSchedule,
      canResearch,
      maxSpend,
      expiresAt,
    };

    let delegationId: string;
    let txData: { to: string; data: string; value: string } | null = null;

    if (isConfigured) {
      // Return unsigned transaction for user to sign
      const encodedData = encodeFunctionData({
        abi: DELEGATION_REGISTRY_ABI,
        functionName: 'createDelegation',
        args: [PLATFORM_ADDRESS as `0x${string}`, delegationScope],
      });

      txData = {
        to: delegationRegistryAddress,
        data: encodedData,
        value: '0x0',
      };

      // Generate a pending delegation ID (will be set on-chain after user signs)
      delegationId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      // Off-chain (demo mode) delegation — store in Redis
      console.log('[API:Delegations] ERC-8004 not configured, using demo delegation');
      delegationId = `demo_delegation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    // Store delegation in Redis
    const delegation = await createDelegation({
      id: delegationId,
      userId: userAddress,
      agentId: 'voisss_platform',
      scope: {
        canBook,
        canOrder,
        canSchedule,
        canResearch,
        maxSpend: Number(maxSpend) / 1e18,
      },
      status: 'active',
      expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    return withCors(
      NextResponse.json({
        delegationId,
        delegation,
        onChain: isConfigured,
        txData, // Unsigned transaction for user to sign
        platformAddress: PLATFORM_ADDRESS,
      }),
      req
    );

  } catch (error: any) {
    console.error('[API:Delegations:POST]', error);
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }), req);
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
// Returns unsigned revoke transaction for user to sign

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const delegationId = searchParams.get('delegationId');
    const userAddress = searchParams.get('userAddress');

    if (!delegationId) {
      return withCors(NextResponse.json({ error: 'delegationId is required' }, { status: 400 }), req);
    }

    // Verify ownership
    if (userAddress) {
      const delegation = await getDelegationById(delegationId);
      if (delegation && delegation.userId !== userAddress) {
        return withCors(NextResponse.json({ error: 'Not authorized to revoke this delegation' }, { status: 403 }), req);
      }
    }

    const delegationRegistryAddress = process.env.NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS;
    const isConfigured = delegationRegistryAddress && 
                         delegationRegistryAddress !== '0x0000000000000000000000000000000000000000';

    let txData: { to: string; data: string; value: string } | null = null;

    if (isConfigured && !delegationId.startsWith('demo_') && !delegationId.startsWith('pending_')) {
      // Return unsigned revoke transaction for user to sign
      const encodedData = encodeFunctionData({
        abi: [{
          name: 'revokeDelegation',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'delegationId', type: 'bytes32' }],
          outputs: [],
        }],
        functionName: 'revokeDelegation',
        args: [delegationId as `0x${string}`],
      });

      txData = {
        to: delegationRegistryAddress,
        data: encodedData,
        value: '0x0',
      };
    }

    // Revoke in Redis
    await revokeDelegation(delegationId);

    return withCors(
      NextResponse.json({ 
        success: true, 
        delegationId,
        onChain: isConfigured,
        txData, // Unsigned transaction for user to sign (if needed)
      }),
      req
    );

  } catch (error: any) {
    console.error('[API:Delegations:DELETE]', error);
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }), req);
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
