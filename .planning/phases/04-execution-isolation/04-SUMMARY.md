---
phase: 4
title: Execution Isolation
status: completed
plans_completed: 3
requirements:
  - ISO-01
  - ISO-02
  - ISO-03
test_count: 579
files_added:
  - src/core/sandbox/execution-mode.ts
  - src/core/sandbox/patch-collector.ts
  - src/core/sandbox/temp-copy.ts
  - src/core/sandbox/worktree.ts
  - test/unit/execution-mode.test.ts
  - test/unit/patch-collector.test.ts
  - test/unit/temp-copy.test.ts
  - test/unit/worktree.test.ts
files_modified:
  - cmd/run.ts
  - src/core/sandbox/index.ts
commits:
  - f145334
  - 5dcd7db
  - 7e003fc
completed: "2026-05-08"
---

# Phase 04: Execution Isolation — Summary

## Overview

Phase 04 adds three execution isolation modes that prevent writable agents from directly mutating the real project unless the selected mode allows it. All three modes integrate with the existing `--mode`, `--execution`, and strategy engine flags.

## Plans Completed

| Plan | Commit | Description | Tests |
|------|--------|-------------|-------|
| 04-01 | `f145334` | Patch-only execution mode with protected path checks | 34 |
| 04-02 | `5dcd7db` | Temporary project copy execution | 12 |
| 04-03 | `7e003fc` | Git worktree execution and cleanup | 16 |

**Total test results:** 579 passed, 1 failed (pre-existing Hermes env), 1 skipped.

## What Was Built

### 1. Patch-Only Execution Mode (04-01)
- `src/core/sandbox/execution-mode.ts` — ExecutionMode enum and mode resolution logic.
- `src/core/sandbox/patch-collector.ts` — Parses unified diffs from agent stdout, validates paths via `validateDiffPaths()`, and optionally applies after confirmation.
- `--execution-mode patch-only` CLI flag instructs the agent to produce diffs instead of direct writes.
- `--patch-apply` flag (default off) for dry-run diff review; diffs collected but not applied unless requested.
- Protected path validation reuses Phase 03's `validateDiffPaths()`.

### 2. Temp Project Copy Execution (04-02)
- `src/core/sandbox/temp-copy.ts` — Creates a lightweight project copy (excluding `.git`, `node_modules`, `.cli-switch`) in a tmpdir, runs the agent there, then computes diffs against the original.
- Uses `rsync` when available with exclude list; falls back to recursive copy.
- Diff computed via `git diff --no-index` or manual file comparison.
- `--keep-temp` flag to retain the temp copy for inspection.
- Automatic cleanup after execution.

### 3. Git Worktree Execution (04-03)
- `src/core/sandbox/worktree.ts` — Uses `git worktree add` to create task-specific worktrees from the current branch.
- Agent runs in the worktree with its own working tree but shared `.git` object store.
- Post-execution, changes are available as commits in the worktree branch for merge/cherry-pick.
- `git worktree remove` for cleanup; force-remove with warning on uncommitted changes.
- Non-git projects produce a clear error.

### Integration
- `cmd/run.ts` extended with `--execution-mode` flag (`default`, `patch-only`, `temp-copy`, `worktree`).
- `src/core/sandbox/index.ts` exports new modules and re-exports from the sandbox entry point.
- New error codes: `EXEC_MODE_INVALID`, `TEMP_COPY_FAILED`, `WORKTREE_CREATE_FAILED`, `WORKTREE_CLEANUP_FAILED`, `PATCH_APPLY_FAILED`.

## Requirements Satisfied

| Requirement | Status | Verification |
|-------------|--------|-------------|
| ISO-01 | ✅ Done | Patch-only mode collects diffs without direct project writes |
| ISO-02 | ✅ Done | Temp copy runs agents outside the real working tree |
| ISO-03 | ✅ Done | Worktree mode creates, uses, and cleans task-specific git worktrees |
