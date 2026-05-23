import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://voisss-agent-hotline.vercel.app',
  'https://voisss.celo.famile.xyz',
  'http://localhost:3000',
];

function getAllowedOrigin(origin: string | null): string {
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
    ...DEFAULT_ALLOWED_ORIGINS,
  ].filter((value): value is string => Boolean(value));

  if (origin && configuredOrigins.includes(origin)) {
    return origin;
  }

  return DEFAULT_ALLOWED_ORIGINS[0];
}

export function corsHeaders(req?: NextRequest): HeadersInit {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req?.headers.get('origin') ?? null),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

export function withCors(response: NextResponse, req?: NextRequest): NextResponse {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function handleOptions(req?: NextRequest): NextResponse {
  return withCors(new NextResponse(null, { status: 200 }), req);
}
