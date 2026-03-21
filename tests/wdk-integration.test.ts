import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// WDK Wallet Integration Tests
// ============================================

describe('WDK Wallet', () => {
  it('should export WDK_CHAINS with supported chains', async () => {
    const { WDK_CHAINS } = await import('../lib/wdk-wallet');
    assert.ok(WDK_CHAINS.celo, 'Should have Celo chain config');
    assert.ok(WDK_CHAINS.plasma, 'Should have Plasma chain config');
    assert.ok(WDK_CHAINS.stable, 'Should have Stable chain config');
  });

  it('each chain config should have required fields', async () => {
    const { WDK_CHAINS } = await import('../lib/wdk-wallet');
    for (const [key, config] of Object.entries(WDK_CHAINS)) {
      assert.ok(config.chainId > 0, `${key} should have chainId`);
      assert.ok(config.name, `${key} should have name`);
      assert.ok(config.rpcUrl, `${key} should have rpcUrl`);
      assert.ok(config.usdtAddress, `${key} should have usdtAddress`);
      assert.ok(config.x402Network, `${key} should have x402Network`);
      assert.ok(config.tokenMeta.name, `${key} should have token name`);
      assert.ok(config.tokenMeta.decimals > 0, `${key} should have decimals`);
    }
  });

  it('Celo chain should use cUSD token', async () => {
    const { WDK_CHAINS } = await import('../lib/wdk-wallet');
    assert.equal(WDK_CHAINS.celo.chainId, 42220);
    assert.equal(WDK_CHAINS.celo.x402Network, 'eip155:42220');
    assert.equal(WDK_CHAINS.celo.tokenMeta.decimals, 18);
  });

  it('Plasma chain should use USD₮0 token with 6 decimals', async () => {
    const { WDK_CHAINS } = await import('../lib/wdk-wallet');
    assert.equal(WDK_CHAINS.plasma.chainId, 9745);
    assert.equal(WDK_CHAINS.plasma.x402Network, 'eip155:9745');
    assert.equal(WDK_CHAINS.plasma.tokenMeta.decimals, 6);
    assert.equal(WDK_CHAINS.plasma.tokenMeta.name, 'USDT0');
  });

  it('should export generateSeedPhrase function', async () => {
    const { generateSeedPhrase } = await import('../lib/wdk-wallet');
    assert.equal(typeof generateSeedPhrase, 'function');
  });
});

describe('WDK x402', () => {
  it('should export WDKX402Client class', async () => {
    const { WDKX402Client } = await import('../lib/wdk-x402');
    assert.equal(typeof WDKX402Client, 'function');
  });

  it('should export WDKX402Server class', async () => {
    const { WDKX402Server } = await import('../lib/wdk-x402');
    assert.equal(typeof WDKX402Server, 'function');
  });

  it('WDKX402Server should create payment requirements', async () => {
    const { WDKX402Server, WDKX402Client } = await import('../lib/wdk-x402');
    const server = new WDKX402Server('celo');
    const req = server.createPaymentRequirements({
      amount: '1000000000000000000',
      payTo: '0x1234567890abcdef1234567890abcdef12345678',
      description: 'Test payment',
    });

    assert.equal(req.x402Version, 1);
    assert.ok(req.accepts.length > 0);
    assert.equal(req.accepts[0].scheme, 'exact');
    assert.equal(req.accepts[0].network, 'eip155:42220');
  });

  it('should export createX402Fetch function', async () => {
    const { createX402Fetch } = await import('../lib/wdk-x402');
    assert.equal(typeof createX402Fetch, 'function');
  });
});
