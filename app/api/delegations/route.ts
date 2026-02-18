// ============================================
// Delegations API
// ============================================
// Bridges the DelegationPanel UI with the ERC-8004 delegation service.
// GET  /api/delegations?userAddress=0x...  → active delegations for a user
// POST /api/delegations                    → create a new delegation
// DELETE /api/delegations?delegationId=... → revoke a delegation

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { erc8004Service } from '@/lib/erc8004';
import {
  getActiveDelegations,
  getDelegationById,
  createDelegation,
  revokeDelegation,
} from '@/lib/db';
import { parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// The VOISSS platform address that acts as delegate
function getPlatformAddress() {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key || !key.startsWith('0x') || key.length !== 66) return process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ?? null;
  return privateKeyToAccount(key as `0x${string}`).address;
}

function getFacilitatorWallet() {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key || !key.startsWith('0x') || key.length !== 66) return null;
  const account = privateKeyToAccount(key as `0x${string}`);
  const chain = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
  return createWalletClient({
    account,
    chain,
    transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org'),
  });
}

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
        return NextResponse.json({ error: 'Delegation not found' }, { status: 404 });
      }
      return NextResponse.json({ delegation });
    }

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const delegations = await getActiveDelegations(userAddress);

    if (delegations.length === 0) {
      return NextResponse.json({ delegation: null, delegations: [] });
    }

    // Return the most recent active delegation
    const latest = delegations.sort((a, b) => b.createdAt - a.createdAt)[0];
    return NextResponse.json({ delegation: latest, delegations });

  } catch (error: any) {
    console.error('[API:Delegations:GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

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
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const platformAddress = getPlatformAddress();
    if (!platformAddress) {
      return NextResponse.json(
        { error: 'Platform address not configured (set FACILITATOR_PRIVATE_KEY or NEXT_PUBLIC_PLATFORM_ADDRESS)' },
        { status: 503 }
      );
    }

    const maxSpend = maxSpendWei
      ? BigInt(maxSpendWei)
      : parseEther(String(maxSpendUSD));

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60);

    const delegationScope = {
      canBook,
      canOrder,
      canSchedule,
      canResearch,
      maxSpend,
      expiresAt,
    };

    // Check if ERC-8004 contracts are configured
    const config = erc8004Service.checkConfiguration();

    let delegationId: string;

    if (config.configured) {
      // On-chain delegation via ERC-8004 contract
      const wallet = getFacilitatorWallet();
      if (!wallet) {
        return NextResponse.json(
          { error: 'FACILITATOR_PRIVATE_KEY is required for on-chain delegation' },
          { status: 503 }
        );
      }

      const result = await erc8004Service.createDelegation(
        wallet as any,
        platformAddress as `0x${string}`,
        delegationScope
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      delegationId = result.delegationId!;
    } else {
      // Off-chain (demo mode) delegation — store in Redis
      console.log('[API:Delegations] ERC-8004 not configured, using demo delegation');
      delegationId = `demo_delegation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    // Always persist to Redis for the app to read
    const delegation = await createDelegation({
      id: delegationId,
      userId: userAddress,
      agentId: 'voisss_platform',
      scope: {
        canBook,
        canOrder,
        canSchedule,
        canResearch,
        maxSpend: Number(maxSpend) / 1e18, // store as USD equivalent
      },
      status: 'active',
      expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      delegationId,
      delegation,
      onChain: config.configured,
    });

  } catch (error: any) {
    console.error('[API:Delegations:POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const delegationId = searchParams.get('delegationId');
    const userAddress = searchParams.get('userAddress');

    if (!delegationId) {
      return NextResponse.json({ error: 'delegationId is required' }, { status: 400 });
    }

    // Verify ownership
    if (userAddress) {
      const delegation = await getDelegationById(delegationId);
      if (delegation && delegation.userId !== userAddress) {
        return NextResponse.json({ error: 'Not authorized to revoke this delegation' }, { status: 403 });
      }
    }

    // Revoke on-chain if ERC-8004 configured and key available
    const config = erc8004Service.checkConfiguration();
    const wallet = getFacilitatorWallet();

    if (config.configured && wallet && !delegationId.startsWith('demo_')) {
      try {
        await erc8004Service.revokeDelegation(wallet as any, delegationId as `0x${string}`);
      } catch (err) {
        console.warn('[API:Delegations:DELETE] On-chain revoke failed (non-fatal):', err);
      }
    }

    // Always revoke in Redis
    await revokeDelegation(delegationId);

    return NextResponse.json({ success: true, delegationId });

  } catch (error: any) {
    console.error('[API:Delegations:DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
