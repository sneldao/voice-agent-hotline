import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteService, type QuoteSnapshot } from '../lib/trading/quotes';
import { parseIntent, parseAmount } from '../lib/trading/domain';
import { getDeskInstrument, DESK_INSTRUMENTS } from '../lib/trading/catalog';

const now = Date.UTC(2026, 8, 5, 12);
const stock = DESK_INSTRUMENTS[0];
const pair = stock.venuePairs[0];
const intent = { instrumentId: stock.id, side: 'buy', amount: '100', unit: 'USDC' };
const factory = '0xf8f2eb4940cfe7d13603dddd87f123820fc061ef';

function snapshot(patch: Partial<QuoteSnapshot> = {}): QuoteSnapshot {
  return {
    chainId: 8453, blockNumber: 123, blockTimestamp: now / 1000 - 2,
    token0: pair.quoteToken, token1: stock.contractAddress,
    factory, quoterFactory: factory, resolvedPool: pair.poolAddress, tickSpacing: 10,
    tokenDecimals: 8, quoteDecimals: 6, multiplier: 1000000000000000000n,
    liquidity: 10000000000n, amountOut: 43369593n,
    reference: { answer: 22995730000n, decimals: 8, updatedAt: now / 1000 - 600 },
    ...patch,
  };
}
function service(value = snapshot(), clock = () => now) {
  return createQuoteService({ read: async () => value }, clock, () => 'test-quote');
}

describe('strict intent amounts', () => {
  it('rejects invalid sides, ambiguous units, legacy USD sell sizing and arbitrary instruments', () => {
    for (const bad of [{ ...intent, side: 'BUY' }, { ...intent, unit: 'tokens' }, { ...intent, side: 'sell' }, { ...intent, amount: '1e3' }, { ...intent, amount: 'Infinity' }, { ...intent, amount: '-1' }, { ...intent, amount: '0' }, { ...intent, extra: true }]) {
      assert.throws(() => parseIntent(bad));
    }
    assert.throws(() => getDeskInstrument('NVDA'));
    assert.equal(getDeskInstrument(stock.id.toUpperCase()).id, stock.id);
  });
  it('keeps exact base units and rejects fractional units instead of rounding', () => {
    assert.equal(parseAmount('123.000001', 6), 123000001n);
    assert.equal(parseAmount('0.12345678', 8), 12345678n);
    assert.throws(() => parseAmount('0.0000001', 6));
    assert.throws(() => parseAmount('0', 8));
  });
});

describe('quote estimates, not executions', () => {
  it('binds a paper estimate to canonical identity, units, source block and request-start expiry', async () => {
    const result = await service()(intent);
    assert.equal(result.kind, 'estimate');
    assert.equal(result.mode, 'paper');
    assert.equal(result.liveExecutionEnabled, false);
    assert.equal(result.amountInRaw, '100000000');
    assert.equal(result.amountOutRaw, '43369593');
    assert.equal(result.outputAmount, '0.43369593');
    assert.equal(result.inputSymbol, 'USDC');
    assert.equal(result.blockNumber, 123);
    assert.equal(result.expiresAt, now + 30000);
    assert.equal(result.reference.status, 'observed');
  });
  it('uses token quantity for sells without a USD conversion', async () => {
    let received = 0n;
    const quote = createQuoteService({ read: async (_s, _p, side, amount) => {
      assert.equal(side, 'sell'); received = amount;
      return snapshot({ amountOut: 23000000n });
    } }, () => now, () => 'sell');
    const result = await quote({ ...intent, side: 'sell', unit: 'token', amount: '0.1' });
    assert.equal(received, 10000000n);
    assert.equal(result.outputAmount, '23');
    assert.equal(result.inputSymbol, 'NVDAc');
  });
  it('rejects zero output, wrong chain, stale blocks, mismatched decimals and forged pool identity', async () => {
    for (const patch of [
      { amountOut: 0n }, { chainId: 1 }, { blockTimestamp: now / 1000 - 300 },
      { tokenDecimals: 18 }, { quoteDecimals: 18 }, { multiplier: 0n }, { liquidity: 0n },
      { token1: pair.quoteToken }, { factory: pair.quoteToken },
      { quoterFactory: pair.quoteToken }, { resolvedPool: pair.quoteToken }, { tickSpacing: 100 },
    ]) await assert.rejects(service(snapshot(patch))(intent));
  });
  it('never labels invalid feeds fresh or guesses that an old feed means a closed session', async () => {
    for (const reference of [
      { answer: -1n, decimals: 8, updatedAt: now / 1000 },
      { answer: 1n, decimals: 8, updatedAt: now / 1000 + 60 },
      { answer: 1n, decimals: 8, updatedAt: 0 }, null,
    ]) assert.equal((await service(snapshot({ reference }))(intent)).reference.status, 'unavailable');
    const result = await service(snapshot({ reference: { answer: 1n, decimals: 8, updatedAt: now / 1000 - 100000 } }))(intent);
    assert.equal(result.reference.status, 'stale');
  });
  it('does not reset expiry after a slow RPC response', async () => {
    let calls = 0;
    await assert.rejects(service(snapshot(), () => now + (calls++ ? 31000 : 0))(intent), /expired/i);
  });
  it('does not accept caller-supplied pair/availability objects', async () => {
    await assert.rejects(service()({ ...intent, pair: { ...pair, poolAddress: pair.quoteToken } }));
    const unsupported = DESK_INSTRUMENTS.find(s => !s.quoteSupported)!;
    await assert.rejects(service()({ ...intent, instrumentId: unsupported.id }));
  });
});
