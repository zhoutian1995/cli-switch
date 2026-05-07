import { describe, it, expect } from 'vitest';
import { getStrategy, selectStrategy, listStrategies, isValidStrategy } from '../../src/core/strategy/registry.js';
import type { StrategyName } from '../../src/types/strategy.js';

describe('strategy registry', () => {
  describe('getStrategy', () => {
    it('returns all 4 strategy definitions', () => {
      const names: StrategyName[] = ['single', 'write_review', 'write_test_fix', 'high_quality'];
      for (const name of names) {
        const s = getStrategy(name);
        expect(s.name).toBe(name);
        expect(s.steps.length).toBeGreaterThan(0);
      }
    });

    it('single has 1 step, no loop', () => {
      const s = getStrategy('single');
      expect(s.steps).toHaveLength(1);
      expect(s.loop).toBe(false);
      expect(s.steps[0].capability).toBe('write_code');
      expect(s.steps[0].onFail).toBe('abort');
    });

    it('write_review has write_code → review_code', () => {
      const s = getStrategy('write_review');
      expect(s.steps).toHaveLength(2);
      expect(s.steps[0].capability).toBe('write_code');
      expect(s.steps[1].capability).toBe('review_code');
      expect(s.loop).toBe(false);
    });

    it('write_test_fix has 4 steps with loop', () => {
      const s = getStrategy('write_test_fix');
      expect(s.steps).toHaveLength(4);
      expect(s.steps.map(st => st.capability)).toEqual([
        'write_code', 'write_tests', 'run_tests', 'fix_error',
      ]);
      expect(s.loop).toBe(true);
      expect(s.maxIterations).toBe(5);
    });

    it('high_quality forces premium tier on all steps', () => {
      const s = getStrategy('high_quality');
      expect(s.defaultTier).toBe('premium');
      // run_tests step has no tierOverride (uses defaultTier=premium)
      const runTestsStep = s.steps.find(st => st.capability === 'run_tests');
      expect(runTestsStep?.tierOverride).toBeUndefined();
      // write_code step forces premium explicitly
      const writeStep = s.steps.find(st => st.capability === 'write_code');
      expect(writeStep?.tierOverride).toBe('premium');
    });
  });

  describe('selectStrategy', () => {
    it('write_code → single', () => {
      expect(selectStrategy('write_code')).toBe('single');
    });

    it('refactor → write_review', () => {
      expect(selectStrategy('refactor')).toBe('write_review');
    });

    it('write_tests → write_test_fix', () => {
      expect(selectStrategy('write_tests')).toBe('write_test_fix');
    });

    it('fix_error → write_test_fix', () => {
      expect(selectStrategy('fix_error')).toBe('write_test_fix');
    });

    it('review_code → single', () => {
      expect(selectStrategy('review_code')).toBe('single');
    });

    it('analyze → single', () => {
      expect(selectStrategy('analyze')).toBe('single');
    });

    it('explain → single', () => {
      expect(selectStrategy('explain')).toBe('single');
    });
  });

  describe('listStrategies', () => {
    it('returns 4 strategies', () => {
      const list = listStrategies();
      expect(list).toHaveLength(4);
      const names = list.map(s => s.name).sort();
      expect(names).toEqual(['high_quality', 'single', 'write_review', 'write_test_fix']);
    });
  });

  describe('isValidStrategy', () => {
    it('accepts valid names', () => {
      expect(isValidStrategy('single')).toBe(true);
      expect(isValidStrategy('write_test_fix')).toBe(true);
      expect(isValidStrategy('high_quality')).toBe(true);
    });

    it('rejects invalid names', () => {
      expect(isValidStrategy('unknown')).toBe(false);
      expect(isValidStrategy('')).toBe(false);
    });
  });
});
