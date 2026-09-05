import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isRetiredMarketplaceApi } from './lib/house';

const ALLOWED_HEADERS = 'Content-Type, Authorization, X-API-Key, X-Requested-With, X-Wallet-Address, X-Signature, X-Timestamp';

function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin') || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Vary', 'Origin');
  return response;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  if (request.method === 'OPTIONS') {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  if (isRetiredMarketplaceApi(request.nextUrl.pathname)) {
    return applyCorsHeaders(
      request,
      NextResponse.json(
        { error: 'marketplace_retired', message: 'Claflin is a curated brokerage house. Public broker listing, marketplace discovery, and ratings have been retired.' },
        { status: 410, headers: { 'Cache-Control': 'no-store' } },
      ),
    );
  }

  return applyCorsHeaders(request, NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
