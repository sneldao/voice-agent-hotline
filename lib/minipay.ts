// ============================================
// MiniPay Integration
// ============================================
// Detects the Celo MiniPay environment and provides wallet helpers.
// MiniPay is Opera Mini's embedded Celo wallet, injected as window.ethereum
// with isMiniPay = true.
//
// Docs: https://docs.celo.org/developer/build-on-minipay/overview
//
// Usage (client components only):
//   import { isMiniPay, getMiniPayAddress, requestMiniPayPayment } from '@/lib/minipay';

// ──────────────────────────────────────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the app is running inside the MiniPay browser.
 * Safe to call during SSR (returns false).
 */
export function isMiniPay(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as any).ethereum;
  return !!(eth?.isMiniPay);
}

/**
 * Returns true if the user agent suggests a mobile Celo wallet environment
 * (MiniPay, Valora, etc.). Useful for showing a simplified payment UX.
 */
export function isCeloMobileWallet(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMiniPay()) return true;
  const ua = navigator.userAgent ?? '';
  return /Valora|CeloWallet|MiniPay/i.test(ua);
}

// ──────────────────────────────────────────────────────────────────────────────
// Address resolution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Requests the connected account from the injected MiniPay / Celo provider.
 * Returns null if not in MiniPay or if access is denied.
 */
export async function getMiniPayAddress(): Promise<string | null> {
  if (!isMiniPay()) return null;
  try {
    const eth = (window as any).ethereum;
    const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Payment helpers
// ──────────────────────────────────────────────────────────────────────────────

export interface MiniPayPaymentParams {
  /** Recipient address (e.g. agent wallet or facilitator) */
  to: string;
  /** Amount in cUSD (human-readable, e.g. 0.25) */
  amountCUSD: number;
  /** Optional memo / reference */
  memo?: string;
}

// cUSD contract address on Celo mainnet
const CUSD_MAINNET = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
// cUSD contract address on Celo Sepolia testnet
const CUSD_TESTNET = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';

function getCUSDAddress(): string {
  // Use testnet address in development
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    return CUSD_TESTNET;
  }
  return CUSD_MAINNET;
}

/**
 * ERC-20 transfer ABI fragment — used to encode the calldata.
 */
function encodeTransfer(to: string, amountWei: bigint): string {
  // transfer(address,uint256) selector = 0xa9059cbb
  const selector = 'a9059cbb';
  const paddedTo = to.replace('0x', '').padStart(64, '0');
  const paddedAmount = amountWei.toString(16).padStart(64, '0');
  return `0x${selector}${paddedTo}${paddedAmount}`;
}

/**
 * Send a cUSD payment via MiniPay's injected Celo provider.
 * Returns the transaction hash on success.
 *
 * Graceful failure: if not in MiniPay, throws a descriptive error so the
 * calling component can fall back to the standard x402 / Superfluid flow.
 */
export async function requestMiniPayPayment(params: MiniPayPaymentParams): Promise<string> {
  if (!isMiniPay()) {
    throw new Error('MiniPay is not available in this browser. Use the standard payment flow.');
  }

  const eth = (window as any).ethereum;
  const from = await getMiniPayAddress();
  if (!from) throw new Error('Could not get MiniPay account address.');

  const amountWei = BigInt(Math.round(params.amountCUSD * 1e18));
  const cusd = getCUSDAddress();
  const data = encodeTransfer(params.to, amountWei);

  const txHash: string = await eth.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: cusd,
      data,
      // MiniPay handles gas automatically — omit gasPrice / gasLimit
    }],
  });

  return txHash;
}

// ──────────────────────────────────────────────────────────────────────────────
// React hook
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

export interface MiniPayState {
  /** True when running inside MiniPay */
  isMiniPayEnv: boolean;
  /** User's wallet address (auto-resolved in MiniPay, null otherwise) */
  address: string | null;
  /** True while resolving the address on first mount */
  isLoading: boolean;
}

export function useMiniPay(): MiniPayState {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const miniPayEnv = isMiniPay();

  useEffect(() => {
    if (!miniPayEnv) return;
    setIsLoading(true);
    getMiniPayAddress()
      .then(setAddress)
      .finally(() => setIsLoading(false));
  }, [miniPayEnv]);

  return { isMiniPayEnv: miniPayEnv, address, isLoading };
}
