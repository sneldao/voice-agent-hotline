import { TOKENIZED_STOCKS, type TokenizedStock, type VenuePair } from '../tokenized-stocks';
import { TradingError } from './domain';

export type DeskInstrument = Readonly<Omit<TokenizedStock, 'availability' | 'availabilityNote' | 'venuePairs'> & {
  id: string;
  chainId: 8453;
  quoteSupported: boolean;
  liveExecutionEnabled: false;
  venuePairs: readonly Readonly<VenuePair>[];
}>;

export const DESK_INSTRUMENTS: readonly DeskInstrument[] = Object.freeze(TOKENIZED_STOCKS.map(stock => {
  const { availability, availabilityNote: _note, venuePairs, ...identity } = stock;
  return Object.freeze({
    ...identity,
    id: `8453:${stock.contractAddress.toLowerCase()}`,
    chainId: 8453 as const,
    quoteSupported: availability === 'quote_candidate' && stock.decimals !== null && venuePairs.length > 0,
    liveExecutionEnabled: false as const,
    venuePairs: Object.freeze(venuePairs.map(pair => Object.freeze({ ...pair }))),
  });
}));

export function getDeskInstrument(id: string): DeskInstrument {
  const stock = DESK_INSTRUMENTS.find(s => s.id === id.toLowerCase());
  if (!stock) throw new TradingError('unknown_instrument', 'This product is outside Hetty’s Base catalog.', 404);
  return stock;
}

export function getQuotePair(stock: DeskInstrument): Readonly<VenuePair> {
  const canonical = getDeskInstrument(stock.id);
  const pair = canonical.venuePairs.find(p => p.quoteSymbol === 'USDC');
  if (!canonical.quoteSupported || !pair) throw new TradingError('coverage_pending', 'Quote coverage for this instrument has not been verified.', 422);
  return pair;
}

export function resolveDeskAlias(query: string): DeskInstrument | undefined {
  const alias = query.trim().toLowerCase();
  const names: Record<string, string> = { nvidia: 'NVDAc', apple: 'AAPLc', meta: 'METAc', google: 'GOOGLc', alphabet: 'GOOGLc' };
  return DESK_INSTRUMENTS.find(s => s.id === alias || s.contractAddress.toLowerCase() === alias || s.symbol.toLowerCase() === alias || s.underlyingSymbol.toLowerCase() === alias || s.name.toLowerCase() === alias || s.symbol === names[alias]);
}
