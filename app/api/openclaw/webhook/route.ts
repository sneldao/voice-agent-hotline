import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * OpenClaw Webhook Endpoint
 *
 * Receives events from OpenClaw and can trigger social drafts,
 * milestone alerts, and agent stat updates.
 *
 * Supported event types:
 *   - call.completed   → draft a social post about the call
 *   - agent.milestone  → draft a milestone celebration post
 *   - social.draft     → return a ready-to-post draft for the given topic
 *
 * POST /api/openclaw/webhook
 */

interface CallCompletedPayload {
  type: 'call.completed';
  agentId: string;
  agentName: string;
  agentCategory: string;
  agentAvatar: string;
  durationSeconds: number;
  topic?: string;
}

interface AgentMilestonePayload {
  type: 'agent.milestone';
  agentId: string;
  agentName: string;
  agentAvatar: string;
  milestone: string;
  value: number;
}

interface SocialDraftPayload {
  type: 'social.draft';
  topic: string;
  platform: 'twitter' | 'farcaster';
}

type WebhookPayload = CallCompletedPayload | AgentMilestonePayload | SocialDraftPayload;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function draftCallPost(payload: CallCompletedPayload): string {
  const duration = formatDuration(payload.durationSeconds);
  const topicLine = payload.topic ? ` discussing ${payload.topic}` : '';
  return `${payload.agentAvatar} A user just spent ${duration} with ${payload.agentName}${topicLine} on @voisss_\n\nPay-per-minute AI voice calls, settled on @Arbitrum ⛓️\n\nhttps://voisss-agent-hotline.vercel.app`;
}

function draftMilestonePost(payload: AgentMilestonePayload): string {
  return `🎉 ${payload.agentAvatar} ${payload.agentName} just hit a milestone: ${payload.milestone} (${payload.value})\n\nOn-chain reputation growing 📈 — powered by ERC-8004 on @Arbitrum\n\nhttps://voisss-agent-hotline.vercel.app`;
}

function draftTopicPost(topic: string, platform: 'twitter' | 'farcaster'): string {
  const drafts: Record<string, Record<string, string>> = {
    'weekly-stats': {
      twitter: `📊 Weekly update from @voisss_\n\nVoice AI agents available 24/7 on Arbitrum:\n🪙 Solana Sage — blockchain queries\n💻 Code Reviewer — GitHub & code\n🛡️ Diversifi — stablecoin strategy\n🏗️ Clawdy — agentic infra\n\nPay per minute. No subscriptions.\nhttps://voisss-agent-hotline.vercel.app`,
      farcaster: `📊 Weekly update from Voisss\n\nVoice AI agents live on Arbitrum:\n🪙 Solana Sage · 💻 Code Reviewer · 🛡️ Diversifi · 🏗️ Clawdy\n\nPay-per-minute, settled in USDC. No subscriptions.\nhttps://voisss-agent-hotline.vercel.app`,
    },
    'new-agent': {
      twitter: `🆕 New agent just listed on @voisss_\n\nCall it now — pay per minute, settle on @Arbitrum\nhttps://voisss-agent-hotline.vercel.app`,
      farcaster: `🆕 New agent just listed on Voisss\n\nCall it now — pay per minute, settle on Arbitrum\nhttps://voisss-agent-hotline.vercel.app`,
    },
    'erc8004': {
      twitter: `🧵 What is ERC-8004?\n\nIt's an on-chain identity + reputation standard for AI agents.\n\nEvery agent on @voisss_ has:\n• An Identity NFT\n• A Reputation score (updated per call)\n• Delegation support\n\nDeployed on @Arbitrum 🏗️\nhttps://voisss-agent-hotline.vercel.app`,
      farcaster: `What is ERC-8004?\n\nOn-chain identity + reputation for AI agents.\n\nEvery Voisss agent has an Identity NFT, a Reputation score, and Delegation support — all on Arbitrum.\n\nhttps://voisss-agent-hotline.vercel.app`,
    },
    'how-it-works': {
      twitter: `🎙️ How @voisss_ works:\n\n1. Pick an AI agent\n2. Connect your wallet\n3. Call — pay per minute in USDC\n4. Hang up — payment settles via MetaMask Smart Accounts\n\nNo subscriptions. No lock-in. Just voice.\nhttps://voisss-agent-hotline.vercel.app`,
      farcaster: `How Voisss works:\n\n1. Pick an AI agent\n2. Connect wallet\n3. Call — pay per minute in USDC\n4. Hang up — settles via MetaMask Smart Accounts\n\nNo subscriptions. Just voice.\nhttps://voisss-agent-hotline.vercel.app`,
    },
  };

  const topicDrafts = drafts[topic];
  if (topicDrafts) return topicDrafts[platform] ?? topicDrafts['twitter'];
  return `✨ Check out @voisss_ — voice AI agents on Arbitrum, pay per minute.\nhttps://voisss-agent-hotline.vercel.app`;
}

export async function POST(req: NextRequest) {
  try {
    // Optional shared secret check
    const secret = req.headers.get('x-openclaw-secret');
    if (process.env.OPENCLAW_WEBHOOK_SECRET && secret !== process.env.OPENCLAW_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: WebhookPayload = await req.json();

    if (payload.type === 'call.completed') {
      // Increment totalCalls for the agent in Redis
      const agentKey = `agent:${payload.agentId}`;
      const exists = await redis.exists(agentKey);
      if (exists) {
        await redis.hincrby(agentKey, 'totalCalls', 1);
      }

      const draft = draftCallPost(payload);
      return NextResponse.json({ type: 'call.completed', draft });
    }

    if (payload.type === 'agent.milestone') {
      const draft = draftMilestonePost(payload);
      return NextResponse.json({ type: 'agent.milestone', draft });
    }

    if (payload.type === 'social.draft') {
      const draft = draftTopicPost(payload.topic, payload.platform);
      return NextResponse.json({ type: 'social.draft', topic: payload.topic, platform: payload.platform, draft });
    }

    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
  } catch (error: any) {
    console.error('[OpenClaw Webhook] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
