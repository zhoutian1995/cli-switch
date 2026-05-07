import { describe, it, expect } from 'vitest';
import { classifyError, createErrorRecord } from '../../src/core/strategy/error-classifier.js';

describe('error-classifier', () => {
  describe('classifyError', () => {
    it('classifies SyntaxError as syntax_error', () => {
      const r = classifyError('SyntaxError: unexpected token', 1, 'write_code', 1);
      expect(r.errorType).toBe('syntax_error');
      expect(r.repairAction).toBe('retry');
    });

    it('classifies test failure pattern', () => {
      const r = classifyError('2 failing\n  ✗ should return 200', 1, 'run_tests', 1);
      expect(r.errorType).toBe('test_failure');
      expect(r.repairAction).toBe('loop');
    });

    it('classifies assertion error as test_failure', () => {
      const r = classifyError('AssertionError: expected 200 got 404', 1, 'run_tests', 1);
      expect(r.errorType).toBe('test_failure');
    });

    it('classifies timeout from exit code 124', () => {
      const r = classifyError('Process timed out', 124, 'run_tests', 1);
      expect(r.errorType).toBe('timeout');
      expect(r.stage).toBe('upgrade_tier');
    });

    it('classifies timeout from exit code 137 (SIGKILL)', () => {
      const r = classifyError('killed', 137, 'run_tests', 1);
      expect(r.errorType).toBe('timeout');
    });

    it('classifies ENOENT as runtime_error', () => {
      const r = classifyError('ENOENT: no such file', 1, 'write_code', 1);
      expect(r.errorType).toBe('runtime_error');
    });

    it('classifies rate limit as agent_error', () => {
      const r = classifyError('429 rate limit exceeded', 1, 'write_code', 1);
      expect(r.errorType).toBe('agent_error');
    });

    it('non-zero exit without pattern → agent_error', () => {
      const r = classifyError('something went wrong', 42, 'write_code', 1);
      expect(r.errorType).toBe('agent_error');
      expect(r.stage).toBe('retry');
    });

    it('unknown output → unknown type', () => {
      const r = classifyError('', undefined, 'write_code', 1);
      expect(r.errorType).toBe('unknown');
    });

    it('escalation: syntax_error iteration 1 → retry', () => {
      const r = classifyError('SyntaxError', 1, 'write_code', 1);
      expect(r.stage).toBe('retry');
    });

    it('escalation: syntax_error iteration 2 → upgrade_tier', () => {
      const r = classifyError('SyntaxError', 1, 'write_code', 2);
      expect(r.stage).toBe('upgrade_tier');
    });

    it('escalation: syntax_error iteration 3 → switch_agent', () => {
      const r = classifyError('SyntaxError', 1, 'write_code', 3);
      expect(r.stage).toBe('switch_agent');
    });

    it('escalation: unknown iteration 2 → abort', () => {
      const r = classifyError('', undefined, 'write_code', 2);
      expect(r.stage).toBe('abort');
    });
  });

  describe('createErrorRecord', () => {
    it('creates record with truncated output', () => {
      const longOutput = 'x'.repeat(1000);
      const classification = classifyError('2 failing ✗', 1, 'run_tests', 1);
      const record = createErrorRecord(3, 'run_tests', 1, classification, longOutput);
      expect(record.step).toBe(3);
      expect(record.capability).toBe('run_tests');
      expect(record.errorType).toBe('test_failure');
      expect(record.errorOutput.length).toBeLessThanOrEqual(500);
    });
  });
});
