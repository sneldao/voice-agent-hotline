import { TradingError } from './domain';
import type { QuoteEstimate } from './domain';

export function createQuoteHandler(quote: (input: unknown) => Promise<QuoteEstimate>, allow = () => true) {
  let active = 0;
  return async (req: Request): Promise<Response> => {
    const headers = { 'Cache-Control': 'no-store' };
    if (active >= 2 || !allow()) return Response.json({ error: 'busy', message: 'Too many quote requests. Please wait a moment.' }, { status: 429, headers: { ...headers, 'Retry-After': '10' } });
    const params = new URL(req.url).searchParams;
    if ([...params.keys()].some(key => !['instrumentId', 'side', 'amount', 'unit'].includes(key)) || [...params.keys()].some(key => params.getAll(key).length !== 1)) {
      return Response.json({ error: 'invalid_request', message: 'Use instrumentId, side, amount and unit. Legacy sizeUsd requests are not supported.' }, { status: 400, headers });
    }
    active++;
    try {
      const result = await quote(Object.fromEntries(params));
      return Response.json(result, { headers });
    } catch (error) {
      const known = error instanceof TradingError;
      return Response.json({ error: known ? error.code : 'quote_unavailable', message: known ? error.message : 'Quote service unavailable. Please retry.' }, { status: known ? error.status : 503, headers });
    } finally { active--; }
  };
}

export function quoteBudget(clock = Date.now) {
  let reset = 0;
  let count = 0;
  return () => {
    const now = clock();
    if (now >= reset) { count = 0; reset = now + 60000; }
    return ++count <= 60;
  };
}
