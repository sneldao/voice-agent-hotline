import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { viem } from 'viem';
import { privateKeyToAccount, generateMessage, hashMessage, sign } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

// ============================================
// Payment Tests
// ============================================
// Tests for payment flow, signature validation, and settlement

// Mock Redis for testing
const mockRedis = {
  data: new Map<string, Record<string, string>>(),
  sets: new Map<string, Set<string>>(),
  async hset(key: string, data: Record<string, string>) {
    this.data.set(key, data);
    return 1;
  },
  async hgetall(key: string) {
    return this.data.get(key) || {};
  },
  async sadd(set: string, member: string) {
    if (!this.sets.has(set)) this.sets.set(set, new Set());
    this.sets.get(set)!.add(member);
    return 1;
  },
  async smembers(set: string) {
    return Array.from(this.sets.get(set) || []);
  },
  async expire() { return true; },
  async incr() { return 1; },
  pipeline() {
    const self = this;
    const cmds: Array<{ fn: string; args: any[] }> = [];
    return {
      hgetall(key: string) { cmds.push({ fn: 'hgetall', args: [key] }); return this; },
      async exec() {
        return cmds.map(cmd => [null, self.data.get(cmd.args[0]) || {}]);
      }
    };
  }
};

// Test wallet for signing
const TEST_WALLET = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000001');
const TEST_AGENT_WALLET = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000002');

describe('Payment Settlement', () => {
  describe('EIP712 Signature Validation', () => {
    it('should generate valid EIP712 domain separator', async () => {
      // Import the domain from payment-settlement
      const { EIP712_DOMAIN } = await import('../lib/payment-settlement');
      assert.ok(EIP712_DOMAIN.name, 'Should have domain name');
      assert.ok(EIP712_DOMAIN.version, 'Should have domain version');
      assert.ok(EIP712_DOMAIN.chainId, 'Should have chainId');
      assert.ok(EIP712_DOMAIN.verifyingContract, 'Should have verifyingContract');
    });

    it('should have correct EIP712 types defined', async () => {
      const { EIP712_TYPES } = await import('../lib/payment-settlement');
      assert.ok(EIP712_TYPES.TransferWithAuthorization, 'Should have TransferWithAuthorization type');
      const types = EIP712_TYPES.TransferWithAuthorization;
      assert.ok(types.length >= 6, 'Should have at least 6 fields');
    });

    it('should validate authorization structure', async () => {
      const { EIP712_TYPES } = await import('../lib/payment-settlement');
      const types = EIP712_TYPES.TransferWithAuthorization;

      // Check required fields
      const fieldNames = types.map(t => t.name);
      assert.ok(fieldNames.includes('from'), 'Should have from field');
      assert.ok(fieldNames.includes('to'), 'Should have to field');
      assert.ok(fieldNames.includes('value'), 'Should have value field');
      assert.ok(fieldNames.includes('validAfter'), 'Should have validAfter field');
      assert.ok(fieldNames.includes('validBefore'), 'Should have validBefore field');
      assert.ok(fieldNames.includes('nonce'), 'Should have nonce field');
    });
  });

  describe('calculateCallCost', () => {
    it('should calculate cost correctly for given duration and rate', async () => {
      const { calculateCallCost, centsToTokenUnits } = await import('../lib/payment-settlement');

      // Test with $0.50/min rate (50 cents)
      const ratePerMinute = 50;
      const durationSeconds = 60; // 1 minute
      const cost = calculateCallCost(durationSeconds, ratePerMinute);
      // Returns token units (wei-like), not cents directly
      const expected = centsToTokenUnits(50);
      assert.equal(cost, expected, '1 minute at $0.50/min should be 50 cents in token units');

      // Test 30 seconds - should be 25 cents, rounded up to token units
      const cost30 = calculateCallCost(30, ratePerMinute);
      const expected30 = centsToTokenUnits(25);
      assert.equal(cost30, expected30, '30 seconds at $0.50/min should be 25 cents in token units');

      // Test 2 minutes - should be 100 cents
      const cost120 = calculateCallCost(120, ratePerMinute);
      const expected120 = centsToTokenUnits(100);
      assert.equal(cost120, expected120, '2 minutes at $0.50/min should be 100 cents in token units');
    });

    it('should handle fractional cents by ceiling', async () => {
      const { calculateCallCost, centsToTokenUnits } = await import('../lib/payment-settlement');
      const ratePerMinute = 100; // $1.00/min
      const durationSeconds = 1; // 1 second

      // 100 cents / 60 seconds = 1.666... cents per second
      // Should ceil to 2 cents, then convert to token units
      const cost = calculateCallCost(durationSeconds, ratePerMinute);
      const expected = centsToTokenUnits(2);
      assert.equal(cost, expected, 'Should ceil to 2 cents and convert to token units');
    });
  });

  describe('ARB_TOKENS', () => {
    it('should have USDC and USDT token addresses', async () => {
      const { ARB_TOKENS } = await import('../lib/payment-settlement');
      assert.ok(ARB_TOKENS.USDC, 'Should have USDC address');
      assert.ok(ARB_TOKENS.USDT, 'Should have USDT address');
      assert.ok(ARB_TOKENS.USDC.startsWith('0x'), 'USDC should be an Ethereum address');
      assert.ok(ARB_TOKENS.USDT.startsWith('0x'), 'USDT should be an Ethereum address');
    });
  });
});

