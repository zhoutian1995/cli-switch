/**
 * Git Worktree module unit tests.
 *
 * Tests create real git repos in temp directories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  isGitRepo,
  createWorktree,
  getWorktreeChanges,
  mergeWorktree,
  removeWorktree,
} from '../../src/core/sandbox/worktree.js';

// ─── Helpers ──────────────────────────────────────────────────

/** Create a temp directory and return its path. */
function makeTempDir(prefix: string): string {
  return execFileSync('mktemp', ['-d', `-t${prefix}`], { encoding: 'utf8' }).trim();
}

/** Initialize a git repo in a directory. */
function initGitRepo(dir: string): void {
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir, stdio: 'pipe' });
  // Create an initial commit so the repo has a HEAD
  writeFileSync(join(dir, 'README.md'), '# test\n');
  execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'initial', '--no-verify'], { cwd: dir, stdio: 'pipe' });
}

/** List worktrees for a repo (normalized paths). */
function listWorktrees(dir: string): string[] {
  const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: dir,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => realpathSync(line.replace('worktree ', '')));
}

/** Check if a branch exists. */
function branchExists(dir: string, branch: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', branch], { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ─── Test state ───────────────────────────────────────────────

let repoDir: string;

beforeEach(() => {
  repoDir = makeTempDir('wt-test-');
  initGitRepo(repoDir);
});

afterEach(() => {
  // Clean up any leftover worktrees before removing the temp dir
  try {
    execFileSync('git', ['worktree', 'prune'], { cwd: repoDir, stdio: 'pipe' });
  } catch { /* ignore */ }

  try {
    rmSync(repoDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

// ─── isGitRepo ────────────────────────────────────────────────

describe('isGitRepo', () => {
  it('returns true for a git repository', () => {
    expect(isGitRepo(repoDir)).toBe(true);
  });

  it('returns false for a non-git directory', () => {
    const nonGitDir = makeTempDir('wt-nongit-');
    try {
      expect(isGitRepo(nonGitDir)).toBe(false);
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it('returns false for a non-existent directory', () => {
    expect(isGitRepo('/non/existent/path')).toBe(false);
  });
});

// ─── createWorktree ───────────────────────────────────────────

describe('createWorktree', () => {
  it('creates a worktree with a new branch', async () => {
    const ctx = await createWorktree(repoDir);
    try {
      expect(ctx.worktreeDir).toBeDefined();
      expect(ctx.branch).toMatch(/^wt-/);
      expect(existsSync(join(ctx.worktreeDir, 'README.md'))).toBe(true);

      // Verify the worktree is registered (normalize paths for macOS /var -> /private/var)
      const normalizedWorktreeDir = realpathSync(ctx.worktreeDir);
      const worktrees = listWorktrees(repoDir);
      expect(worktrees.some((wt) => wt === normalizedWorktreeDir)).toBe(true);

      // Verify the branch exists
      expect(branchExists(repoDir, ctx.branch)).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it('creates worktree with custom branch prefix', async () => {
    const ctx = await createWorktree(repoDir, { branchPrefix: 'custom-' });
    try {
      expect(ctx.branch).toMatch(/^custom-/);
    } finally {
      await ctx.cleanup();
    }
  });

  it('throws for non-git directory', async () => {
    const nonGitDir = makeTempDir('wt-nongit-');
    try {
      await expect(createWorktree(nonGitDir)).rejects.toThrow('Not a git repository');
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it('worktree has a cleanup function', async () => {
    const ctx = await createWorktree(repoDir);
    expect(typeof ctx.cleanup).toBe('function');
    await ctx.cleanup();

    // After cleanup, worktree should be gone
    const worktreesAfter = listWorktrees(repoDir);
    // Should only have the main repo worktree now
    expect(worktreesAfter.length).toBe(1);
  });
});

// ─── getWorktreeChanges ───────────────────────────────────────

describe('getWorktreeChanges', () => {
  it('returns empty changes for unmodified worktree', async () => {
    const ctx = await createWorktree(repoDir);
    try {
      const changes = await getWorktreeChanges(repoDir, ctx.worktreeDir);
      expect(changes.diff).toBe('');
      expect(changes.newCommits).toEqual([]);
      expect(changes.commitHash).toBeUndefined();
    } finally {
      await ctx.cleanup();
    }
  });

  it('detects uncommitted changes in worktree', async () => {
    const ctx = await createWorktree(repoDir);
    try {
      // Modify a file in the worktree
      writeFileSync(join(ctx.worktreeDir, 'new-file.txt'), 'hello\n');
      execFileSync('git', ['add', '-A'], { cwd: ctx.worktreeDir, stdio: 'pipe' });

      const changes = await getWorktreeChanges(repoDir, ctx.worktreeDir);
      // Diff should include the new file (staged changes)
      expect(changes.diff.length).toBeGreaterThan(0);
    } finally {
      await ctx.cleanup();
    }
  });

  it('detects new commits on worktree branch', async () => {
    const ctx = await createWorktree(repoDir);
    try {
      // Make a new commit in the worktree
      writeFileSync(join(ctx.worktreeDir, 'feature.txt'), 'new feature\n');
      execFileSync('git', ['add', '-A'], { cwd: ctx.worktreeDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'feature commit', '--no-verify'], { cwd: ctx.worktreeDir, stdio: 'pipe' });

      const changes = await getWorktreeChanges(repoDir, ctx.worktreeDir);
      expect(changes.commitHash).toBeDefined();
      expect(changes.newCommits.length).toBe(1);
      expect(changes.newCommits[0]).toContain('feature commit');
    } finally {
      await ctx.cleanup();
    }
  });
});

// ─── mergeWorktree ────────────────────────────────────────────

describe('mergeWorktree', () => {
  it('merges a worktree branch with new commits', async () => {
    const ctx = await createWorktree(repoDir);
    try {
      // Make a commit on the worktree branch
      writeFileSync(join(ctx.worktreeDir, 'merged-file.txt'), 'merged content\n');
      execFileSync('git', ['add', '-A'], { cwd: ctx.worktreeDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'to be merged', '--no-verify'], { cwd: ctx.worktreeDir, stdio: 'pipe' });

      // Merge the worktree branch back
      const result = await mergeWorktree(repoDir, ctx.branch);
      expect(result.success).toBe(true);
      expect(result.message).toContain('merged');

      // Verify the merged file exists in the base repo
      expect(existsSync(join(repoDir, 'merged-file.txt'))).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it('returns failure message for conflict scenario', async () => {
    // Create a file in base repo that will conflict
    writeFileSync(join(repoDir, 'conflict.txt'), 'base content\n');
    execFileSync('git', ['add', '-A'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'conflict base', '--no-verify'], { cwd: repoDir, stdio: 'pipe' });

    const ctx = await createWorktree(repoDir);
    try {
      // Modify the same file differently in the worktree
      writeFileSync(join(ctx.worktreeDir, 'conflict.txt'), 'worktree content\n');
      execFileSync('git', ['add', '-A'], { cwd: ctx.worktreeDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'conflict worktree', '--no-verify'], { cwd: ctx.worktreeDir, stdio: 'pipe' });

      // Now modify the same file on the base branch
      writeFileSync(join(repoDir, 'conflict.txt'), 'different base content\n');
      execFileSync('git', ['add', '-A'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'conflicting change', '--no-verify'], { cwd: repoDir, stdio: 'pipe' });

      const result = await mergeWorktree(repoDir, ctx.branch);
      // Conflict should be detected and merge aborted
      expect(result.success).toBe(false);
      expect(result.message).toContain('conflict');
    } finally {
      await ctx.cleanup();
    }
  });
});

// ─── removeWorktree ───────────────────────────────────────────

describe('removeWorktree', () => {
  it('removes a worktree and its branch', async () => {
    const ctx = await createWorktree(repoDir);
    const { worktreeDir, branch } = ctx;

    await removeWorktree(repoDir, worktreeDir, branch);

    // Worktree should be gone — only the main repo worktree remains
    const worktreesAfter = listWorktrees(repoDir);
    expect(worktreesAfter.length).toBe(1);

    // Branch should be deleted
    expect(branchExists(repoDir, branch)).toBe(false);
  });

  it('force removes a dirty worktree', async () => {
    const ctx = await createWorktree(repoDir);
    const { worktreeDir, branch } = ctx;

    // Dirty the worktree
    writeFileSync(join(worktreeDir, 'uncommitted.txt'), 'dirty\n');

    await removeWorktree(repoDir, worktreeDir, branch, true);

    const worktreesAfter = listWorktrees(repoDir);
    expect(worktreesAfter.length).toBe(1);
  });

  it('handles double-remove gracefully', async () => {
    const ctx = await createWorktree(repoDir);
    const { worktreeDir, branch } = ctx;

    await removeWorktree(repoDir, worktreeDir, branch);
    // Second remove should not throw
    await removeWorktree(repoDir, worktreeDir, branch);
  });
});

// ─── Integration: full lifecycle ──────────────────────────────

describe('worktree lifecycle', () => {
  it('create → modify → collect changes → merge → cleanup', async () => {
    // Create worktree
    const ctx = await createWorktree(repoDir);
    const { worktreeDir, branch } = ctx;

    // Agent makes changes in worktree
    writeFileSync(join(worktreeDir, 'agent-output.txt'), 'result\n');
    execFileSync('git', ['add', '-A'], { cwd: worktreeDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'agent changes', '--no-verify'], { cwd: worktreeDir, stdio: 'pipe' });

    // Collect changes
    const changes = await getWorktreeChanges(repoDir, worktreeDir);
    expect(changes.newCommits.length).toBe(1);
    expect(changes.commitHash).toBeDefined();

    // Merge back
    const mergeResult = await mergeWorktree(repoDir, branch);
    expect(mergeResult.success).toBe(true);

    // Cleanup
    await removeWorktree(repoDir, worktreeDir, branch);

    // Verify final state
    expect(existsSync(join(repoDir, 'agent-output.txt'))).toBe(true);
    expect(branchExists(repoDir, branch)).toBe(false);
    const worktreesAfter = listWorktrees(repoDir);
    expect(worktreesAfter.length).toBe(1);
  });
});
