import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// Agent Skills Framework Tests
// ============================================

describe('Agent Skills', () => {
  it('should export SKILL_CONFIG with 4 skill types', async () => {
    const { SKILL_CONFIG } = await import('../lib/agent-skills');
    assert.ok(SKILL_CONFIG.book);
    assert.ok(SKILL_CONFIG.order);
    assert.ok(SKILL_CONFIG.schedule);
    assert.ok(SKILL_CONFIG.research);
  });

  it('SKILL_CONFIG entries should have required fields', async () => {
    const { SKILL_CONFIG } = await import('../lib/agent-skills');
    for (const [key, config] of Object.entries(SKILL_CONFIG)) {
      assert.ok(config.name, `${key} should have a name`);
      assert.ok(config.description, `${key} should have a description`);
      assert.ok(config.icon, `${key} should have an icon`);
      assert.ok(config.color, `${key} should have a color`);
    }
  });

  it('BookingSkill should validate required parameters', async () => {
    const { BookingSkill } = await import('../lib/agent-skills');
    const mockWallet = {
      account: { address: '0x0000000000000000000000000000000000000000' as const },
      writeContract: async () => '0x0' as const,
    };
    const skill = new BookingSkill('test', mockWallet as any);

    const result = await skill.execute({
      serviceType: 'appointment',
      providerId: '',
      providerName: 'Test',
      dateTime: '2025-01-01T10:00:00Z',
      duration: 30,
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Missing required parameters'));
  });

  it('OrderingSkill should validate required parameters', async () => {
    const { OrderingSkill } = await import('../lib/agent-skills');
    const mockWallet = {
      account: { address: '0x0000000000000000000000000000000000000000' as const },
      writeContract: async () => '0x0' as const,
    };
    const skill = new OrderingSkill(mockWallet as any);

    const result = await skill.execute({
      vendorId: '',
      vendorName: 'Test Vendor',
      items: [],
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Missing required parameters'));
  });

  it('SchedulingSkill should validate required parameters', async () => {
    const { SchedulingSkill } = await import('../lib/agent-skills');
    const mockWallet = {
      account: { address: '0x0000000000000000000000000000000000000000' as const },
      writeContract: async () => '0x0' as const,
    };
    const skill = new SchedulingSkill(mockWallet as any);

    const result = await skill.execute({
      eventType: 'reminder',
      title: '',
      dateTime: '',
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Missing required parameters'));
  });

  it('ResearchSkill should validate required query parameter', async () => {
    const { ResearchSkill } = await import('../lib/agent-skills');
    const mockWallet = {
      account: { address: '0x0000000000000000000000000000000000000000' as const },
      writeContract: async () => '0x0' as const,
    };
    const skill = new ResearchSkill(mockWallet as any);

    const result = await skill.execute({ query: '' });
    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Missing required parameter'));
  });
});
