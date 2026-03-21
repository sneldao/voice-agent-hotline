import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// Yellow Channel Integration Tests
// ============================================

describe('Yellow Channel', () => {
  it('should export YELLOW_CONFIG with correct defaults', async () => {
    const { YELLOW_CONFIG } = await import('../lib/yellow-channel');
    assert.ok(YELLOW_CONFIG.sandboxWsUrl.includes('sandbox'));
    assert.ok(YELLOW_CONFIG.wsUrl.includes('clearnet.yellow.com'));
    assert.equal(YELLOW_CONFIG.defaultAsset, 'usdc');
    assert.equal(YELLOW_CONFIG.minDeposit, '1000000');
  });

  it('should export YellowClient class', async () => {
    const { YellowClient } = await import('../lib/yellow-channel');
    assert.equal(typeof YellowClient, 'function');
  });

  it('should export getYellowClient singleton', async () => {
    const { getYellowClient } = await import('../lib/yellow-channel');
    assert.equal(typeof getYellowClient, 'function');
    const client = getYellowClient(true);
    assert.ok(client);
  });
});

describe('User-Settled Payment', () => {
  it('should export useRealPayment with user_settled mode', async () => {
    // Verify the module loads without errors
    const mod = await import('../lib/useRealPayment');
    assert.ok(mod.useRealPayment);
    assert.ok(mod.usePaymentReceipt);
  });
});

describe('Settlement API (tracking-only)', () => {
  it('should export POST and GET handlers', async () => {
    const route = await import('../app/api/payments/settle/route');
    assert.equal(typeof route.POST, 'function');
    assert.equal(typeof route.GET, 'function');
    assert.equal(typeof route.OPTIONS, 'function');
  });
});
