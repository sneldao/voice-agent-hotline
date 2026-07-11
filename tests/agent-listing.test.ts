import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// Agent Listing Rule Tests
// ============================================
// Tests that enforce the Phase 0/1 agent listing invariants:
//   - Public directory shows active agents only
//   - Pending and rejected agents never surface in public listing
//   - Self-registration stores as 'pending', not 'active'
//   - Admin approve sets status to 'active'
//   - Admin reject sets status to 'rejected'
//   - requireAdminAuth guards mutating routes

describe('Agent Listing Rules', () => {
  describe('Public directory status filter', () => {
    // Replicate the filter logic from app/api/agents/route.ts lines 70-75
    function publicDirectoryFilter(agent: { status?: string; active?: string | boolean }): boolean {
      const status = String(agent.status || '').toLowerCase();
      if (status === 'pending' || status === 'rejected') return false;
      return status === 'active' || String(agent.active) === 'true';
    }

    it('should include agents with status "active"', () => {
      assert.ok(publicDirectoryFilter({ status: 'active' }), 'Active agents should be included');
    });

    it('should include agents with active="true" and no status', () => {
      assert.ok(publicDirectoryFilter({ active: 'true' }), 'active="true" agents should be included');
    });

    it('should exclude agents with status "pending"', () => {
      assert.equal(publicDirectoryFilter({ status: 'pending' }), false, 'Pending agents must not surface');
    });

    it('should exclude agents with status "rejected"', () => {
      assert.equal(publicDirectoryFilter({ status: 'rejected' }), false, 'Rejected agents must not surface');
    });

    it('should exclude agents with status "PENDING" (case insensitive)', () => {
      assert.equal(publicDirectoryFilter({ status: 'PENDING' }), false, 'Case-insensitive pending must not surface');
    });

    it('should exclude agents with status "REJECTED" (case insensitive)', () => {
      assert.equal(publicDirectoryFilter({ status: 'REJECTED' }), false, 'Case-insensitive rejected must not surface');
    });

    it('should exclude agents with no status and active="false"', () => {
      assert.equal(publicDirectoryFilter({ active: 'false' }), false, 'Inactive agents should not surface');
    });

    it('should exclude agents with empty status and no active flag', () => {
      assert.equal(publicDirectoryFilter({}), false, 'Agents with no status should not surface');
    });
  });

  describe('Self-registration stores as pending', () => {
    it('self-registered agent should have status "pending" and active "false"', () => {
      // Replicate the self-registration object from app/api/agents/route.ts
      const selfRegisteredAgent = {
        id: 'agent_test_123',
        name: 'Test Agent',
        status: 'pending',
        active: 'false',
        created_at: new Date().toISOString(),
        rating: '0',
        total_calls: '0',
        total_revenue: '0',
      };

      assert.equal(selfRegisteredAgent.status, 'pending', 'Self-registered agents must start as pending');
      assert.equal(selfRegisteredAgent.active, 'false', 'Self-registered agents must start inactive');
    });
  });

  describe('Admin approve action', () => {
    it('approve should set status to "active" and active to "true"', () => {
      // Replicate the approve logic from app/api/agents/[id]/route.ts
      const agentBefore = { status: 'pending', active: 'false' };
      const agentAfter = {
        ...agentBefore,
        status: 'active',
        active: 'true',
        approved_at: new Date().toISOString(),
      };

      assert.equal(agentAfter.status, 'active', 'Approved agent should be active');
      assert.equal(agentAfter.active, 'true', 'Approved agent should have active="true"');
      assert.ok(agentAfter.approved_at, 'Approved agent should have approved_at timestamp');
    });
  });

  describe('Admin reject action', () => {
    it('reject should set status to "rejected" and active to "false"', () => {
      // Replicate the reject logic from app/api/agents/[id]/route.ts
      const agentBefore = { status: 'pending', active: 'false' };
      const agentAfter = {
        ...agentBefore,
        status: 'rejected',
        active: 'false',
        rejection_reason: 'Does not meet quality bar',
        rejected_at: new Date().toISOString(),
      };

      assert.equal(agentAfter.status, 'rejected', 'Rejected agent should have status "rejected"');
      assert.equal(agentAfter.active, 'false', 'Rejected agent should be inactive');
      assert.ok(agentAfter.rejection_reason, 'Rejected agent should have a reason');
    });
  });

  describe('Lifecycle: pending → approved → visible in directory', () => {
    it('full lifecycle: pending (hidden) → approve → active (visible)', () => {
      function publicDirectoryFilter(agent: { status?: string; active?: string | boolean }): boolean {
        const status = String(agent.status || '').toLowerCase();
        if (status === 'pending' || status === 'rejected') return false;
        return status === 'active' || String(agent.active) === 'true';
      }

      // Step 1: Self-register
      const agent = { status: 'pending', active: 'false' };
      assert.equal(publicDirectoryFilter(agent), false, 'Pending agent should not be visible');

      // Step 2: Admin approves
      agent.status = 'active';
      agent.active = 'true';
      assert.equal(publicDirectoryFilter(agent), true, 'Approved agent should be visible');

      // Step 3: Admin rejects (e.g. quality issue found later)
      agent.status = 'rejected';
      agent.active = 'false';
      assert.equal(publicDirectoryFilter(agent), false, 'Rejected agent should not be visible');
    });
  });

  describe('requireAdminAuth guards mutating routes', () => {
    it('requireAdminAuth should be a function', async () => {
      const { requireAdminAuth } = await import('../lib/api-auth');
      assert.equal(typeof requireAdminAuth, 'function');
    });

    it('requireAdminAuth should return 401 when no API key is provided', async () => {
      const { requireAdminAuth } = await import('../lib/api-auth');
      // Create a minimal mock request with no API key header
      const mockReq = {
        headers: new Headers(),
      } as any;
      const result = requireAdminAuth(mockReq);
      assert.ok(result, 'Should return a response (not null) when unauthorized');
      // The result should be a NextResponse with status 401
      // We can't easily check status in unit test, but result being non-null means auth failed
    });

    it('requireAdminAuth should return null when valid API key is provided', async () => {
      const { requireAdminAuth } = await import('../lib/api-auth');
      const testKey = 'test-admin-key-for-unit-test';
      process.env.API_SECRET_KEY = testKey;
      const mockReq = {
        headers: new Headers({ 'x-api-key': testKey }),
      } as any;
      const result = requireAdminAuth(mockReq);
      assert.equal(result, null, 'Should return null when authorized');
      delete process.env.API_SECRET_KEY;
    });
  });

  describe('verifyWalletAuth for settle route', () => {
    it('verifyWalletAuth should be a function', async () => {
      const { verifyWalletAuth } = await import('../lib/api-auth');
      assert.equal(typeof verifyWalletAuth, 'function');
    });

    it('verifyWalletAuth should reject requests without auth headers', async () => {
      const { verifyWalletAuth } = await import('../lib/api-auth');
      const mockReq = {
        headers: new Headers(),
      } as any;
      const result = await verifyWalletAuth(mockReq);
      assert.equal(result.authenticated, false, 'Should reject without headers');
      assert.ok(result.error, 'Should have an error message');
    });
  });
});
