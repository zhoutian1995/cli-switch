/**
 * Unit tests for validateOutput() function.
 *
 * Tests JSON parsing, schema validation, edge cases, and the full
 * validateOutput pipeline.
 */

import { describe, it, expect } from 'vitest';
import { validateOutput } from '../../src/core/validation/validator.js';
import type { CapabilityId } from '../../src/types/capability.js';

// ─── Valid JSON payloads ────────────────────────────────────────

const validPayloads: Record<CapabilityId, object> = {
  write_code: {
    status: 'success',
    summary: 'Created main.ts',
    files_changed: ['src/main.ts'],
    diff: '+10 -2',
  },
  write_tests: {
    status: 'success',
    summary: 'Tests written',
    test_files_created: ['test/main.test.ts'],
  },
  run_tests: {
    status: 'success',
    summary: 'Tests passed',
    test_result: { status: 'pass', output: '3 passed' },
  },
  review_code: {
    status: 'success',
    summary: 'Reviewed',
    review_report: { verdict: 'pass', comments: ['Nice'] },
  },
  fix_error: {
    status: 'success',
    summary: 'Fixed',
    files_changed: ['src/fix.ts'],
    diff: '-old +new',
  },
  refactor: {
    status: 'success',
    summary: 'Refactored',
    files_changed: ['src/mod.ts'],
    diff: '-5 +8',
    test_validation: { status: 'pass', output: 'ok' },
  },
  analyze: {
    status: 'success',
    summary: 'Analyzed',
    analysis_report: { root_cause: 'bug', suggestion: 'fix it' },
  },
  explain: {
    status: 'success',
    summary: 'Explained',
    explanation_text: 'This function does X.',
  },
};

const allCapabilities: CapabilityId[] = [
  'write_code', 'write_tests', 'run_tests', 'review_code',
  'fix_error', 'refactor', 'analyze', 'explain',
];

// ─── Valid JSON ─────────────────────────────────────────────────

describe('validateOutput — valid JSON', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: returns valid=true with data for correct JSON`, () => {
      const raw = JSON.stringify(validPayloads[cap]);
      const result = validateOutput(cap, raw);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('success');
      expect(result.errors).toBeUndefined();
    });
  }
});

// ─── Valid JSON with extra fields ───────────────────────────────

describe('validateOutput — extra fields passthrough', () => {
  it('write_code: passes extra fields through', () => {
    const payload = {
      ...validPayloads.write_code,
      confidence: 0.99,
      timing: 'fast',
    };
    const result = validateOutput('write_code', JSON.stringify(payload));
    expect(result.valid).toBe(true);
    expect(result.data).toHaveProperty('confidence', 0.99);
    expect(result.data).toHaveProperty('timing', 'fast');
  });
});

// ─── Non-JSON input ─────────────────────────────────────────────

describe('validateOutput — non-JSON input', () => {
  it('returns valid=false for plain text', () => {
    const result = validateOutput('write_code', 'this is just text');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output is not valid JSON');
  });

  it('returns valid=false for empty string', () => {
    const result = validateOutput('write_code', '');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output is not valid JSON');
  });

  it('returns valid=false for partially valid JSON text', () => {
    const result = validateOutput('write_code', '{"status": "success"');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output is not valid JSON');
  });
});

// ─── JSON but not an object ─────────────────────────────────────

describe('validateOutput — JSON non-object', () => {
  it('returns valid=false for JSON array', () => {
    const result = validateOutput('write_code', '[1, 2, 3]');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output must be a JSON object');
  });

  it('returns valid=false for JSON null', () => {
    const result = validateOutput('write_code', 'null');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output must be a JSON object');
  });

  it('returns valid=false for JSON string', () => {
    const result = validateOutput('write_code', '"just a string"');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output must be a JSON object');
  });

  it('returns valid=false for JSON number', () => {
    const result = validateOutput('write_code', '42');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output must be a JSON object');
  });
});

// ─── JSON object but missing required fields ────────────────────

describe('validateOutput — missing required fields', () => {
  it('write_code: rejects missing files_changed', () => {
    const result = validateOutput(
      'write_code',
      JSON.stringify({ status: 'success', summary: 'done' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('write_code: rejects missing diff', () => {
    const result = validateOutput(
      'write_code',
      JSON.stringify({ status: 'success', summary: 'done', files_changed: ['a.ts'] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('run_tests: rejects missing test_result', () => {
    const result = validateOutput(
      'run_tests',
      JSON.stringify({ status: 'success', summary: 'done' }),
    );
    expect(result.valid).toBe(false);
  });

  it('explain: rejects missing explanation_text', () => {
    const result = validateOutput(
      'explain',
      JSON.stringify({ status: 'success', summary: 'done' }),
    );
    expect(result.valid).toBe(false);
  });
});

// ─── Failed status ──────────────────────────────────────────────

describe('validateOutput — failed status', () => {
  it('write_code: accepts status "failed" with all required fields', () => {
    const payload = {
      status: 'failed',
      summary: 'Failed to write',
      files_changed: [],
      diff: '',
    };
    const result = validateOutput('write_code', JSON.stringify(payload));
    expect(result.valid).toBe(true);
    expect(result.data!.status).toBe('failed');
  });

  it('write_code: accepts failed with error field', () => {
    const payload = {
      status: 'failed',
      summary: 'Permission denied',
      files_changed: [],
      diff: '',
      error: 'EACCES',
    };
    const result = validateOutput('write_code', JSON.stringify(payload));
    expect(result.valid).toBe(true);
    expect(result.data!.error).toBe('EACCES');
  });
});

// ─── Error messages include field paths ─────────────────────────

describe('validateOutput — error messages', () => {
  it('includes field path in error messages', () => {
    const result = validateOutput(
      'write_code',
      JSON.stringify({ status: 'success', summary: 'done' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    // At least one error should mention the missing field
    const errorStr = result.errors!.join(' ');
    expect(errorStr).toMatch(/files_changed|diff/);
  });
});