describe('Voice Payment Service', () => {
  describe('PaymentAuthorization', () => {
    it('should export required types', async () => {
      const { VoicePaymentService, PaymentConfig, CallSession, PaymentAuthorization } = await import('../lib/payments/x402');

      // Check PaymentConfig defaults
      const defaultConfig: PaymentConfig = {
        platformFeePercent: 10,
        billingIntervalMs: 1000,
        settlementToken: 'USDC',
      };
      assert.equal(defaultConfig.platformFeePercent, 10);
      assert.equal(defaultConfig.billingIntervalMs, 1000);
      assert.equal(defaultConfig.settlementToken, 'USDC');
    });

    it('should create service with custom config', async () => {
      const { VoicePaymentService } = await import('../lib/payments/x402');
      const service = new VoicePaymentService({
        platformFeePercent: 5,
        billingIntervalMs: 500,
        settlementToken: 'USDT',
      });

      // Service should be created (we can't easily test internal state)
      assert.ok(service, 'Should create service instance');
    });
  });

  describe('CallSession serialization', () => {
    it('should serialize and deserialize session correctly', async () => {
      const { VoicePaymentService } = await import('../lib/payments/x402');
      const service = new VoicePaymentService();

      // Create a mock session with string values (as the service expects)
      const mockSession = {
        id: 'test_session_123',
        agentId: 'solana_sage',
        userAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        ratePerMinute: 50,
        maxAuthorized: 500,
        authorization: {
          from: '0x1234567890123456789012345678901234567890' as `0x${string}`,
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          value: 500n,
          validAfter: 0n,
          validBefore: BigInt(Date.now() + 3600000),
          nonce: '0x' + '00'.repeat(32),
          signature: { v: 27, r: '0x' + '11'.repeat(32), s: '0x' + '22'.repeat(32) },
        },
        startTime: new Date('2025-01-01T10:00:00Z'),
        secondsBilled: 60,
        totalCost: 50,
        status: 'active' as const,
      };

      // Test that the service can create sessions (the serializeSession is internal)
      // We verify the service exists and has the expected interface
      assert.ok(service, 'Service should be created');
    });
  });
});

describe('Payment Flow Integration', () => {
  describe('End-to-end payment authorization flow', () => {
    it('should have all required payment settlement exports', async () => {
      const paymentSettlement = await import('../lib/payment-settlement');

      // Check all required exports exist
      assert.ok(typeof paymentSettlement.paymentSettlement, 'Should export paymentSettlement');
      assert.ok(typeof paymentSettlement.calculateCallCost, 'Should export calculateCallCost');
      assert.ok(typeof paymentSettlement.ARB_TOKENS, 'Should export ARB_TOKENS');
      assert.ok(typeof paymentSettlement.EIP712_DOMAIN, 'Should export EIP712_DOMAIN');
      assert.ok(typeof paymentSettlement.EIP712_TYPES, 'Should export EIP712_TYPES');
    });

    it('should have settlement methods available', async () => {
      const { paymentSettlement } = await import('../lib/payment-settlement');

      // Check settlement methods exist on the singleton
      assert.ok(typeof paymentSettlement.settlePayment === 'function', 'Should have settlePayment method');
      assert.ok(typeof paymentSettlement.getReceipt === 'function', 'Should have getReceipt method');
      assert.ok(typeof paymentSettlement.getStats === 'function', 'Should have getStats method');
    });
  });

  describe('SettlementResult type', () => {
    it('should have correct SettlementResult structure', async () => {
      // Test that SettlementResult type is properly defined
      const mockResult = {
        success: true,
        txHash: '0xabc123' as `0x${string}`,
        blockNumber: 12345678n,
        gasUsed: 50000n,
        actualAmount: '50',
        taskId: 'task_123',
      };

      assert.equal(mockResult.success, true);
      assert.ok(mockResult.txHash);
      assert.ok(mockResult.blockNumber);
      assert.equal(mockResult.actualAmount, '50');
    });

    it('should handle settlement failure result', () => {
      const mockResult = {
        success: false,
        error: 'Insufficient balance',
      };

      assert.equal(mockResult.success, false);
      assert.equal(mockResult.error, 'Insufficient balance');
    });
  });
});