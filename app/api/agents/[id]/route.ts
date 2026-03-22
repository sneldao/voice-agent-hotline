import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celoAlfajores, celo } from 'viem/chains';

export const dynamic = 'force-dynamic';

// GET /api/agents/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await redis.hgetall(`agent:${params.id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/agents/[id] — approve, reject, or general field updates
// Approve:  { action: 'approve' }
// Reject:   { action: 'reject', reason?: string }
// Update:   { field: value, ... }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await redis.hgetall(`agent:${params.id}`);
    if (!agent || Object.keys(agent).length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, reason, ...fields } = body;

    if (action === 'approve') {
      let erc8004TokenId: string | null = null;

      // Auto-mint ERC-8004 Identity NFT if contracts are configured and facilitator key exists
      const identityAddress = process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS;
      const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY;
      if (
        identityAddress &&
        identityAddress !== '0x0000000000000000000000000000000000000000' &&
        facilitatorKey
      ) {
        try {
          const chain = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
          const rpcUrl = process.env.NODE_ENV === 'production'
            ? 'https://forno.celo.org'
            : 'https://alfajores-forno.celo-testnet.org';
          const account = privateKeyToAccount(facilitatorKey as `0x${string}`);
          const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
          const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

          const IDENTITY_ABI = [
            {
              name: 'registerAgent',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'agentURI', type: 'string' },
                { name: 'ratePerMinute', type: 'uint256' },
                { name: 'specialties', type: 'string[]' },
              ],
              outputs: [{ name: 'tokenId', type: 'uint256' }],
            },
          ] as const;

          const ratePerMinute = parseEther(String(agent.rate || '0.10'));
          const specialties = agent.category ? [String(agent.category)] : ['general'];
          const agentURI = `https://voisss.celo.famile.xyz/api/agents/${params.id}`;

          const hash = await walletClient.writeContract({
            address: identityAddress as `0x${string}`,
            abi: IDENTITY_ABI,
            functionName: 'registerAgent',
            args: [agentURI, ratePerMinute, specialties],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          // Extract tokenId from logs (first topic of Transfer event)
          const tokenId = receipt.logs?.[0]?.topics?.[3]
            ? BigInt(receipt.logs[0].topics[3]).toString()
            : null;
          erc8004TokenId = tokenId;
          console.log('[Agents API] ERC-8004 minted, tokenId:', tokenId, 'tx:', hash);
        } catch (mintErr: any) {
          console.warn('[Agents API] ERC-8004 mint failed (non-fatal):', mintErr.message);
        }
      }

      await redis.hset(`agent:${params.id}`, {
        status: 'active',
        active: 'true',
        approved_at: new Date().toISOString(),
        ...(erc8004TokenId ? { erc8004_token_id: erc8004TokenId } : {}),
      });
      console.log('[Agents API] Approved agent:', params.id);
      return NextResponse.json({ message: 'Agent approved', id: params.id, erc8004TokenId });
    }

    if (action === 'reject') {
      await redis.hset(`agent:${params.id}`, {
        status: 'rejected',
        active: 'false',
        rejection_reason: reason || '',
        rejected_at: new Date().toISOString(),
      });
      console.log('[Agents API] Rejected agent:', params.id);
      return NextResponse.json({ message: 'Agent rejected', id: params.id });
    }

    if (Object.keys(fields).length > 0) {
      await redis.hset(`agent:${params.id}`, fields);
    }

    const updated = await redis.hgetall(`agent:${params.id}`);
    return NextResponse.json({ agent: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/agents/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await redis.del(`agent:${params.id}`);
    if (!deleted) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Agent deleted', id: params.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
