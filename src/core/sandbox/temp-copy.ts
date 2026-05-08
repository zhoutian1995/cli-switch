/**
 * Temp Copy — create a temporary project copy for isolated agent execution.
 *
 * Copies the project (excluding heavy/irrelevant dirs like .git, node_modules),
 * runs the agent in the copy, then computes diffs afterward.
 *
 * @see docs/specs/sandbox-spec.md §3
 */

import { execSync } from 'node:child_process';
import { cp, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

// ─── Types ────────────────────────────────────────────────────

export interface TempCopyConfig {
  /** Directory/file basenames to skip during copy. */
  excludes: string[];
  /** If true, do not delete the temp dir on cleanup. */
  keepTemp: boolean;
}

export interface TempCopyContext {
  /** Original source directory. */
  srcDir: string;
  /** Path to the temporary copy. */
  copyDir: string;
  /** Remove the temp directory (no-op when keepTemp is true). */
  cleanup: () => Promise<void>;
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_EXCLUDES: string[] = [
  '.git',
  'node_modules',
  '.cli-switch',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
];

// ─── createTempCopy ──────────────────────────────────────────

/**
 * Create a temporary copy of the project directory.
 *
 * Creates a tmpdir under `os.tmpdir()/cli-switch-copy-<timestamp>/`,
 * copies all files from `srcDir` excluding configured patterns,
 * and returns a context with a cleanup function.
 */
export async function createTempCopy(
  srcDir: string,
  config?: Partial<TempCopyConfig>,
): Promise<TempCopyContext> {
  const excludes = config?.excludes ?? DEFAULT_EXCLUDES;
  const keepTemp = config?.keepTemp ?? false;

  const copyDir = await mkdtemp(join(tmpdir(), 'cli-switch-copy-'));

  await copyDirFiltered(srcDir, copyDir, excludes);

  return {
    srcDir,
    copyDir,
    cleanup: async () => {
      if (!keepTemp) {
        await rm(copyDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Recursively copy a directory, skipping entries whose basenames
 * match the exclude list.
 */
async function copyDirFiltered(
  src: string,
  dest: string,
  excludes: string[],
): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (excludes.includes(entry.name)) {
      continue;
    }

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await cp(srcPath, destPath, { recursive: true, force: true });
    } else if (entry.isFile()) {
      // Ensure parent dir exists (for safety)
      await cp(srcPath, destPath, { force: true });
    } else if (entry.isSymbolicLink()) {
      // Preserve symlinks by copying them
      await cp(srcPath, destPath, { force: true });
    }
  }
}

// ─── computeCopyDiff ─────────────────────────────────────────

/**
 * Compute a unified diff between the original source directory and the
 * (potentially modified) copy.
 *
 * Prefers `git diff --no-index` for accurate, proper unified output.
 * Falls back to a manual file-by-file comparison when git is unavailable.
 */
export async function computeCopyDiff(
  srcDir: string,
  copyDir: string,
): Promise<string> {
  // Try git diff --no-index first (works outside git repos)
  try {
    const diff = execSync(
      `git diff --no-index -- "${srcDir}" "${copyDir}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000 },
    );
    // git diff --no-index returns exit code 1 when there are differences
    // but still outputs the diff on stdout
    return diff;
  } catch (err: unknown) {
    // git diff --no-index exits with 1 when there are differences,
    // but stderr may contain the diff or an error message.
    // Check if the error object has stdout with diff content.
    const errorWithOutput = err as { stdout?: string; stderr?: string; message?: string };
    if (errorWithOutput.stdout && errorWithOutput.stdout.includes('diff --git')) {
      return errorWithOutput.stdout;
    }
    if (errorWithOutput.stderr && errorWithOutput.stderr.includes('diff --git')) {
      return errorWithOutput.stderr;
    }

    // If git is not available or failed for another reason, fall back
    return manualDiff(srcDir, copyDir);
  }
}

/**
 * Manual file-by-file diff fallback.
 *
 * Walks both directories, compares files by content, and generates
 * a simplified unified-diff-style output.
 */
async function manualDiff(
  srcDir: string,
  copyDir: string,
): Promise<string> {
  const srcFiles = await listFilesRecursive(srcDir);
  const copyFiles = await listFilesRecursive(copyDir);

  const allPaths = new Set<string>([...Array.from(srcFiles), ...Array.from(copyFiles)]);
  const lines: string[] = [];

  for (const relPath of Array.from(allPaths)) {
    const srcFile = join(srcDir, relPath);
    const copyFile = join(copyDir, relPath);

    const srcExists = srcFiles.has(relPath);
    const copyExists = copyFiles.has(relPath);

    if (!srcExists && copyExists) {
      // New file in copy
      lines.push(`diff --git a/${relPath} b/${relPath}`);
      lines.push('new file mode 100644');
      try {
        const { readFile } = await import('node:fs/promises');
        const content = await readFile(copyFile, 'utf-8');
        lines.push(`--- /dev/null`);
        lines.push(`+++ b/${relPath}`);
        lines.push('@@ -0,0 +1,' + content.split('\n').length + ' @@');
        for (const line of content.split('\n')) {
          lines.push(`+${line}`);
        }
      } catch {
        lines.push(`+++ b/${relPath}`);
        lines.push('@@ -0,0 +1,1 @@');
        lines.push('+[binary or unreadable]');
      }
    } else if (srcExists && !copyExists) {
      // Deleted in copy
      lines.push(`diff --git a/${relPath} b/${relPath}`);
      lines.push('deleted file mode 100644');
      try {
        const { readFile } = await import('node:fs/promises');
        const content = await readFile(srcFile, 'utf-8');
        lines.push(`--- a/${relPath}`);
        lines.push('+++ /dev/null');
        lines.push('@@ -1,' + content.split('\n').length + ' +0,0 @@');
        for (const line of content.split('\n')) {
          lines.push(`-${line}`);
        }
      } catch {
        lines.push(`--- a/${relPath}`);
        lines.push('+++ /dev/null');
        lines.push('@@ -1,1 +0,0 @@');
        lines.push('-[binary or unreadable]');
      }
    } else {
      // Both exist — compare content
      try {
        const { readFile } = await import('node:fs/promises');
        const srcContent = await readFile(srcFile, 'utf-8');
        const copyContent = await readFile(copyFile, 'utf-8');

        if (srcContent === copyContent) continue;

        const srcLines = srcContent.split('\n');
        const copyLines = copyContent.split('\n');

        lines.push(`diff --git a/${relPath} b/${relPath}`);
        lines.push(`--- a/${relPath}`);
        lines.push(`+++ b/${relPath}`);

        // Simple line-by-line diff
        const maxLen = Math.max(srcLines.length, copyLines.length);
        const chunks: string[] = [];
        let inChange = false;
        let changeStartSrc = 1;
        let changeStartCopy = 1;
        let removed = 0;
        let added = 0;

        for (let i = 0; i < maxLen; i++) {
          const oldLine = i < srcLines.length ? srcLines[i] : undefined;
          const newLine = i < copyLines.length ? copyLines[i] : undefined;

          if (oldLine === newLine) {
            if (inChange) {
              chunks.push(
                `@@ -${changeStartSrc},${removed} +${changeStartCopy},${added} @@`,
              );
              for (let j = 0; j < removed; j++) {
                chunks.push(`-${srcLines[changeStartSrc - 1 + j]}`);
              }
              for (let j = 0; j < added; j++) {
                chunks.push(`+${copyLines[changeStartCopy - 1 + j]}`);
              }
              inChange = false;
              removed = 0;
              added = 0;
            }
          } else {
            if (!inChange) {
              changeStartSrc = i + 1;
              changeStartCopy = i + 1;
              inChange = true;
            }
            if (oldLine !== undefined) {
              removed++;
            }
            if (newLine !== undefined) {
              added++;
            }
          }
        }

        // Flush remaining change
        if (inChange) {
          chunks.push(
            `@@ -${changeStartSrc},${removed} +${changeStartCopy},${added} @@`,
          );
          for (let j = 0; j < removed; j++) {
            chunks.push(`-${srcLines[changeStartSrc - 1 + j]}`);
          }
          for (let j = 0; j < added; j++) {
            chunks.push(`+${copyLines[changeStartCopy - 1 + j]}`);
          }
        }

        if (chunks.length > 0) {
          lines.push(...chunks);
        }
      } catch {
        // Binary or unreadable — skip
      }
    }
  }

  return lines.join('\n');
}

/**
 * Recursively list all file paths relative to the given root directory.
 */
async function listFilesRecursive(root: string): Promise<Set<string>> {
  const files = new Set<string>();

  async function walk(dir: string, prefix: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(join(dir, entry.name), rel);
        } else if (entry.isFile()) {
          files.add(rel);
        }
      }
    } catch {
      // Permission errors, etc. — skip
    }
  }

  await walk(root, '');
  return files;
}
