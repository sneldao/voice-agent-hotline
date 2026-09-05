import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOKENIZED_STOCKS,
  getInstrumentByAddress,
  resolveInstrument,
  tradableInstruments,
} from '../lib/tokenized-stocks';
import { encodeClPath, getTradablePair } from '../lib/aerodrome-adapter';
import { BASE_USDC } from '../lib/base-chain';

describe('instrument catalog integrity', () => {
  it('keys every instrument by a valid B20-prefixed contract address', () => {
    for (const s of TOKENIZED_STOCKS) {
      assert.match(s.contractAddress, /^0xb200[0-9a-fA-F]{36}$/i);
      assert.ok(s.chainlinkFeed.startsWith('0x'));
      // B20 decimals are per-token configurable; unverified
      // entries must be null so adapters read them onchain.
      if (s.availability === 'quote_candidate') assert.equal(s.decimals, 8);
      else assert.equal(s.decimals, null);
    }
  });

  it('has no duplicate contract addresses or symbols', () => {
    const addrs = TOKENIZED_STOCKS.map((s) => s.contractAddress.toLowerCase());
    assert.equal(new Set(addrs).size, addrs.length);
    const symbols = TOKENIZED_STOCKS.map((s) => s.symbol.toLowerCase());
    assert.equal(new Set(symbols).size, symbols.length);
  });
});

describe('instrument resolution', () => {
  it('resolves by exact contract address regardless of case', () => {
    const stock = getInstrumentByAddress(
      '0xB20000000000000000000078EE7CE2FE4908108C',
    );
    assert.equal(stock?.symbol, 'NVDAc');
  });

  it('resolves tokenized and underlying tickers to the canonical entry', () => {
    assert.equal(resolveInstrument('NVDAc').instrument?.symbol, 'NVDAc');
    assert.equal(
      resolveInstrument('nvda').instrument?.contractAddress,
      '0xb20000000000000000000078ee7ce2fE4908108C',
    );
    assert.equal(resolveInstrument('NVIDIA Corporation').instrument?.symbol, 'NVDAc');
  });

  it('rejects unknown or lookalike queries instead of searching', () => {
    assert.equal(resolveInstrument('NVDIA').instrument, null);
    assert.equal(resolveInstrument('NVDIA').reason, 'not_on_this_desk');
    assert.equal(resolveInstrument('nvda fake').instrument, null);
    assert.equal(resolveInstrument('').reason, 'empty_query');
    assert.equal(getInstrumentByAddress('0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9'), undefined); // pool, not token
  });
});

describe('availability gating', () => {
  it('only the four verified-liquidity names are tradable', () => {
    const tradable = tradableInstruments().map((s) => s.symbol);
    assert.deepEqual(tradable.sort(), ['AAPLc', 'GOOGLc', 'METAc', 'NVDAc']);
  });

  it('tradable instruments always carry a verified USDC venue pair', () => {
    for (const s of tradableInstruments()) {
      const res = getTradablePair(s);
      assert.ok('pair' in res, `${s.symbol} should have a USDC pair`);
      if ('pair' in res) {
        assert.equal(res.pair.venue, 'aerodrome');
        assert.equal(res.pair.quoteSymbol, 'USDC');
        assert.ok(res.pair.liquidityUsdAtVerification > 0);
      }
    }
  });

  it('blocks quotes for thin or unverified instruments', () => {
    const tsla = TOKENIZED_STOCKS.find((s) => s.symbol === 'TSLAc')!;
    assert.deepEqual(getTradablePair(tsla), { error: 'insufficient_liquidity' });
    const amzn = TOKENIZED_STOCKS.find((s) => s.symbol === 'AMZNc')!;
    assert.deepEqual(getTradablePair(amzn), { error: 'not_on_this_desk' });
  });
});

describe('CL path encoding', () => {
  it('packs tokenIn + int24 (tickSpacing | factory bitmask) + tokenOut', () => {
    const nvdac = TOKENIZED_STOCKS.find((s) => s.symbol === 'NVDAc')!;
    const pair = nvdac.venuePairs[0];
    const path = encodeClPath(BASE_USDC, pair, nvdac.contractAddress);
    // 20-byte addr + 3-byte filler + 20-byte addr = 43 bytes = 86 hex chars
    assert.equal(path.length, 2 + 86);
    assert.ok(path.startsWith('0x' + BASE_USDC.slice(2).toLowerCase()));
    assert.ok(path.endsWith(nvdac.contractAddress.slice(2).toLowerCase()));
    // filler = tickSpacing(10) | cl2(1<<19) = 0x8000a
    assert.equal(path.slice(2 + 40, 2 + 46), '08000a');
  });
});
