import { describe, it, expect } from 'vitest';
import { executeStrategy, createExecutionState } from '../../src/core/strategy/engine.js';
import type { StepExecutor, RouteResolver } from '../../src/core/strategy/engine.js';
import { getStrategy } from '../../src/core/strategy/registry.js';
import type { AgentId } from '../../src/types/agent.js';
import { routeByCapability } from '../../src/core/router/capability-router.js';
import type { CapabilityId } from '../../src/types/capability.js';
import type { Tier } from '../../src/types/gateway.js';

/** Default resolver — routes by capability, uses step tier override, falls back to standard */
const defaultResolver: RouteResolver = (capability, stepTierOverride) => {
  const route = routeByCapability(capability);
  return {
    agent: route?.agent ?? 'claude-code',
    tier: stepTierOverride ?? 'standard',
    reason: route?.reason ?? '默认',
  };
};

/** Resolver with forced agent override */
function overrideResolver(agent: AgentId): RouteResolver {
  return (capability, stepTierOverride) => {
    return {
      agent,
      tier: stepTierOverride ?? 'standard',
      reason: `--agent override`,
    };
  };
}

/** Helper: create a mock executor that returns ok/fail for each capability */
function mockExecutor(
  responses: Record<string, { ok: boolean; output?: string }>,
): StepExecutor {
  return async (capability, agent, tier, _prompt, _context) => ({
    ok: responses[capability]?.ok ?? true,
    output: responses[capability]?.output ?? `${capability} done`,
    exitCode: responses[capability]?.ok === false ? 1 : 0,
    durationMs: 10,
    agent,
  });
}

