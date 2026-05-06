import { describe, it, expect } from 'vitest';
import { routeByCapability } from '../../src/core/router/capability-router.js';
import type { CapabilityId } from '../../src/types/capability.js';

describe('Capability Router', () => {
  describe('claude-code capabilities', () => {
    it('write_code → claude-code', () => {
      const r = routeByCapability('write_code');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('claude-code');
    });

    it('review_code → claude-code', () => {
      const r = routeByCapability('review_code');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('claude-code');
    });

    it('refactor → claude-code', () => {
      const r = routeByCapability('refactor');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('claude-code');
    });

    it('fix_error → claude-code', () => {
      const r = routeByCapability('fix_error');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('claude-code');
    });

    it('analyze → codex', () => {
      const r = routeByCapability('analyze');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('codex');
    });
  });

  describe('codex capabilities', () => {
    it('write_tests → codex', () => {
      const r = routeByCapability('write_tests');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('codex');
    });

    it('run_tests → codex', () => {
      const r = routeByCapability('run_tests');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('codex');
    });

    it('explain → codex', () => {
      const r = routeByCapability('explain');
      expect(r).not.toBeNull();
      expect(r!.agent).toBe('codex');
    });
  });

  describe('every capability has a route', () => {
    const ALL_CAPS: CapabilityId[] = [
      'write_code', 'review_code', 'refactor', 'fix_error',
      'analyze', 'write_tests', 'run_tests', 'explain',
    ];

    it('all 8 capabilities resolve to an agent', () => {
      for (const cap of ALL_CAPS) {
        const r = routeByCapability(cap);
        expect(r, `${cap} should resolve`).not.toBeNull();
        expect(r!.agent, `${cap} should map to a valid agent`).toMatch(/^(claude-code|codex)$/);
      }
    });
  });

  describe('reason strings', () => {
    it('every route returns a non-empty reason', () => {
      const caps: CapabilityId[] = ['write_code', 'review_code', 'refactor', 'fix_error', 'analyze', 'write_tests', 'run_tests', 'explain'];
      for (const cap of caps) {
        const r = routeByCapability(cap);
        expect(r!.reason.length, `${cap} reason should be non-empty`).toBeGreaterThan(0);
      }
    });
  });
});
