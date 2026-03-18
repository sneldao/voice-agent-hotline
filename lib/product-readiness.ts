export interface FeatureReadiness {
  ready: boolean;
  issues: string[];
}

export interface StreamingReadiness extends FeatureReadiness {
  receiverAddress?: string;
  directWalletSigning: boolean;
}

export function getStreamingReadiness(agentWalletAddress?: string): StreamingReadiness {
  const receiverAddress = agentWalletAddress || process.env.NEXT_PUBLIC_PLATFORM_ADDRESS;
  const issues: string[] = [];

  if (!receiverAddress) {
    issues.push('Missing agent payout address');
  }

  return {
    ready: issues.length === 0,
    issues,
    receiverAddress,
    directWalletSigning: true,
  };
}

export function getDirectPaymentReadiness(agentWalletAddress?: string): FeatureReadiness {
  const platformAddress = process.env.NEXT_PUBLIC_PLATFORM_ADDRESS;
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const issues: string[] = [];

  if (!agentWalletAddress && !platformAddress) {
    issues.push('Missing agent payout address');
  }

  if (demoMode) {
    issues.push('Running in sandbox settlement mode');
  }

  return {
    ready: issues.length === 0 || (issues.length === 1 && issues[0] === 'Running in sandbox settlement mode'),
    issues,
  };
}
