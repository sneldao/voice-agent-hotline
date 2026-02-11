'use client';

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { createThirdwebClient } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';

// ============================================
// Celo Network Configuration
// ============================================

const CELO_MAINNET = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://celoscan.io' },
  },
} as const;

const CELO_ALFAJORES = {
  id: 44787,
  name: 'Celo Alfajores',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://alfajores.forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'Alfajores CeloScan', url: 'https://alfajores.celoscan.io' },
  },
} as const;

export const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? CELO_MAINNET : CELO_ALFAJORES;

// Celo Token Addresses
export const CELO_TOKENS = {
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const,
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const,
  CELO: '0x471EcE3750Da237f93B8E339c536898b6AEDf5c7' as const,
};

// ============================================
// x402 Payment Types
// ============================================

export interface X402PaymentRequest {
  scheme: 'exact' | 'upto';
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  description: string;
  mimeType: string;
  resourceUrl?: string;
}

export interface X402PaymentProof {
  payer: string;
  amount: string;
  signature: string;
  timestamp: number;
}

export interface PaymentState {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  request: X402PaymentRequest | null;
  error: string | null;
}

interface X402ContextValue extends PaymentState {
  createPaymentRequest: (amount: string, description: string, resourceUrl?: string) => X402PaymentRequest;
  authorizePayment: (request: X402PaymentRequest) => Promise<boolean>;
  checkPayment: (paymentHeader: string) => Promise<{ valid: boolean; remaining?: string }>;
  reset: () => void;
}

// ============================================
// x402 Facilitator Service
// ============================================

class X402FacilitatorService {
  private facilitatorUrl: string;
  private client: ReturnType<typeof createThirdwebClient> | null = null;

  constructor() {
    this.facilitatorUrl = process.env.NEXT_PUBLIC_X402_FACILITATOR_URL || 'https://x402.facilitator.example.com';
  }

  async initialize(): Promise<boolean> {
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      console.warn('[x402] No THIRDWEB_SECRET_KEY configured');
      return false;
    }

    try {
      this.client = createThirdwebClient({ secretKey });
      
      // Verify facilitator is reachable
      const response = await fetch(`${this.facilitatorUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      return response.ok;
    } catch (error) {
      console.warn('[x402] Facilitator not reachable:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!process.env.THIRDWEB_SECRET_KEY && !!process.env.NEXT_PUBLIC_X402_FACILITATOR_URL;
  }

  async createPaymentIntent(
    amount: string,
    asset: string,
    description: string,
    payer: string
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'x402 facilitator not configured' };
    }

    try {
      const response = await fetch(`${this.facilitatorUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          asset,
          description,
          payer,
          network: ACTIVE_CHAIN.name.toLowerCase(),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json();
      return { success: true, paymentId: data.paymentId };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create payment' 
      };
    }
  }

  async verifyPayment(paymentId: string, proof: X402PaymentProof): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.facilitatorUrl}/api/v1/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proof),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; remaining?: string }> {
    if (!this.isConfigured()) {
      return { status: 'unknown' };
    }

    try {
      const response = await fetch(`${this.facilitatorUrl}/api/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { status: 'error' };
      }

      return await response.json();
    } catch {
      return { status: 'error' };
    }
  }
}

// Singleton facilitator instance
let facilitator: X402FacilitatorService | null = null;

function getFacilitator(): X402FacilitatorService {
  if (!facilitator) {
    facilitator = new X402FacilitatorService();
  }
  return facilitator;
}

// ============================================
// x402 Context
// ============================================

const X402Context = createContext<X402ContextValue | null>(null);

export function X402Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaymentState>({
    status: 'idle',
    request: null,
    error: null,
  });

  const account = useActiveAccount();

  const createPaymentRequest = useCallback((
    amount: string,
    description: string,
    resourceUrl?: string
  ): X402PaymentRequest => {
    const receiver = process.env.NEXT_PUBLIC_PAYMENT_RECEIVER || '';
    
    return {
      scheme: 'exact',
      network: ACTIVE_CHAIN.name.toLowerCase(),
      maxAmountRequired: (BigInt(parseFloat(amount) * 1000000)).toString(),
      payTo: receiver,
      asset: CELO_TOKENS.cUSD,
      description,
      mimeType: 'application/json',
      resourceUrl,
    };
  }, []);

  const authorizePayment = useCallback(async (
    request: X402PaymentRequest
  ): Promise<boolean> => {
    if (!account) {
      setState(prev => ({ ...prev, status: 'failed', error: 'No wallet connected' }));
      return false;
    }

    const facilitatorInstance = getFacilitator();
    
    if (!facilitatorInstance.isConfigured()) {
      setState(prev => ({ ...prev, status: 'failed', error: 'x402 not configured' }));
      return false;
    }

    try {
      setState(prev => ({ ...prev, status: 'processing', request }));

      const result = await facilitatorInstance.createPaymentIntent(
        request.maxAmountRequired,
        request.asset,
        request.description,
        account.address
      );

      if (result.success) {
        setState(prev => ({ ...prev, status: 'completed' }));
        return true;
      }

      setState(prev => ({ ...prev, status: 'failed', error: result.error || 'Payment failed' }));
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
      setState(prev => ({ ...prev, status: 'failed', error: errorMessage }));
      return false;
    }
  }, [account]);

  const checkPayment = useCallback(async (
    paymentHeader: string
  ): Promise<{ valid: boolean; remaining?: string }> => {
    const facilitatorInstance = getFacilitator();
    
    if (!facilitatorInstance.isConfigured()) {
      return { valid: false };
    }

    try {
      // Parse payment header and verify with facilitator
      const paymentId = paymentHeader; // Simplified - would parse properly in real impl
      const status = await facilitatorInstance.getPaymentStatus(paymentId);
      
      return { 
        valid: status.status === 'completed', 
        remaining: status.remaining 
      };
    } catch {
      return { valid: false };
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      request: null,
      error: null,
    });
  }, []);

  return (
    <X402Context.Provider value={{
      ...state,
      createPaymentRequest,
      authorizePayment,
      checkPayment,
      reset,
    }}>
      {children}
    </X402Context.Provider>
  );
}

export function useX402() {
  const context = useContext(X402Context);
  if (!context) {
    throw new Error('useX402 must be used within an X402Provider');
  }
  return context;
}
