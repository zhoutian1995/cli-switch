import { describe, it, expect } from 'vitest';
import { resolveTier, type RoutingConfig } from '../../src/core/router/tier-resolver.js';

describe('Tier Resolver', () => {
  describe('default capability→tier mapping', () => {
    it('write_code → premium', () => {
      expect(resolveTier('write_code')).toBe('premium');
    });

    it('refactor → premium', () => {
      expect(resolveTier('refactor')).toBe('premium');
    });

    it('fix_error → standard', () => {
      expect(resolveTier('fix_error')).toBe('standard');
    });

    it('analyze → standard', () => {
      expect(resolveTier('analyze')).toBe('standard');
    });

    it('write_tests → economy', () => {
      expect(resolveTier('write_tests')).toBe('economy');
    });

    it('run_tests → economy', () => {
      expect(resolveTier('run_tests')).toBe('economy');
    });

    it('explain → economy', () => {
      expect(resolveTier('explain')).toBe('economy');
    });
  });

  describe('CLI --tier override', () => {
    it('CLI override wins over default mapping', () => {
      expect(resolveTier('write_code', undefined, 'economy')).toBe('economy');
    });

    it('CLI override wins over config override', () => {
      const config: RoutingConfig = { capability_tier_override: { write_code: 'premium' } };
      expect(resolveTier('write_code', config, 'economy')).toBe('economy');
    });

    it('invalid CLI override is ignored', () => {
      expect(resolveTier('write_code', undefined, 'invalid')).toBe('premium');
    });
  });

  describe('config capability_tier_override', () => {
    it('config override wins over default mapping', () => {
      const config: RoutingConfig = { capability_tier_override: { analyze: 'premium' } };
      expect(resolveTier('analyze', config)).toBe('premium');
    });

    it('partial config override only affects specified capabilities', () => {
      const config: RoutingConfig = { capability_tier_override: { analyze: 'premium' } };
      expect(resolveTier('analyze', config)).toBe('premium');
      expect(resolveTier('write_code', config)).toBe('premium');
      expect(resolveTier('explain', config)).toBe('economy');
    });
  });

  describe('priority chain', () => {
    it('CLI > config > default', () => {
      const config: RoutingConfig = {
        tier_default: 'economy',
        capability_tier_override: { fix_error: 'premium' },
      };
      expect(resolveTier('fix_error', config, 'economy')).toBe('economy');
      expect(resolveTier('fix_error', config)).toBe('premium');
      expect(resolveTier('explain', config)).toBe('economy');
    });
  });

  describe('edge cases', () => {
    it('review_code → premium', () => {
      expect(resolveTier('review_code')).toBe('premium');
    });

    it('unknown capability falls back to standard', () => {
      expect(resolveTier('unknown_cap' as any)).toBe('standard');
    });

    it('unknown capability with tier_default uses tier_default', () => {
      const config: RoutingConfig = { tier_default: 'premium' };
      expect(resolveTier('unknown_cap' as any, config)).toBe('premium');
    });
  });
});
