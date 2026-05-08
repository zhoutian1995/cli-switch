# Phase 4: Execution Isolation - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Prevent writable agents from directly mutating the real project unless the selected execution mode allows it. This phase adds patch-only mode, temp project copy execution, and git worktree execution. It must not implement skill workflows (Phase 5).

Current state: `src/core/sandbox/index.ts` already provides HOME isolation and environment variable cleanup. `GitGuard` provides branch/checkpoint management. Neither prevents the agent from writing directly to the real project directory. The `ProcessManager.spawnAgent()` accepts a `cwd` option but always uses the real working tree.

</domain>

<decisions>
## Implementation Decisions

### Patch-only mode
- **D-01:** Add `--execution-mode` flag to `cli-switch run` with values: `default` (current behavior), `patch-only`, `temp-copy`, `worktree`.
- **D-02:** Patch-only mode sets `output_mode: patch` — the agent is instructed via prompt to produce unified diffs instead of writing files directly. cli-switch collects stdout, parses diffs via `parseUnifiedDiff()`, validates paths, and optionally applies them after user confirmation.
- **D-03:** Patch-only mode adds `--patch-apply` flag (default: false) — diffs are collected but not applied unless explicitly requested. This enables dry-run review of changes.
- **D-04:** Patch-only mode does NOT use file system restrictions (no chroot, no LD_PRELOAD). It relies on prompt engineering + post-hoc diff collection. True FS isolation requires temp-copy or worktree.

### Temp project copy
- **D-05:** Temp copy mode creates a lightweight copy of the project (files only, no .git, no node_modules) in a tmpdir, runs the agent there, then collects diffs against the original.
- **D-06:** Copy strategy: use `rsync --exclude='.git' --exclude='node_modules' --exclude='.cli-switch'` if available, fallback to recursive copy with exclude list.
- **D-07:** After agent finishes, compute diff between original and copy using `git diff --no-index` (works without git) or manual file comparison.
- **D-08:** Temp copy is cleaned up after execution unless `--keep-temp` is set.

### Git worktree mode
- **D-09:** Worktree mode uses `git worktree add` to create a task-specific worktree from the current branch.
- **D-10:** The agent runs in the worktree directory with its own working tree but shared .git.
- **D-11:** After agent finishes, changes are available as commits in the worktree branch. cli-switch can offer to merge or cherry-pick.
- **D-12:** Worktree cleanup uses `git worktree remove` — always succeeds unless worktree has uncommitted changes (handled with force remove + warning).

### Integration with existing features
- **D-13:** Execution modes compose with existing `--mode` (single/orchestrator/handoff/review) and `--execution` (single/write_review/write_test_fix/high_quality) flags.
- **D-14:** Execution modes work with strategy engine — the executor runs in the isolated environment, results flow back normally.
- **D-15:** `--dry-run` is independent of execution mode — it shows routing decision without executing regardless of isolation level.

### Error codes
- **D-16:** New error codes: `EXEC_MODE_INVALID`, `TEMP_COPY_FAILED`, `WORKTREE_CREATE_FAILED`, `WORKTREE_CLEANUP_FAILED`, `PATCH_APPLY_FAILED`.

### Protected paths
- **D-17:** Reuse `validateDiffPaths()` from Phase 03 for path checking in all execution modes when applying changes.

### the agent's Discretion
- Exact temp copy strategy and fallback logic.
- How to handle non-git projects in worktree mode (error out).
- Whether to add a `cleanup` subcommand (not required for this phase).

</decisions>

<specifics>
## Specific Ideas

- `src/core/sandbox/index.ts` already has `createSandbox()` with HOME isolation — extend rather than replace.
- `src/core/dispatcher/process-manager.ts` already takes `cwd` — execution modes primarily change the cwd and add pre/post execution hooks.
- `src/core/git/guard.ts` already has `createAgentBranch()` and `checkpoint()` — worktree mode can leverage these.
- `src/core/validation/diff-validator.ts` from Phase 03 provides `parseUnifiedDiff()` and `validateDiffPaths()` — reuse for patch-only mode.
- The `runSingle()` function in `cmd/run.ts` is the main integration point for all three execution modes.
- For strategy engine integration, the `StepExecutor` interface already takes `prompt` and `context` — the cwd change happens at the process level, not the executor level.

</specifics>

<canonical_refs>
## Canonical References

### Specs
- `docs/specs/sandbox-spec.md` §3 (file system security, protected_paths, output_mode patch).
- `docs/specs/sandbox-spec.md` §4 (config scope — task-level > project > global).
- `docs/specs/runtime-spec.md` §1.2 (ExecutionState).

### Source code
- `src/core/sandbox/index.ts` — existing sandbox with HOME isolation.
- `src/core/dispatcher/process-manager.ts` — process spawning with cwd option.
- `src/core/git/guard.ts` — GitGuard with branch/checkpoint management.
- `src/core/validation/diff-validator.ts` — diff parser and path validator (Phase 03).
- `cmd/run.ts` — CLI integration, RunOptions interface.
- `src/types/config.ts` — existing config sections (execution, loop).

### Planning
- `.planning/ROADMAP.md` — Phase 4 goals, requirements, success criteria.
- `.planning/REQUIREMENTS.md` — ISO-01, ISO-02, ISO-03 definitions.

</canonical_refs>
