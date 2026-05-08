/**
 * Execution Mode — defines how agent output is handled.
 *
 * Modes:
 *  - default:    Agent writes directly to the project filesystem.
 *  - patch-only: Agent outputs unified diffs; changes are collected, validated,
 *                and optionally applied via git apply.
 *  - temp-copy:  Agent runs against a temporary copy of the project.
 *  - worktree:   Agent runs in a git worktree.
 *
 * @see docs/specs/sandbox-spec.md §3
 */

// ─── Types ────────────────────────────────────────────────────

export type ExecutionMode = 'default' | 'patch-only' | 'temp-copy' | 'worktree';

export interface ExecutionModeConfig {
  requiresGit: boolean;
  modifiesProject: boolean;
  promptSuffix?: string;
}

// ─── Valid modes ──────────────────────────────────────────────

const VALID_MODES: readonly ExecutionMode[] = [
  'default',
  'patch-only',
  'temp-copy',
  'worktree',
] as const;

// ─── Prompt suffix ────────────────────────────────────────────

/**
 * Returns the prompt suffix for patch-only mode.
 * Instructs the agent to output unified diffs instead of modifying files.
 */
export function getPatchOnlyPromptSuffix(): string {
  return (
    '\n\nIMPORTANT: Do NOT modify any files directly. ' +
    'Output your changes as unified diff format (diff --git ...). ' +
    'Do not run any write commands.'
  );
}

// ─── Parser ───────────────────────────────────────────────────

/**
 * Parse a raw string into an ExecutionMode.
 * Returns 'default' when input is undefined or empty.
 * Throws if input is not a valid mode.
 */
export function parseExecutionMode(input: string | undefined): ExecutionMode {
  if (!input) return 'default';
  if (VALID_MODES.includes(input as ExecutionMode)) {
    return input as ExecutionMode;
  }
  throw new Error(
    `Invalid execution mode: "${input}". Must be one of: ${VALID_MODES.join(', ')}`,
  );
}

// ─── Config ───────────────────────────────────────────────────

/**
 * Returns the configuration for a given execution mode.
 */
export function getExecutionModeConfig(mode: ExecutionMode): ExecutionModeConfig {
  switch (mode) {
    case 'default':
      return { requiresGit: false, modifiesProject: true };
    case 'patch-only':
      return {
        requiresGit: false,
        modifiesProject: false,
        promptSuffix: getPatchOnlyPromptSuffix(),
      };
    case 'temp-copy':
      return { requiresGit: false, modifiesProject: false };
    case 'worktree':
      return { requiresGit: true, modifiesProject: false };
  }
}
