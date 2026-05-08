/**
 * Diff Validator unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  parseUnifiedDiff,
  validateDiffPaths,
  type DiffFile,
  type DiffParseResult,
} from '../../src/core/validation/diff-validator.js';

// ─── parseUnifiedDiff ────────────────────────────────────────

describe('parseUnifiedDiff', () => {
  it('parses a simple single-file diff', () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,1 +1,2 @@
-old
+new
+extra`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('src/foo.ts');
    expect(result.files[0].hunks).toHaveLength(1);

    const hunk = result.files[0].hunks[0];
    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldCount).toBe(1);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newCount).toBe(2);
    expect(hunk.lines).toEqual(['-old', '+new', '+extra']);
  });

  it('parses a multi-file diff', () => {
    const diff = `diff --git a/file1.ts b/file1.ts
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

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe('file1.ts');
    expect(result.files[1].path).toBe('file2.ts');

    expect(result.files[0].hunks[0].oldStart).toBe(1);
    expect(result.files[1].hunks[0].oldStart).toBe(10);
  });

  it('handles empty string', () => {
    const result = parseUnifiedDiff('');
    expect(result.valid).toBe(false);
    expect(result.files).toHaveLength(0);
    expect(result.errors).toContain('Empty diff');
  });

  it('handles whitespace-only string', () => {
    const result = parseUnifiedDiff('   \n  \n  ');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Empty diff');
  });

  it('handles binary file marker', () => {
    const diff = `diff --git a/image.png b/image.png
--- a/image.png
+++ b/image.png
Binary files differ`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('image.png');
    expect(result.files[0].hunks).toHaveLength(0); // binary has no hunks
  });

  it('handles "no newline at end of file" marker', () => {
    const diff = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,2 @@
 line1
-line2
\\ No newline at end of file
+line2modified
\\ No newline at end of file`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    expect(result.files[0].hunks[0].lines).toContain('\\ No newline at end of file');
  });

  it('handles hunk without comma count (defaults to 1)', () => {
    const diff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -5 +5 @@
-old
+new`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    const hunk = result.files[0].hunks[0];
    expect(hunk.oldStart).toBe(5);
    expect(hunk.oldCount).toBe(1);
    expect(hunk.newStart).toBe(5);
    expect(hunk.newCount).toBe(1);
  });

  it('handles diff without --- line (error case)', () => {
    const diff = `diff --git a/x b/x
some random content
not a real diff`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Could not extract file path from diff block');
  });

  it('handles multiple hunks in a single file', () => {
    const diff = `diff --git a/multi.ts b/multi.ts
--- a/multi.ts
+++ b/multi.ts
@@ -1,2 +1,2 @@
-start1
+replaced1
 keep
@@ -10,3 +10,4 @@
 keep2
-start2
+replaced2
+added
 keep3`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    expect(result.files[0].hunks).toHaveLength(2);
    expect(result.files[0].hunks[0].oldStart).toBe(1);
    expect(result.files[0].hunks[1].oldStart).toBe(10);
  });

  it('handles diff with new file (--- /dev/null)', () => {
    const diff = `diff --git a/newfile.ts b/newfile.ts
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,3 @@
+new
+file
+content`;

    const result = parseUnifiedDiff(diff);
    expect(result.valid).toBe(true);
    // Falls back to +++ b/path when --- is /dev/null
    expect(result.files[0].path).toBe('newfile.ts');
    expect(result.files[0].hunks[0].oldStart).toBe(0);
    expect(result.files[0].hunks[0].oldCount).toBe(0);
  });
});

// ─── validateDiffPaths ────────────────────────────────────────

describe('validateDiffPaths', () => {
  it('detects .git/ protected path', () => {
    const files: DiffFile[] = [{ path: '.git/config', hunks: [] }];
    const result = validateDiffPaths(files);
    expect(result.clean).toBe(false);
    expect(result.violations).toContain('.git/config matches protected path .git/');
  });

  it('detects node_modules/ protected path', () => {
    const files: DiffFile[] = [{ path: 'node_modules/lodash/index.js', hunks: [] }];
    const result = validateDiffPaths(files);
    expect(result.clean).toBe(false);
    expect(result.violations).toContain('node_modules/lodash/index.js matches protected path node_modules/');
  });

  it('detects .env protected path', () => {
    const files: DiffFile[] = [{ path: '.env', hunks: [] }];
    const result = validateDiffPaths(files);
    expect(result.clean).toBe(false);
    expect(result.violations).toContain('.env matches protected path .env');
  });

  it('detects .env.local (starts with .env)', () => {
    const files: DiffFile[] = [{ path: '.env.local', hunks: [] }];
    const result = validateDiffPaths(files);
    expect(result.clean).toBe(false);
  });

  it('allows safe paths', () => {
    const files: DiffFile[] = [
      { path: 'src/index.ts', hunks: [] },
      { path: 'lib/utils.ts', hunks: [] },
      { path: 'test/foo.test.ts', hunks: [] },
    ];
    const result = validateDiffPaths(files);
    expect(result.clean).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('supports custom protected paths config', () => {
    const files: DiffFile[] = [{ path: 'secret.key', hunks: [] }];
    const result = validateDiffPaths(files, { paths: ['secret.'] });
    expect(result.clean).toBe(false);
    expect(result.violations[0]).toContain('secret.key');
  });

  it('supports glob patterns like *.lock', () => {
    const files: DiffFile[] = [
      { path: 'yarn.lock', hunks: [] },
      { path: 'pnpm-lock.yaml', hunks: [] },
    ];
    const result = validateDiffPaths(files, { paths: ['.git/', '*.lock'] });
    expect(result.clean).toBe(false);
    // yarn.lock matches *.lock, pnpm-lock.yaml does not end with .lock
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('yarn.lock');
  });

  it('returns clean when no files provided', () => {
    const result = validateDiffPaths([]);
    expect(result.clean).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('reports multiple violations for multiple files', () => {
    const files: DiffFile[] = [
      { path: '.git/config', hunks: [] },
      { path: 'node_modules/foo/bar.js', hunks: [] },
      { path: 'src/safe.ts', hunks: [] },
    ];
    const result = validateDiffPaths(files);
    expect(result.clean).toBe(false);
    expect(result.violations).toHaveLength(2);
  });
});
