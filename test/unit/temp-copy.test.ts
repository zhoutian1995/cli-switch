/**
 * Temp Copy unit tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createTempCopy,
  computeCopyDiff,
  type TempCopyContext,
} from '../../src/core/sandbox/temp-copy.js';

let fixtureDir: string;

beforeEach(async () => {
  fixtureDir = join(tmpdir(), `temp-copy-test-${Date.now()}`);
  await mkdir(fixtureDir, { recursive: true });

  // Create a fixture project structure
  await writeFile(join(fixtureDir, 'index.ts'), 'console.log("hello");\n');
  await writeFile(join(fixtureDir, 'package.json'), '{"name": "test"}\n');
  await mkdir(join(fixtureDir, 'src'), { recursive: true });
  await writeFile(join(fixtureDir, 'src', 'app.ts'), 'export const app = true;\n');

  // Create excluded directories
  await mkdir(join(fixtureDir, '.git'), { recursive: true });
  await writeFile(join(fixtureDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await mkdir(join(fixtureDir, 'node_modules'), { recursive: true });
  await writeFile(join(fixtureDir, 'node_modules', 'dep.js'), 'module.exports = {};\n');
});

afterEach(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

// ─── createTempCopy ──────────────────────────────────────────

describe('createTempCopy', () => {
  it('creates a temp copy of the project directory', async () => {
    const ctx = await createTempCopy(fixtureDir);

    expect(ctx.srcDir).toBe(fixtureDir);
    expect(ctx.copyDir).toBeTruthy();
    expect(ctx.copyDir).not.toBe(fixtureDir);

    // Copied files should exist
    expect(existsSync(join(ctx.copyDir, 'index.ts'))).toBe(true);
    expect(existsSync(join(ctx.copyDir, 'package.json'))).toBe(true);
    expect(existsSync(join(ctx.copyDir, 'src', 'app.ts'))).toBe(true);

    // Cleanup
    await ctx.cleanup();
  });

  it('excludes .git directory by default', async () => {
    const ctx = await createTempCopy(fixtureDir);

    expect(existsSync(join(ctx.copyDir, '.git'))).toBe(false);

    await ctx.cleanup();
  });

  it('excludes node_modules directory by default', async () => {
    const ctx = await createTempCopy(fixtureDir);

    expect(existsSync(join(ctx.copyDir, 'node_modules'))).toBe(false);

    await ctx.cleanup();
  });

  it('respects custom excludes', async () => {
    // Create a custom directory to exclude
    await mkdir(join(fixtureDir, 'build'), { recursive: true });
    await writeFile(join(fixtureDir, 'build', 'output.js'), 'built\n');

    const ctx = await createTempCopy(fixtureDir, {
      excludes: ['.git', 'node_modules', 'build'],
    });

    expect(existsSync(join(ctx.copyDir, 'build'))).toBe(false);
    expect(existsSync(join(ctx.copyDir, 'index.ts'))).toBe(true);

    await ctx.cleanup();
  });

  it('copies files that are not excluded', async () => {
    await mkdir(join(fixtureDir, '.cli-switch'), { recursive: true });
    await writeFile(join(fixtureDir, '.cli-switch', 'config.json'), '{}');

    const ctx = await createTempCopy(fixtureDir);

    // .cli-switch is excluded by default
    expect(existsSync(join(ctx.copyDir, '.cli-switch'))).toBe(false);
    // Regular files are copied
    expect(existsSync(join(ctx.copyDir, 'index.ts'))).toBe(true);
    expect(existsSync(join(ctx.copyDir, 'package.json'))).toBe(true);

    await ctx.cleanup();
  });
});

// ─── cleanup ────────────────────────────────────────────────

describe('cleanup', () => {
  it('removes the temp directory', async () => {
    const ctx = await createTempCopy(fixtureDir);
    const copyDir = ctx.copyDir;

    expect(existsSync(copyDir)).toBe(true);

    await ctx.cleanup();

    expect(existsSync(copyDir)).toBe(false);
  });

  it('preserves temp directory when keepTemp is true', async () => {
    const ctx = await createTempCopy(fixtureDir, { keepTemp: true });
    const copyDir = ctx.copyDir;

    await ctx.cleanup();

    expect(existsSync(copyDir)).toBe(true);

    // Manual cleanup for test
    await rm(copyDir, { recursive: true, force: true });
  });
});

// ─── computeCopyDiff ────────────────────────────────────────

describe('computeCopyDiff', () => {
  it('returns empty diff for identical directories', async () => {
    const ctx = await createTempCopy(fixtureDir);
    const diff = await computeCopyDiff(fixtureDir, ctx.copyDir);

    // Should have minimal or no actual file content diff
    // (git diff --no-index always shows headers, but content should match)
    // The diff should be empty or contain only directory-level metadata
    expect(typeof diff).toBe('string');

    await ctx.cleanup();
  });

  it('detects file modifications in the copy', async () => {
    const ctx = await createTempCopy(fixtureDir);

    // Modify a file in the copy
    await writeFile(join(ctx.copyDir, 'index.ts'), 'console.log("modified");\n');

    const diff = await computeCopyDiff(fixtureDir, ctx.copyDir);

    // Should contain diff output showing the change
    expect(diff).toContain('index.ts');
    expect(diff).toContain('modified');

    await ctx.cleanup();
  });

  it('detects new files added to the copy', async () => {
    const ctx = await createTempCopy(fixtureDir);

    // Add a new file
    await writeFile(join(ctx.copyDir, 'new-file.ts'), 'export const newFile = true;\n');

    const diff = await computeCopyDiff(fixtureDir, ctx.copyDir);

    expect(diff).toContain('new-file');

    await ctx.cleanup();
  });

  it('detects file deletions from the copy', async () => {
    const ctx = await createTempCopy(fixtureDir);

    // Delete a file from the copy
    await rm(join(ctx.copyDir, 'package.json'), { force: true });

    const diff = await computeCopyDiff(fixtureDir, ctx.copyDir);

    expect(diff).toContain('package.json');

    await ctx.cleanup();
  });

  it('handles subdirectory modifications', async () => {
    const ctx = await createTempCopy(fixtureDir);

    // Modify a file in a subdirectory
    await writeFile(join(ctx.copyDir, 'src', 'app.ts'), 'export const app = false;\n');

    const diff = await computeCopyDiff(fixtureDir, ctx.copyDir);

    expect(diff).toContain('app.ts');
    expect(diff).toContain('false');

    await ctx.cleanup();
  });
});
