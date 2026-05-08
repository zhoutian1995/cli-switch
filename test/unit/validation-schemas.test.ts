/**
 * Unit tests for capability output Zod schemas.
 *
 * Tests all 8 capability schemas with valid inputs, missing required fields,
 * extra fields (passthrough), and wrong types.
 */

import { describe, it, expect } from 'vitest';
import { getOutputSchema } from '../../src/core/validation/output-schemas.js';
import type { CapabilityId } from '../../src/types/capability.js';

// ─── Valid data fixtures ───────────────────────────────────────

const validInputs: Record<CapabilityId, object> = {
  write_code: {
    status: 'success',
    summary: 'Created main.ts',
    files_changed: ['src/main.ts'],
    diff: '+1 line added',
  },
  write_tests: {
    status: 'success',
    summary: 'Created test file',
    test_files_created: ['test/main.test.ts'],
  },
  run_tests: {
    status: 'success',
    summary: 'All tests passed',
    test_result: { status: 'pass', output: '3 passed' },
  },
  review_code: {
    status: 'success',
    summary: 'Code looks good',
    review_report: { verdict: 'pass', comments: ['LGTM'] },
  },
  fix_error: {
    status: 'success',
    summary: 'Fixed bug in parser',
    files_changed: ['src/parser.ts'],
    diff: '-old +new',
  },
  refactor: {
    status: 'success',
    summary: 'Refactored module',
    files_changed: ['src/module.ts'],
    diff: '-10 +15',
    test_validation: { status: 'pass', output: 'all green' },
  },
  analyze: {
    status: 'success',
    summary: 'Analysis complete',
    analysis_report: { root_cause: 'null pointer', suggestion: 'Add null check' },
  },
  explain: {
    status: 'success',
    summary: 'Explained the function',
    explanation_text: 'This function does X, Y, and Z.',
  },
};

// ─── Invalid data fixtures (missing required fields) ────────────

const missingFieldInputs: Record<CapabilityId, object> = {
  write_code: { status: 'success', summary: 'Missing files_changed and diff' },
  write_tests: { status: 'success', summary: 'Missing test_files_created' },
  run_tests: { status: 'success', summary: 'Missing test_result' },
  review_code: { status: 'success', summary: 'Missing review_report' },
  fix_error: { status: 'success', summary: 'Missing files_changed and diff' },
  refactor: { status: 'success', summary: 'Missing files_changed, diff, test_validation' },
  analyze: { status: 'success', summary: 'Missing analysis_report' },
  explain: { status: 'success', summary: 'Missing explanation_text' },
};

// ─── Wrong-type fixtures ────────────────────────────────────────

const wrongTypeInputs: Record<CapabilityId, object> = {
  write_code: { status: 'success', summary: 'OK', files_changed: 'not-array', diff: '' },
  write_tests: { status: 'success', summary: 'OK', test_files_created: 'not-array' },
  run_tests: { status: 'success', summary: 'OK', test_result: { status: 'invalid', output: '' } },
  review_code: { status: 'success', summary: 'OK', review_report: { verdict: 'invalid', comments: [] } },
  fix_error: { status: 'success', summary: 'OK', files_changed: 'not-array', diff: '' },
  refactor: { status: 'success', summary: 'OK', files_changed: [], diff: '', test_validation: { status: 'invalid', output: '' } },
  analyze: { status: 'success', summary: 'OK', analysis_report: { root_cause: 123, suggestion: '' } },
  explain: { status: 'success', summary: 'OK', explanation_text: 123 },
};

// ─── Tests ──────────────────────────────────────────────────────

const allCapabilities: CapabilityId[] = [
  'write_code', 'write_tests', 'run_tests', 'review_code',
  'fix_error', 'refactor', 'analyze', 'explain',
];

describe('getOutputSchema', () => {
  it('returns a Zod schema for every capability', () => {
    for (const cap of allCapabilities) {
      const schema = getOutputSchema(cap);
      expect(schema).toBeDefined();
    }
  });
});

describe('Capability schemas — valid inputs', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: accepts valid input`, () => {
      const schema = getOutputSchema(cap);
      const result = schema.safeParse(validInputs[cap]);
      expect(result.success).toBe(true);
    });
  }
});

describe('Capability schemas — failed status also valid', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: accepts status "failed" with all required fields`, () => {
      const schema = getOutputSchema(cap);
      const input = { ...validInputs[cap], status: 'failed' };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });
  }
});

describe('Capability schemas — missing required fields', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: rejects input missing capability-specific fields`, () => {
      const schema = getOutputSchema(cap);
      const result = schema.safeParse(missingFieldInputs[cap]);
      expect(result.success).toBe(false);
    });
  }
});

describe('Capability schemas — wrong types', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: rejects input with wrong types`, () => {
      const schema = getOutputSchema(cap);
      const result = schema.safeParse(wrongTypeInputs[cap]);
      expect(result.success).toBe(false);
    });
  }
});

describe('Capability schemas — extra fields (passthrough)', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: allows extra fields without error`, () => {
      const schema = getOutputSchema(cap);
      const input = {
        ...validInputs[cap],
        confidence: 0.95,
        metadata: { key: 'value' },
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('confidence', 0.95);
        expect(result.data).toHaveProperty('metadata');
      }
    });
  }
});

describe('Capability schemas — base field validation', () => {
  for (const cap of allCapabilities) {
    it(`${cap}: rejects missing status`, () => {
      const schema = getOutputSchema(cap);
      const noStatus = { ...validInputs[cap] };
      delete (noStatus as Record<string, unknown>).status;
      const result = schema.safeParse(noStatus);
      expect(result.success).toBe(false);
    });

    it(`${cap}: rejects invalid status value`, () => {
      const schema = getOutputSchema(cap);
      const input = { ...validInputs[cap], status: 'invalid' };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it(`${cap}: rejects missing summary`, () => {
      const schema = getOutputSchema(cap);
      const noSummary = { ...validInputs[cap] };
      delete (noSummary as Record<string, unknown>).summary;
      const result = schema.safeParse(noSummary);
      expect(result.success).toBe(false);
    });

    it(`${cap}: rejects non-string summary`, () => {
      const schema = getOutputSchema(cap);
      const input = { ...validInputs[cap], summary: 123 };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  }
});

describe('Refactor schema — test_validation output is optional', () => {
  it('accepts test_validation without output field', () => {
    const schema = getOutputSchema('refactor');
    const input = {
      status: 'success',
      summary: 'Refactored',
      files_changed: ['a.ts'],
      diff: '-1 +2',
      test_validation: { status: 'pass' },
    };
    const result = schema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('All capabilities covered', () => {
  it('has exactly 8 schemas', async () => {
    const { outputSchemas } = await import('../../src/core/validation/output-schemas.js');
    expect(Object.keys(outputSchemas)).toHaveLength(8);
    for (const cap of allCapabilities) {
      expect(outputSchemas).toHaveProperty(cap);
    }
  });
});
