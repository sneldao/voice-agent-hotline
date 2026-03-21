// ============================================
// API Route Authentication Middleware
// ============================================
// EIP-191 signature verification for API routes
// Prevents unauthorized callers from mutating state

import { NextRequest } from 'next/server';
import { verifyMessage, hashMessage, recoverAddress } from 'viem';

/**
 * Verify that the caller owns the wallet they claim.
 * Expects headers:
 *   X-Wallet-Address: 0x...
 *   X-Signature: 0x... (EIP-191 signature of the challenge)
 *   X-Timestamp: unix timestamp
 *
 * The signed message format: "VOISSS auth: {address} at {timestamp}"
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
    const message = `VOISSS auth: ${address.toLowerCase()} at ${timestamp}`;
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
 * Verify the request is from ElevenLabs (webhook secret).
 * Expects header: X-ElevenLabs-Secret
 */
export function verifyElevenLabsWebhook(req: NextRequest): boolean {
  const secret = req.headers.get('x-elevenlabs-secret');
  const expected = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!expected) return true; // No secret configured = skip check (dev mode)
  return secret === expected;
}

/**
 * Verify API key for SDK/admin routes.
 * Expects header: X-API-Key
 */
export function verifyApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key');
  const expected = process.env.API_SECRET_KEY;
  if (!expected) return true; // No key configured = skip check (dev mode)
  return key === expected;
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
