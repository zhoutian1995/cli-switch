/**
 * Diff Validator — unified diff parser + path validator.
 *
 * Parses unified diff output, extracts file paths and hunk metadata,
 * and validates file paths against protected path configuration.
 *
 * @see docs/specs/sandbox-spec.md §3 (protected_paths)
 */

// ─── Types ────────────────────────────────────────────────────

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

export interface DiffFile {
  path: string;
  hunks: DiffHunk[];
}

export interface DiffParseResult {
  valid: boolean;
  files: DiffFile[];
  errors: string[];
}

export interface ProtectedPathConfig {
  paths: string[];
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_PROTECTED_PATHS: string[] = ['.git/', 'node_modules/', '.env'];

// ─── Diff Parser ──────────────────────────────────────────────

/**
 * Parse a unified diff string into structured DiffFile objects.
 *
 * Handles: standard unified diffs, binary markers, no-newline-at-EOF markers,
 * empty input, and multi-file diffs.
 */
export function parseUnifiedDiff(diffText: string): DiffParseResult {
  // Empty or whitespace-only input
  if (!diffText || !diffText.trim()) {
    return { valid: false, files: [], errors: ['Empty diff'] };
  }

  // Split by "diff --git" headers
  const blocks = diffText.split(/^diff --git /m).filter(b => b.trim());

  if (blocks.length === 0) {
    return { valid: false, files: [], errors: ['No diff blocks found'] };
  }

  const files: DiffFile[] = [];
  const errors: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');

    // Extract path from "--- a/path" line
    const path = extractPath(lines);
    if (!path) {
      errors.push('Could not extract file path from diff block');
      continue;
    }

    // Check for binary file marker
    const isBinary = lines.some(l => l.startsWith('Binary files'));

    // Parse hunks
    const hunks: DiffHunk[] = [];
    if (!isBinary) {
      let currentHunk: DiffHunk | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match @@ hunk header
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch) {
          if (currentHunk) {
            hunks.push(currentHunk);
          }
          currentHunk = {
            header: line,
            oldStart: parseInt(hunkMatch[1], 10),
            oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
            newStart: parseInt(hunkMatch[3], 10),
            newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
            lines: [],
          };
          continue;
        }

        // Collect hunk content lines (+/-/space lines, and "no newline at EOF" markers)
        if (currentHunk) {
          if (
            line.startsWith('+') ||
            line.startsWith('-') ||
            line.startsWith(' ') ||
            line.startsWith('\\') // "\ No newline at end of file"
          ) {
            currentHunk.lines.push(line);
          }
        }
      }

      if (currentHunk) {
        hunks.push(currentHunk);
      }
    }

    files.push({ path, hunks });
  }

  return {
    valid: errors.length === 0 && files.length > 0,
    files,
    errors,
  };
}

/**
 * Extract file path from the "--- a/path" line in a diff block.
 * Strips the "a/" prefix.
 */
function extractPath(lines: string[]): string | null {
  for (const line of lines) {
    if (line.startsWith('--- a/')) {
      // Strip "--- a/" prefix, return the path
      return line.slice(6);
    }
    // Also handle "--- /dev/null" for new files — look at +++ b/path instead
  }
  // Fallback: try +++ b/path
  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      return line.slice(6);
    }
  }
  return null;
}

// ─── Path Validator ───────────────────────────────────────────

/**
 * Validate diff file paths against protected path configuration.
 *
 * Checks each file path against the list of protected paths.
 * A path is considered a violation if it starts with any protected path.
 */
export function validateDiffPaths(
  files: DiffFile[],
  config?: Partial<ProtectedPathConfig>,
): { violations: string[]; clean: boolean } {
  const paths = config?.paths ?? DEFAULT_PROTECTED_PATHS;
  const violations: string[] = [];

  for (const file of files) {
    for (const protectedPath of paths) {
      // Glob-style check: *.lock pattern
      if (protectedPath.startsWith('*')) {
        const suffix = protectedPath.slice(1); // e.g., ".lock"
        if (file.path.endsWith(suffix)) {
          violations.push(`${file.path} matches protected pattern ${protectedPath}`);
        }
      } else {
        // Directory/prefix check
        if (file.path === protectedPath || file.path.startsWith(protectedPath)) {
          violations.push(`${file.path} matches protected path ${protectedPath}`);
        }
      }
    }
  }

  return { violations, clean: violations.length === 0 };
}
