// ============================================
// API Route Authentication Middleware
// ============================================
// EIP-191 signature verification for API routes
// Prevents unauthorized callers from mutating state

import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage, hashMessage, recoverAddress } from 'viem';

/**
 * Verify that the caller owns the wallet they claim.
 * Expects headers:
 *   X-Wallet-Address: 0x...
 *   X-Signature: 0x... (EIP-191 signature of the challenge)
 *   X-Timestamp: unix timestamp
 *
 * The signed message format: "Claflin auth: {address} at {timestamp}"
 */
export async function verifyWalletAuth(req: NextRequest): Promise<{
  authenticated: boolean;
  address?: string;
  error?: string;
}> {
  const address = req.headers.get('x-wallet-address');
  const signature = req.headers.get('x-signature');
  const timestamp = req.headers.get('x-timestamp');

  if (!address || !signature || !timestamp) {
    return {
      authenticated: false,
      error: 'Missing auth headers: X-Wallet-Address, X-Signature, X-Timestamp',
    };
  }

  // Reject if timestamp is > 5 minutes old (replay protection)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return { authenticated: false, error: 'Auth timestamp expired or invalid' };
  }

  try {
    const message = `Claflin auth: ${address.toLowerCase()} at ${timestamp}`;
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return { authenticated: false, error: 'Signature verification failed' };
    }

    return { authenticated: true, address: address.toLowerCase() };
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : 'Auth verification error',
    };
  }
}

/**
 * Verify that the caller is an admin wallet.
 * Uses the same EIP-191 signature as verifyWalletAuth, but also checks
 * that the wallet is in NEXT_PUBLIC_ADMIN_WALLETS.
 *
 * Expects headers:
 *   X-Wallet-Address: 0x...
 *   X-Signature: 0x... (EIP-191 signature of the challenge)
 *   X-Timestamp: unix timestamp
 */
export async function verifyAdminWalletAuth(req: NextRequest): Promise<{
  authenticated: boolean;
  address?: string;
  error?: string;
}> {
  const auth = await verifyWalletAuth(req);
  if (!auth.authenticated) return auth;

  const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '')
    .toLowerCase()
    .split(',')
    .filter(Boolean);

  if (adminWallets.length === 0) {
    return { authenticated: false, error: 'Admin wallets not configured' };
  }

  if (!adminWallets.includes(auth.address!)) {
    return { authenticated: false, error: 'Wallet not authorized as admin' };
  }

  return auth;
}

/**
 * Require admin wallet auth — returns 401 NextResponse if unauthorized, null if authorized.
 * Use as: const auth = await requireAdminWalletAuth(req); if (auth) return auth;
 */
export async function requireAdminWalletAuth(req: NextRequest): Promise<NextResponse | null> {
  const auth = await verifyAdminWalletAuth(req);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Verify the request is from ElevenLabs (webhook secret).
 * Expects header: X-ElevenLabs-Secret
 *
 * In production, rejects all requests when no secret is configured.
 * In development, allows requests when no secret is configured (with warning).
 */
export function verifyElevenLabsWebhook(req: NextRequest): boolean {
  const secret = req.headers.get('x-elevenlabs-secret');
  const expected = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Auth] ELEVENLABS_WEBHOOK_SECRET is not set — rejecting webhook in production');
      return false;
    }
    console.warn('[Auth] ELEVENLABS_WEBHOOK_SECRET is not set — allowing webhook in dev mode');
    return true;
  }
  return secret === expected;
}

/**
 * Verify API key for SDK/admin routes.
 * Expects header: X-API-Key
 */
export function verifyApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key');
  const expected = process.env.API_SECRET_KEY;
  if (!expected) return false; // Fail closed — must configure API_SECRET_KEY
  return key === expected;
}

/**
 * Require admin auth — returns 401 NextResponse if unauthorized, null if authorized.
 * Use as: const auth = requireAdminAuth(req); if (auth) return auth;
 */
export function requireAdminAuth(req: NextRequest): NextResponse | null {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Verify wallet signature for voice call token requests.
 * Signed message: "voice-call:{callId}:{agentId}:{timestamp}"
 */
export async function verifyVoiceCallAuth(
  headers: Headers,
  callId: string,
  agentId: string
): Promise<{ authenticated: boolean; address?: string; error?: string }> {
  const address = headers.get('x-wallet-address');
  const signature = headers.get('x-signature');
  const timestamp = headers.get('x-timestamp');

  if (!address || !signature || !timestamp) {
    return { authenticated: false, error: 'Missing auth headers' };
  }

  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return { authenticated: false, error: 'Auth timestamp expired' };
  }

  try {
    const message = `voice-call:${callId}:${agentId}:${timestamp}`;
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return valid
      ? { authenticated: true, address: address.toLowerCase() }
      : { authenticated: false, error: 'Invalid signature' };
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : 'Verification error',
    };
  }
}

/**
 * Rate limit check using Redis.
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<boolean> {
  try {
    const { redis } = await import('./redis');
    const key = `ratelimit:${identifier}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= maxRequests;
  } catch {
    // Redis unavailable = allow (fail open)
    return true;
  }
}
