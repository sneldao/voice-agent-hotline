import { NextRequest, NextResponse } from 'next/server';
import { isRetiredMarketplaceApi } from './lib/house';

/**
 * Central CORS layer for every /api/* route.
 *
 * (Next.js 16 "proxy" file convention — formerly "middleware".)
 *
 * Why this exists:
 * - The Claflin Vercel frontend and any embedded widgets call this API
 *   cross-origin. Previously each route had to remember
 *   to wrap responses in `withCors()` — several didn't, and NO route answered
 *   OPTIONS preflights, so browsers hard-failed with
 *   "No 'Access-Control-Allow-Origin' header" whenever the backend hiccupped.
 * - Preflights are now answered here at the edge with a 204, so they succeed
 *   even if the backend (or the upstream proxy target) is restarting.
 * - Actual responses get CORS headers stamped here too, so a route can never
 *   forget them again.
 *
 * Security notes:
 * - The API is public read + wallet-signature write; no cookies are used, so
 *   we deliberately do NOT send Access-Control-Allow-Credentials. Reflecting
 *   the request Origin is therefore safe and keeps embedded widgets working.
 * - Set CORS_ALLOWED_ORIGINS (comma-separated) to restrict to an allowlist.
 */

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS =
  'Content-Type, Authorization, X-API-Key, X-Requested-With, Accept, Accept-Version';
// Let browsers cache preflights for a day — removes a full round-trip per call.
const PREFLIGHT_MAX_AGE = '86400';

function resolveAllowOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (!origin) return '*';

  const allowList = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  // Public API: reflect any origin by default so widgets/SDK embeds anywhere.
  if (allowList.length === 0) return origin;
  return allowList.includes(origin) ? origin : allowList[0];
}

function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const allowOrigin = resolveAllowOrigin(request);
  response.headers.set('Access-Control-Allow-Origin', allowOrigin);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  response.headers.set('Access-Control-Max-Age', PREFLIGHT_MAX_AGE);
  if (allowOrigin !== '*') {
    response.headers.append('Vary', 'Origin');
  }
  return response;
}

export function proxy(request: NextRequest) {
  // Answer preflights immediately — they must succeed even when the backend
  // is down, otherwise the browser masks the real outage as a CORS error.
  if (request.method === 'OPTIONS') {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  if (isRetiredMarketplaceApi(request.nextUrl.pathname)) {
    return applyCorsHeaders(request, NextResponse.json(
      { error: 'marketplace_retired', message: 'Claflin is a curated brokerage house. Public broker listing, marketplace discovery, and ratings have been retired.' },
      { status: 410, headers: { 'Cache-Control': 'no-store' } },
    ));
  }

  const response = NextResponse.next();

  // When API_PROXY_TARGET is set, /api/* is proxied upstream (see
  // next.config.js rewrites) and the upstream stamps its own CORS headers —
  // setting them here too would produce duplicates that browsers reject.
  if (!process.env.API_PROXY_TARGET) {
    applyCorsHeaders(request, response);
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
