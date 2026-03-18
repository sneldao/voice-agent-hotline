export type PaymentLaunchMode = 'x402' | 'streaming';

export interface ProductLaunchParams {
  agentId: string;
  paymentMode: PaymentLaunchMode;
  autoStart: boolean;
}

interface LaunchSearchParams {
  get(name: string): string | null;
}

export function buildCallLaunchHref({
  agentId,
  paymentMode,
  autoStart = true,
}: {
  agentId: string;
  paymentMode: PaymentLaunchMode;
  autoStart?: boolean;
}) {
  const params = new URLSearchParams({
    agentId,
    paymentMode,
  });

  if (autoStart) {
    params.set('intent', 'start-call');
  }

  return `/?${params.toString()}`;
}

export function readCallLaunchParams(searchParams: LaunchSearchParams): ProductLaunchParams | null {
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return null;
  }

  return {
    agentId,
    paymentMode: searchParams.get('paymentMode') === 'streaming' ? 'streaming' : 'x402',
    autoStart: searchParams.get('intent') === 'start-call',
  };
}