describe('strategy engine', () => {
  describe('createExecutionState', () => {
    it('initializes state from strategy', () => {
      const strategy = getStrategy('write_test_fix');
      const state = createExecutionState(strategy);
      expect(state.strategyName).toBe('write_test_fix');
      expect(state.currentStep).toBe(1);
      expect(state.currentCapability).toBe('write_code');
      expect(state.totalSteps).toBe(4);
      expect(state.iteration).toBe(1);
      expect(state.maxIterations).toBe(5);
      expect(state.history).toEqual([]);
      expect(state.errors).toEqual([]);
    });
  });

  describe('single strategy', () => {
    it('executes single step successfully', async () => {
      const strategy = getStrategy('single');
      const executor = mockExecutor({ write_code: { ok: true } });
      const result = await executeStrategy(strategy, 'write hello world', executor, defaultResolver);

      expect(result.status).toBe('success');
      expect(result.strategy).toBe('single');
      expect(result.agent).toBe('claude-code');
      expect(result.tier).toBe('standard');
      expect(result.decisionTrace.capability).toBe('write_code');
      expect(result.decisionTrace.strategy).toBe('single');
    });

    it('fails when single step fails', async () => {
      const strategy = getStrategy('single');
      const executor = mockExecutor({ write_code: { ok: false, output: 'SyntaxError: bad' } });
      const result = await executeStrategy(strategy, 'write hello', executor, defaultResolver);

      expect(result.status).toBe('failed');
      expect(result.summary).toContain('failed');
    });

    it('respects agent override from resolver', async () => {
      const strategy = getStrategy('single');
      const executor: StepExecutor = async (cap, agent, tier) => ({
        ok: true, output: 'done', exitCode: 0, durationMs: 10, agent,
      });
      const result = await executeStrategy(strategy, 'hello', executor, overrideResolver('codex'));

      expect(result.status).toBe('success');
      expect(result.agent).toBe('codex');
      expect(result.decisionTrace.agentReason).toBe('--agent override');
    });
  });

  describe('write_review strategy', () => {
    it('completes write_code → review_code', async () => {
      const strategy = getStrategy('write_review');
      const executor = mockExecutor({
        write_code: { ok: true },
        review_code: { ok: true },
      });
      const result = await executeStrategy(strategy, 'implement feature X', executor, defaultResolver);

      expect(result.status).toBe('success');
      expect(result.strategy).toBe('write_review');
    });

    it('aborts on first step failure', async () => {
      const strategy = getStrategy('write_review');
      const executor = mockExecutor({
        write_code: { ok: false, output: 'crashed' },
      });
      const result = await executeStrategy(strategy, 'implement feature X', executor, defaultResolver);

      expect(result.status).toBe('failed');
      expect(result.summary).toContain('failed');
    });

    it('aborts on review_code failure', async () => {
      const strategy = getStrategy('write_review');
      const executor = mockExecutor({
        write_code: { ok: true },
        review_code: { ok: false, output: 'issues found' },
      });
      const result = await executeStrategy(strategy, 'implement feature X', executor, defaultResolver);

      expect(result.status).toBe('failed');
      expect(result.summary).toContain('failed');
    });
  });

  describe('write_test_fix strategy (loop)', () => {
    it('completes all 4 steps without loop', async () => {
      const strategy = getStrategy('write_test_fix');
      const executor = mockExecutor({
        write_code: { ok: true },
        write_tests: { ok: true },
        run_tests: { ok: true },
        fix_error: { ok: true },
      });
      const result = await executeStrategy(strategy, 'implement X with tests', executor, defaultResolver);

      expect(result.status).toBe('success');
      expect(result.strategy).toBe('write_test_fix');
    });

    it('loops: run_tests fails → fix_error → run_tests passes', async () => {
      const strategy = getStrategy('write_test_fix');
      let runTestsCount = 0;

      const executor: StepExecutor = async (capability, agent, tier) => {
        if (capability === 'run_tests') {
          runTestsCount++;
          if (runTestsCount === 1) {
            return { ok: false, output: '2 failing test case 1', exitCode: 1, durationMs: 10, agent };
          }
        }
        return { ok: true, output: `${capability} ok`, exitCode: 0, durationMs: 10, agent };
      };

      const result = await executeStrategy(strategy, 'implement X', executor, defaultResolver);

      expect(result.status).toBe('success');
      expect(result.decisionTrace.loopIterations!.length).toBeGreaterThanOrEqual(4);
    });

    it('fails after max iterations', async () => {
      const strategy = getStrategy('write_test_fix');

      const executor: StepExecutor = async (capability, agent, tier) => {
        // run_tests always fails
        if (capability === 'run_tests') {
          return { ok: false, output: '2 failing', exitCode: 1, durationMs: 10, agent };
        }
        return { ok: true, output: `${capability} ok`, exitCode: 0, durationMs: 10, agent };
      };

      const result = await executeStrategy(strategy, 'implement X', executor, defaultResolver);

      expect(result.status).toBe('failed');
      expect(result.summary).toContain('Loop exhausted');
    });
  });

  describe('high_quality strategy', () => {
    it('uses premium tier', async () => {
      const strategy = getStrategy('high_quality');
      expect(strategy.defaultTier).toBe('premium');

      const executor: StepExecutor = async (capability, agent, tier) => {
        // Verify tier is premium for write_code and review_code
        if (capability === 'write_code' || capability === 'review_code') {
          expect(tier).toBe('premium');
        }
        return { ok: true, output: 'ok', exitCode: 0, durationMs: 10, agent };
      };

      const result = await executeStrategy(strategy, 'implement X', executor, defaultResolver);
      expect(result.status).toBe('success');
      expect(result.tier).toBe('premium');
    });
  });

  describe('decisionTrace', () => {
    it('includes loop iterations for loop strategies', async () => {
      const strategy = getStrategy('write_test_fix');
      let runTestsCalls = 0;

      const executor: StepExecutor = async (capability, agent, tier) => {
        if (capability === 'run_tests') {
          runTestsCalls++;
          if (runTestsCalls === 1) {
            return { ok: false, output: '2 failing', exitCode: 1, durationMs: 10, agent };
          }
        }
        return { ok: true, output: 'ok', exitCode: 0, durationMs: 10, agent };
      };

      const result = await executeStrategy(strategy, 'implement X', executor, defaultResolver);
      expect(result.decisionTrace.loopIterations).toBeDefined();
      expect(result.decisionTrace.loopIterations!.length).toBeGreaterThan(0);
      // Should have at least one failed iteration for run_tests
      const failedIters = result.decisionTrace.loopIterations!.filter(i => i.result === 'failed');
      expect(failedIters.length).toBeGreaterThanOrEqual(1);
    });

    it('no loop iterations for single strategy', async () => {
      const strategy = getStrategy('single');
      const executor = mockExecutor({ write_code: { ok: true } });
      const result = await executeStrategy(strategy, 'hello', executor, defaultResolver);

      expect(result.decisionTrace.loopIterations).toBeUndefined();
    });
  });
});
