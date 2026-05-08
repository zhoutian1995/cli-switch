/**
 * Patch Collector — extracts diffs from agent output, validates paths,
 * and optionally applies via git apply.
 *
 * @see docs/specs/sandbox-spec.md §3
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  parseUnifiedDiff,
  validateDiffPaths,
  type DiffFile,
  type DiffParseResult,
} from '../validation/diff-validator.js';

// ─── Types ────────────────────────────────────────────────────

export interface PatchResult {
  diffs: DiffFile[];
  violations: string[];
  clean: boolean;
  rawDiffs: string;
}

export interface ApplyResult {
  success: boolean;
  applied: boolean;
  error?: string;
}

// ─── Collector ────────────────────────────────────────────────

/**
 * Collect patches from agent output.
 *
 * Extracts diff blocks from agent output (split by "diff --git" and
 * rejoin with headers), parses them via parseUnifiedDiff(), and validates
 * paths via validateDiffPaths().
 */
export function collectPatches(agentOutput: string): PatchResult {
  // Extract diff blocks from agent output
  const rawDiffs = extractDiffBlocks(agentOutput);

  if (!rawDiffs) {
    return { diffs: [], violations: [], clean: true, rawDiffs: '' };
  }

  // Parse the unified diffs
  const parseResult: DiffParseResult = parseUnifiedDiff(rawDiffs);

  // Validate paths
  const { violations, clean } = validateDiffPaths(parseResult.files);

  return {
    diffs: parseResult.files,
    violations,
    clean,
    rawDiffs,
  };
}

/**
 * Extract diff blocks from arbitrary agent output text.
 * Splits by "diff --git" and reassembles valid unified diff text.
 */
export function extractDiffBlocks(output: string): string {
  // Split on "diff --git" lines
  const parts = output.split(/(?=^diff --git )/m).filter(p => p.trim());

  if (parts.length === 0) {
    return '';
  }

  // Validate that we actually have diff-like content
  const hasDiffContent = parts.some(part =>
    part.includes('--- ') && part.includes('+++ '),
  );

  if (!hasDiffContent) {
    return '';
  }

  return parts.join('');
}

// ─── Applier ──────────────────────────────────────────────────

/**
 * Apply a diff using `git apply`.
 *
 * Uses `git apply --check` first for validation. If `dryRun` is true,
 * only runs the check without applying. Returns a result indicating
 * success/failure.
 */
export function applyPatch(
  diffText: string,
  cwd?: string,
  dryRun?: boolean,
): ApplyResult {
  const workingDir = cwd ?? process.cwd();
  const gitDir = join(workingDir, '.git');

  // Check if we're in a git repository
  if (!existsSync(gitDir)) {
    return { success: false, applied: false, error: 'Not in a git repository' };
  }

  try {
    // Validate the patch first
    execSync('git apply --check', {
      cwd: workingDir,
      input: diffText,
      stdio: 'pipe',
      timeout: 30_000,
    });
  } catch (err) {
    const stderr = err instanceof Error && 'stderr' in err
      ? String((err as { stderr: Buffer }).stderr)
      : String(err);
    return { success: false, applied: false, error: `Patch validation failed: ${stderr.trim()}` };
  }

  // If dry-run, we're done after validation
  if (dryRun) {
    return { success: true, applied: false };
  }

  // Apply the patch
  try {
    execSync('git apply', {
      cwd: workingDir,
      input: diffText,
      stdio: 'pipe',
      timeout: 30_000,
    });
    return { success: true, applied: true };
  } catch (err) {
    const stderr = err instanceof Error && 'stderr' in err
      ? String((err as { stderr: Buffer }).stderr)
      : String(err);
    return { success: false, applied: false, error: `Patch apply failed: ${stderr.trim()}` };
  }
}
