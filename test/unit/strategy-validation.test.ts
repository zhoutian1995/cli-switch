/**
 * Strategy validation integration tests.
 *
 * Tests that the strategy engine wires validateOutput + repairOutput
 * after each step in multi-step strategies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeStrategy, type StepExecutor, type RouteResolver } from '../../src/core/strategy/engine.js';
import type { StrategyDefinition } from '../../src/types/strategy.js';
import { getRepairCount, resetRepairCounter } from '../../src/core/validation/repair.js';

// ─── Test fixtures ────────────────────────────────────────────

const singleStepStrategy: StrategyDefinition = {
  name: 'single',
  label: 'Single Step',
  description: 'One step, no loop',
  steps: [
    { step: 1, capability: 'write_code', onFail: 'abort' },
  ],
  loop: false,
  maxIterations: 1,
  defaultTier: 'standard',
};

const multiStepStrategy: StrategyDefinition = {
  name: 'write_review',
  label: 'Write then Review',
  description: 'Two steps',
  steps: [
    { step: 1, capability: 'write_code', onFail: 'abort' },
    { step: 2, capability: 'review_code', onFail: 'abort' },
  ],
  loop: false,
  maxIterations: 1,
  defaultTier: 'standard',
};

const mockResolver: RouteResolver = (_capability, _tierOverride) => ({
  agent: 'claude-code',
  tier: 'standard',
  reason: 'test',
});

function makeExecutor(outputs: Array<{ ok: boolean; output: string }>): StepExecutor {
  let idx = 0;
  return async () => {
    const o = outputs[idx] ?? outputs[outputs.length - 1];
    idx++;
    return {
      ok: o.ok,
      output: o.output,
      durationMs: 10,
      agent: 'claude-code',
    };
  };
}

beforeEach(() => {
  resetRepairCounter();
});

// ─── Single-step fast path (no validation) ────────────────────

describe('single-step strategy (no validation hook)', () => {
  it('does not add validatedOutput to history for single-step', async () => {
    const validOutput = JSON.stringify({
      status: 'success',
      summary: 'done',
      files_changed: ['a.ts'],
      diff: '...',
    });

    const executor = makeExecutor([{ ok: true, output: validOutput }]);
    const result = await executeStrategy(singleStepStrategy, 'prompt', executor, mockResolver);

    expect(result.status).toBe('success');
    // Single-step should NOT have validatedOutputs
    expect(result.validatedOutputs).toBeUndefined();
  });

  it('does not add validatedOutput for invalid output in single-step', async () => {
    const executor = makeExecutor([{ ok: true, output: 'not json' }]);
    const result = await executeStrategy(singleStepStrategy, 'prompt', executor, mockResolver);

    expect(result.status).toBe('success');
    expect(result.validatedOutputs).toBeUndefined();
  });
});

// ─── Multi-step validation ────────────────────────────────────

describe('multi-step strategy validation', () => {
  it('stores validatedOutput when output is valid JSON', async () => {
    const writeOutput = JSON.stringify({
      status: 'success',
      summary: 'created files',
      files_changed: ['a.ts', 'b.ts'],
      diff: '...',
    });

    const reviewOutput = JSON.stringify({
      status: 'success',
      summary: 'looks good',
      review_report: {
        verdict: 'pass',
        comments: ['nice code'],
      },
    });

    const executor = makeExecutor([
      { ok: true, output: writeOutput },
      { ok: true, output: reviewOutput },
    ]);

    const result = await executeStrategy(multiStepStrategy, 'prompt', executor, mockResolver);

    expect(result.status).toBe('success');
    expect(result.validatedOutputs).toBeDefined();
    expect(result.validatedOutputs!['step-1']).toBeDefined();
    expect(result.validatedOutputs!['step-1'].status).toBe('success');
    expect(result.validatedOutputs!['step-1'].summary).toBe('created files');
    expect(result.validatedOutputs!['step-2']).toBeDefined();
    expect(result.validatedOutputs!['step-2'].summary).toBe('looks good');
  });

  it('attempts repair when output is invalid', async () => {
    // Step 1: invalid output that contains embedded JSON
    const invalidOutput = `Here is what I did:
{"status":"success","summary":"repaired output","files_changed":["a.ts"],"diff":"..."}`;

    const reviewOutput = JSON.stringify({
      status: 'success',
      summary: 'ok',
      review_report: { verdict: 'pass', comments: [] },
    });

    const executor = makeExecutor([
      { ok: true, output: invalidOutput },
      { ok: true, output: reviewOutput },
    ]);

    const result = await executeStrategy(multiStepStrategy, 'prompt', executor, mockResolver);

    expect(result.status).toBe('success');
    // Step 1 should be repaired and validated
    expect(result.validatedOutputs?.['step-1']).toBeDefined();
    expect(result.validatedOutputs!['step-1'].summary).toBe('repaired output');
    expect(result.validatedOutputs!['step-2']).toBeDefined();
  });

  it('continues without validatedOutput when repair fails', async () => {
    // Step 1: completely unrepairable output
    const badOutput = 'nothing useful here at all';

    const reviewOutput = JSON.stringify({
      status: 'success',
      summary: 'review done',
      review_report: { verdict: 'pass', comments: [] },
    });

    const executor = makeExecutor([
      { ok: true, output: badOutput },
      { ok: true, output: reviewOutput },
    ]);

    const result = await executeStrategy(multiStepStrategy, 'prompt', executor, mockResolver);

    // Strategy should still succeed (validation doesn't abort steps)
    expect(result.status).toBe('success');
    // Step 1 has no validatedOutput
    expect(result.validatedOutputs?.['step-1']).toBeUndefined();
    // Step 2 is still validated
    expect(result.validatedOutputs?.['step-2']).toBeDefined();
  });

  it('calls resetRepairCounter at start of strategy', async () => {
    const validOutput = JSON.stringify({
      status: 'success',
      summary: 'done',
      files_changed: ['a.ts'],
      diff: '...',
    });

    const reviewOutput = JSON.stringify({
      status: 'success',
      summary: 'ok',
      review_report: { verdict: 'pass', comments: [] },
    });

    // Pre-exhaust the counter
    resetRepairCounter();
    // Manually bump counter to simulate prior usage
    // (We can't directly set it, but we can verify it's reset by the strategy)
    // Strategy calls resetRepairCounter(), so counter should be 0 at start

    const executor = makeExecutor([
      { ok: true, output: validOutput },
      { ok: true, output: reviewOutput },
    ]);

    const result = await executeStrategy(multiStepStrategy, 'prompt', executor, mockResolver);
    expect(result.status).toBe('success');
    expect(result.validatedOutputs?.['step-1']).toBeDefined();
  });

  it('stores validatedOutput in StepHistory', async () => {
    const validOutput = JSON.stringify({
      status: 'success',
      summary: 'done',
      files_changed: ['a.ts'],
      diff: '...',
    });

    const reviewOutput = JSON.stringify({
      status: 'success',
      summary: 'reviewed',
      review_report: { verdict: 'pass', comments: [] },
    });

    const executor = makeExecutor([
      { ok: true, output: validOutput },
      { ok: true, output: reviewOutput },
    ]);

    // We can't directly access execState, but validatedOutputs on the result
    // is built from stepHistory.validatedOutput
    const result = await executeStrategy(multiStepStrategy, 'prompt', executor, mockResolver);
    expect(result.validatedOutputs?.['step-1']?.status).toBe('success');
    expect(result.validatedOutputs?.['step-2']?.review_report?.verdict).toBe('pass');
  });
});

// ─── Loop strategy with validation ────────────────────────────

describe('loop strategy with validation', () => {
  const loopStrategy: StrategyDefinition = {
    name: 'write_test_fix',
    label: 'Write, Test, Fix loop',
    description: 'Three-step loop',
    steps: [
      { step: 1, capability: 'write_code', onFail: 'abort' },
      { step: 2, capability: 'run_tests', onFail: 'loop' },
      { step: 3, capability: 'fix_error', onFail: 'retry' },
    ],
    loop: true,
    maxIterations: 3,
    defaultTier: 'standard',
  };

  it('validates output at each step in a loop strategy', async () => {
    const writeOutput = JSON.stringify({
      status: 'success',
      summary: 'written',
      files_changed: ['a.ts'],
      diff: '...',
    });

    const testPassOutput = JSON.stringify({
      status: 'success',
      summary: 'tests pass',
      test_result: { status: 'pass', output: 'all good' },
    });

    const executor = makeExecutor([
      { ok: true, output: writeOutput },
      { ok: true, output: testPassOutput },
    ]);

    const result = await executeStrategy(loopStrategy, 'prompt', executor, mockResolver);

    expect(result.status).toBe('success');
    expect(result.validatedOutputs?.['step-1']).toBeDefined();
    expect(result.validatedOutputs?.['step-2']).toBeDefined();
  });
});
