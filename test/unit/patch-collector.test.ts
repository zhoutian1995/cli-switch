/**
 * Patch Collector unit tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  collectPatches,
  extractDiffBlocks,
  applyPatch,
  type PatchResult,
  type ApplyResult,
} from '../../src/core/sandbox/patch-collector.js';

// ─── extractDiffBlocks ───────────────────────────────────────

describe('extractDiffBlocks', () => {
  it('extracts a single diff block', () => {
    const output = `Here is my analysis:

diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-old
+new

Done.`;

    const result = extractDiffBlocks(output);
    expect(result).toContain('diff --git a/foo.ts b/foo.ts');
    expect(result).toContain('--- a/foo.ts');
    expect(result).toContain('+++ b/foo.ts');
  });

  it('returns empty string when no diff blocks found', () => {
    expect(extractDiffBlocks('No diffs here')).toBe('');
    expect(extractDiffBlocks('')).toBe('');
  });

  it('returns empty string when diff-like text lacks --- lines', () => {
    const output = 'diff --git a/foo b/foo\nsome random content';
    expect(extractDiffBlocks(output)).toBe('');
  });

  it('extracts multiple diff blocks', () => {
    const output = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old1
+new1
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-old2
+new2`;

    const result = extractDiffBlocks(output);
    expect(result).toContain('file1.ts');
    expect(result).toContain('file2.ts');
    expect(result).toContain('diff --git a/file1.ts');
    expect(result).toContain('diff --git a/file2.ts');
  });
});

// ─── collectPatches ──────────────────────────────────────────

describe('collectPatches', () => {
  it('collects a valid single-file diff', () => {
    const output = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-old
+new`;

    const result: PatchResult = collectPatches(output);
    expect(result.clean).toBe(true);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].path).toBe('foo.ts');
    expect(result.violations).toHaveLength(0);
  });

  it('collects a multi-file diff', () => {
    const output = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,3 @@
-aaa
+bbb
 ccc
 ddd
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -10,2 +10,3 @@
 line1
 line2
+line3`;

    const result: PatchResult = collectPatches(output);
    expect(result.clean).toBe(true);
    expect(result.diffs).toHaveLength(2);
    expect(result.diffs[0].path).toBe('file1.ts');
    expect(result.diffs[1].path).toBe('file2.ts');
  });

  it('returns empty result for output with no diffs', () => {
    const result: PatchResult = collectPatches('no diff here');
    expect(result.clean).toBe(true);
    expect(result.diffs).toHaveLength(0);
    expect(result.rawDiffs).toBe('');
  });

  it('returns empty result for empty string', () => {
    const result: PatchResult = collectPatches('');
    expect(result.clean).toBe(true);
    expect(result.diffs).toHaveLength(0);
    expect(result.rawDiffs).toBe('');
  });

  it('detects protected path violations', () => {
    const output = `diff --git a/.git/config b/.git/config
--- a/.git/config
+++ b/.git/config
@@ -1 +1 @@
-old
+new`;

    const result: PatchResult = collectPatches(output);
    expect(result.clean).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain('.git/config');
  });

  it('detects node_modules protected path violations', () => {
    const output = `diff --git a/node_modules/foo/bar.js b/node_modules/foo/bar.js
--- a/node_modules/foo/bar.js
+++ b/node_modules/foo/bar.js
@@ -1 +1 @@
-old
+new`;

    const result: PatchResult = collectPatches(output);
    expect(result.clean).toBe(false);
    expect(result.violations[0]).toContain('node_modules');
  });

  it('detects .env protected path violations', () => {
    const output = `diff --git a/.env b/.env
--- a/.env
+++ b/.env
@@ -1 +1 @@
-KEY=old
+KEY=new`;

    const result: PatchResult = collectPatches(output);
    expect(result.clean).toBe(false);
    expect(result.violations[0]).toContain('.env');
  });

  it('reports clean for safe paths', () => {
    const output = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1 @@
-old
+new`;

    const result: PatchResult = collectPatches(output);
    expect(result.clean).toBe(true);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].path).toBe('src/index.ts');
  });

  it('handles output with mixed content and diffs', () => {
    const output = `I'll analyze the code and provide the fix:

The issue is in the following file. Here is the diff:

diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
 export function add(a: number, b: number): number {
-  return a + b;
+  return a + b; // fixed
 }
+// new comment

That should fix it!`;

    const result: PatchResult = collectPatches(output);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].path).toBe('src/utils.ts');
    expect(result.diffs[0].hunks[0].lines).toContain('+  return a + b; // fixed');
  });

  it('includes rawDiffs in result', () => {
    const output = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-old
+new`;

    const result: PatchResult = collectPatches(output);
    expect(result.rawDiffs).toContain('diff --git');
    expect(result.rawDiffs.length).toBeGreaterThan(0);
  });
});

// ─── applyPatch ──────────────────────────────────────────────

describe('applyPatch', () => {
  it('returns error when not in a git repository', () => {
    const result: ApplyResult = applyPatch('some diff', '/tmp/nonexistent-dir-12345');
    expect(result.success).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toContain('Not in a git repository');
  });

  it('handles empty diff text', () => {
    // In a git repo, empty diff would succeed with --check
    // But let's just test the non-repo case
    const result: ApplyResult = applyPatch('', '/tmp/nonexistent-dir-12345');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not in a git repository');
  });
});
