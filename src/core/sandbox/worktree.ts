/**
 * Git Worktree execution mode.
 *
 * Creates isolated git worktrees for agent execution, allowing the agent
 * to work in a real git repository with full dependency support while
 * keeping changes on a separate branch.
 *
 * @see docs/specs/sandbox-spec.md §3
 */

import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// ─── Types ────────────────────────────────────────────────────

export interface WorktreeConfig {
  /** Branch name prefix (default: "wt-") */
  branchPrefix: string;
  /** Force worktree removal even if dirty */
  force: boolean;
}

export interface WorktreeContext {
  /** Absolute path to the worktree directory */
  worktreeDir: string;
  /** Name of the worktree branch */
  branch: string;
  /** Cleanup function: removes worktree and branch */
  cleanup: () => Promise<void>;
}

export interface WorktreeChanges {
  /** Unified diff of uncommitted changes in the worktree */
  diff: string;
  /** Commit hash of the latest commit on the worktree branch (if any new commits) */
  commitHash?: string;
  /** New commits on the worktree branch (oneline log) */
  newCommits: string[];
}

export interface MergeResult {
  success: boolean;
  message: string;
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: WorktreeConfig = {
  branchPrefix: 'wt-',
  force: false,
};

// ─── Git helper ───────────────────────────────────────────────

/**
 * Execute a git command synchronously and return trimmed stdout.
 * Throws on non-zero exit code with stderr message.
 */
function git(args: string[], cwd?: string): string {
  const result = execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.trim();
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Check if a directory is inside a git repository.
 */
export function isGitRepo(dir: string): boolean {
  try {
    const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output === 'true';
  } catch {
    return false;
  }
}

/**
 * Create a git worktree for isolated execution.
 *
 * Creates a new branch with a unique name and a worktree directory
 * in the system temp folder.
 *
 * @param baseDir - The base git repository directory
 * @param config - Optional worktree configuration
 * @returns WorktreeContext with worktreeDir, branch, and cleanup function
 * @throws Error if baseDir is not a git repository or worktree creation fails
 */
export async function createWorktree(
  baseDir: string,
  config?: Partial<WorktreeConfig>,
): Promise<WorktreeContext> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Verify base directory is a git repo
  if (!isGitRepo(baseDir)) {
    throw new Error(`Not a git repository: ${baseDir}`);
  }

  // Generate unique branch name: wt-{timestamp}-{random8}
  const timestamp = Date.now();
  const shortId = Math.random().toString(36).slice(2, 10);
  const branch = `${cfg.branchPrefix}${timestamp}-${shortId}`;

  // Create temp directory for the worktree (git worktree add needs parent to exist)
  const parentDir = await mkdtemp(join(tmpdir(), 'cli-switch-worktree-'));
  const worktreeDir = join(parentDir, 'work');

  // Create the worktree with a new branch
  try {
    git(['worktree', 'add', worktreeDir, '-b', branch], baseDir);
  } catch (err) {
    // Clean up temp parent dir on failure
    await rm(parentDir, { recursive: true, force: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create worktree: ${msg}`);
  }

  const cleanup = async () => {
    try {
      await removeWorktree(baseDir, worktreeDir, branch, cfg.force);
    } catch {
      // Best-effort cleanup
    }
  };

  return { worktreeDir, branch, cleanup };
}

/**
 * Get changes from a worktree branch compared to the base branch.
 *
 * Returns uncommitted diff and any new commits on the worktree branch.
 *
 * @param baseDir - The base git repository directory
 * @param worktreeDir - The worktree directory path
 * @returns WorktreeChanges with diff, commitHash, and newCommits
 */
export async function getWorktreeChanges(
  baseDir: string,
  worktreeDir: string,
): Promise<WorktreeChanges> {
  // Get uncommitted changes in the worktree (staged + unstaged)
  let diff = '';
  try {
    diff = git(['diff', 'HEAD'], worktreeDir);
  } catch {
    diff = '';
  }

  // Get new commits on the worktree branch (commits not reachable from base HEAD)
  let newCommits: string[] = [];
  let commitHash: string | undefined;

  try {
    const baseHead = git(['rev-parse', 'HEAD'], baseDir);
    const wtHead = git(['rev-parse', 'HEAD'], worktreeDir);

    if (baseHead !== wtHead) {
      commitHash = wtHead;
      const log = git(['log', '--oneline', `${baseHead}..HEAD`], worktreeDir);
      newCommits = log ? log.split('\n').filter(Boolean) : [];
    }
  } catch {
    // Worktree might have no new commits — that's fine
  }

  return { diff, commitHash, newCommits };
}

/**
 * Merge a worktree branch into the current branch of the base repository.
 *
 * Uses --no-ff to always create a merge commit, preserving worktree history.
 *
 * @param baseDir - The base git repository directory
 * @param branch - The worktree branch name to merge
 * @returns MergeResult with success status and message
 */
export async function mergeWorktree(
  baseDir: string,
  branch: string,
): Promise<MergeResult> {
  try {
    git(['merge', branch, '--no-ff', '-m', `Merge worktree branch '${branch}'`], baseDir);
    return { success: true, message: `Successfully merged branch '${branch}'` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Check for conflict markers in stdout/stderr (git outputs conflict info to stdout)
    const errObj = err as { stdout?: string; stderr?: string };
    const output = [errObj.stdout ?? '', errObj.stderr ?? '', msg].join('\n');
    if (output.includes('CONFLICT') || output.includes('conflict')) {
      // Attempt to abort the merge to leave the repo in a clean state
      try {
        git(['merge', '--abort'], baseDir);
      } catch {
        // ignore
      }
      return {
        success: false,
        message: `Merge conflicts detected. Merge aborted. Use manual merge: git merge ${branch}`,
      };
    }
    return { success: false, message: `Merge failed: ${msg}` };
  }
}

/**
 * Remove a worktree and its associated branch.
 *
 * @param baseDir - The base git repository directory
 * @param worktreeDir - The worktree directory path
 * @param branch - The worktree branch name
 * @param force - Force removal even if the worktree has uncommitted changes
 * @throws Error if removal fails
 */
export async function removeWorktree(
  baseDir: string,
  worktreeDir: string,
  branch: string,
  force?: boolean,
): Promise<void> {
  // Remove the worktree
  const removeArgs = ['worktree', 'remove'];
  if (force) removeArgs.push('--force');
  removeArgs.push(worktreeDir);

  try {
    git(removeArgs, baseDir);
  } catch {
    // If worktree remove fails, try force
    if (!force) {
      try {
        git(['worktree', 'remove', '--force', worktreeDir], baseDir);
      } catch {
        // Last resort: just remove the directory
        try {
          await rm(worktreeDir, { recursive: true, force: true });
        } catch {
          // give up
        }
      }
    } else {
      try {
        await rm(worktreeDir, { recursive: true, force: true });
      } catch {
        // give up
      }
    }
  }

  // Clean up the parent temp directory if it's now empty
  try {
    const parentDir = dirname(worktreeDir);
    await rm(parentDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  // Delete the branch (use -D for force, -d for normal)
  try {
    if (force) {
      git(['branch', '-D', branch], baseDir);
    } else {
      git(['branch', '-d', branch], baseDir);
    }
  } catch {
    // Branch deletion can fail if it's checked out elsewhere or not fully merged.
    // Force-delete if normal delete fails.
    if (!force) {
      try {
        git(['branch', '-D', branch], baseDir);
      } catch {
        // Branch will be cleaned up later
      }
    }
  }
}
