/**
 * Execution Mode unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  parseExecutionMode,
  getPatchOnlyPromptSuffix,
  getExecutionModeConfig,
  type ExecutionMode,
} from '../../src/core/sandbox/execution-mode.js';

// ─── parseExecutionMode ──────────────────────────────────────

describe('parseExecutionMode', () => {
  it('returns "default" for undefined input', () => {
    expect(parseExecutionMode(undefined)).toBe('default');
  });

  it('returns "default" for empty string', () => {
    expect(parseExecutionMode('')).toBe('default');
  });

  it('parses "default"', () => {
    expect(parseExecutionMode('default')).toBe('default');
  });

  it('parses "patch-only"', () => {
    expect(parseExecutionMode('patch-only')).toBe('patch-only');
  });

  it('parses "temp-copy"', () => {
    expect(parseExecutionMode('temp-copy')).toBe('temp-copy');
  });

  it('parses "worktree"', () => {
    expect(parseExecutionMode('worktree')).toBe('worktree');
  });

  it('throws for invalid mode', () => {
    expect(() => parseExecutionMode('invalid')).toThrow('Invalid execution mode');
    expect(() => parseExecutionMode('patchonly')).toThrow('Invalid execution mode');
  });

  it('includes valid modes in error message', () => {
    try {
      parseExecutionMode('bogus');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain('default');
      expect(message).toContain('patch-only');
      expect(message).toContain('temp-copy');
      expect(message).toContain('worktree');
    }
  });
});

// ─── getPatchOnlyPromptSuffix ────────────────────────────────

describe('getPatchOnlyPromptSuffix', () => {
  it('returns a non-empty string', () => {
    const suffix = getPatchOnlyPromptSuffix();
    expect(suffix.length).toBeGreaterThan(0);
  });

  it('contains "unified diff" instruction', () => {
    const suffix = getPatchOnlyPromptSuffix();
    expect(suffix).toContain('unified diff');
  });

  it('contains "diff --git" example', () => {
    const suffix = getPatchOnlyPromptSuffix();
    expect(suffix).toContain('diff --git');
  });

  it('contains "Do NOT modify" warning', () => {
    const suffix = getPatchOnlyPromptSuffix();
    expect(suffix).toContain('Do NOT modify');
  });

  it('contains "Do not run any write commands" warning', () => {
    const suffix = getPatchOnlyPromptSuffix();
    expect(suffix).toContain('Do not run any write commands');
  });
});

// ─── getExecutionModeConfig ──────────────────────────────────

describe('getExecutionModeConfig', () => {
  it('default mode modifies project', () => {
    const config = getExecutionModeConfig('default');
    expect(config.modifiesProject).toBe(true);
    expect(config.requiresGit).toBe(false);
    expect(config.promptSuffix).toBeUndefined();
  });

  it('patch-only mode does not modify project', () => {
    const config = getExecutionModeConfig('patch-only');
    expect(config.modifiesProject).toBe(false);
    expect(config.requiresGit).toBe(false);
    expect(config.promptSuffix).toBeDefined();
  });

  it('patch-only config has prompt suffix matching getPatchOnlyPromptSuffix', () => {
    const config = getExecutionModeConfig('patch-only');
    expect(config.promptSuffix).toBe(getPatchOnlyPromptSuffix());
  });

  it('temp-copy mode does not modify project', () => {
    const config = getExecutionModeConfig('temp-copy');
    expect(config.modifiesProject).toBe(false);
    expect(config.requiresGit).toBe(false);
  });

  it('worktree mode requires git', () => {
    const config = getExecutionModeConfig('worktree');
    expect(config.requiresGit).toBe(true);
    expect(config.modifiesProject).toBe(false);
  });
});
