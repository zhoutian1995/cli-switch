/**
 * Repair pipeline unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  repairOutput,
  resetRepairCounter,
  getRepairCount,
} from '../../src/core/validation/repair.js';

beforeEach(() => {
  resetRepairCounter();
});

// ─── repairOutput ─────────────────────────────────────────────

describe('repairOutput', () => {
  it('extracts embedded JSON from prose text', () => {
    const rawOutput = `Here is the result:
\`\`\`json
{"status":"success","summary":"done","files_changed":["a.ts"],"diff":"..."}
\`\`\``;

    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.repairs.length).toBeGreaterThan(0);
  });

  it('extracts plain embedded JSON (no code fences)', () => {
    const rawOutput = `The operation completed successfully. Result: {"status":"success","summary":"done","files_changed":["a.ts"],"diff":"some diff"}`;

    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
  });

  it('returns failure for non-repairable output', () => {
    const rawOutput = 'No JSON here at all, just plain text without any structure.';

    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(false);
  });

  it('extracts diff blocks and wraps them for write_code capability', () => {
    const rawOutput = `I made some changes to your code:
diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,1 +1,2 @@
-old
+new
+extra`;

    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(true);
    expect(result.repairs).toContain('Extracted diff blocks and wrapped in JSON');
  });

  it('validates repaired output against capability schema', () => {
    // Embed valid write_code output
    const rawOutput = `Result: {"status":"success","summary":"Created file","files_changed":["x.ts"],"diff":"..."}`;

    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(true);
  });

  it('rejects JSON that does not match capability schema', () => {
    // Valid JSON but missing required fields for write_code
    const rawOutput = `Result: {"foo":"bar","baz":123}`;

    const result = repairOutput('write_code', rawOutput);
    // JSON is extracted but doesn't validate — try diff extraction which also fails
    expect(result.success).toBe(false);
  });
});

// ─── Budget tracking ──────────────────────────────────────────

describe('repair budget tracking', () => {
  it('increments counter across calls', () => {
    const rawOutput = `Result: {"status":"success","summary":"done","files_changed":["a.ts"],"diff":"..."}`;

    const r1 = repairOutput('write_code', rawOutput);
    expect(r1.success).toBe(true);
    expect(getRepairCount()).toBe(1);

    resetRepairCounter();

    const r2 = repairOutput('write_code', rawOutput);
    expect(r2.success).toBe(true);
    expect(getRepairCount()).toBe(1);
  });

  it('respects maxTotalRepairs budget', () => {
    const rawOutput = `Result: {"status":"success","summary":"done","files_changed":["a.ts"],"diff":"..."}`;

    // Exhaust budget
    repairOutput('write_code', rawOutput);
    repairOutput('write_code', rawOutput);
    repairOutput('write_code', rawOutput);

    // 4th call should be blocked
    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(0);
    expect(result.repairs).toContain('Repair budget exhausted');
  });

  it('respects maxAttempts per call', () => {
    const badOutput = 'Just plain text nothing useful';

    const result = repairOutput('write_code', badOutput, { maxAttempts: 1 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBeLessThanOrEqual(1);
  });

  it('resetRepairCounter clears the counter', () => {
    const rawOutput = `Result: {"status":"success","summary":"done","files_changed":["a.ts"],"diff":"..."}`;

    repairOutput('write_code', rawOutput);
    repairOutput('write_code', rawOutput);
    expect(getRepairCount()).toBe(2);

    resetRepairCounter();
    expect(getRepairCount()).toBe(0);

    // Should work again after reset
    const result = repairOutput('write_code', rawOutput);
    expect(result.success).toBe(true);
  });

  it('respects custom maxTotalRepairs', () => {
    const rawOutput = `Result: {"status":"success","summary":"done","files_changed":["a.ts"],"diff":"..."}`;

    repairOutput('write_code', rawOutput);

    // With custom limit of 1, second call is blocked
    const result = repairOutput('write_code', rawOutput, { maxTotalRepairs: 1 });
    expect(result.success).toBe(false);
    expect(result.repairs).toContain('Repair budget exhausted');
  });
});
