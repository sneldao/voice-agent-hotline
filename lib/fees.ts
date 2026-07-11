/**
 * Marketplace fee constants — single source of truth.
 *
 * On-chain split (atomic 80/20) requires a PaymentRouter contract (planned).
 * Until then, a single USDC transfer settles the call; the 80/20 split is
 * ledgered in Redis for agent payout accounting only.
 */

export const AGENT_SHARE_BPS = 8000;
export const PLATFORM_SHARE_BPS = 2000;
export const FEE_BPS_DENOMINATOR = 10_000;

/** Human-readable percent (80 / 20) for UI and logs. */
export const AGENT_SHARE_PERCENT = AGENT_SHARE_BPS / 100;
export const PLATFORM_SHARE_PERCENT = PLATFORM_SHARE_BPS / 100;

export interface RevenueSplit {
  total: number;
  agentShare: number;
  platformShare: number;
  agentBps: number;
  platformBps: number;
  /** true when both legs are on-chain; false when ledger-only */
  onChainSplit: boolean;
}

/**
 * Split a gross amount (USDC human units or raw token units as number).
 * Uses integer BPS math when total is an integer token unit amount.
 */
export function splitRevenue(total: number): RevenueSplit {
  if (!Number.isFinite(total) || total <= 0) {
    return {
      total: 0,
      agentShare: 0,
      platformShare: 0,
      agentBps: AGENT_SHARE_BPS,
      platformBps: PLATFORM_SHARE_BPS,
      onChainSplit: false,
    };
  }

  // Prefer integer path for raw USDC (6 decimals) amounts expressed as numbers
  if (Number.isInteger(total)) {
    const agentShare = Math.floor((total * AGENT_SHARE_BPS) / FEE_BPS_DENOMINATOR);
    const platformShare = total - agentShare;
    return {
      total,
      agentShare,
      platformShare,
      agentBps: AGENT_SHARE_BPS,
      platformBps: PLATFORM_SHARE_BPS,
      onChainSplit: false,
    };
  }

  const agentShare = (total * AGENT_SHARE_BPS) / FEE_BPS_DENOMINATOR;
  const platformShare = total - agentShare;
  return {
    total,
    agentShare,
    platformShare,
    agentBps: AGENT_SHARE_BPS,
    platformBps: PLATFORM_SHARE_BPS,
    onChainSplit: false,
  };
}

/** Split a bigint token amount (e.g. USDC 6 decimals). */
export function splitRevenueWei(total: bigint): {
  agentShare: bigint;
  platformShare: bigint;
  onChainSplit: false;
} {
  const agentShare = (total * BigInt(AGENT_SHARE_BPS)) / BigInt(FEE_BPS_DENOMINATOR);
  const platformShare = total - agentShare;
  return { agentShare, platformShare, onChainSplit: false };
}
