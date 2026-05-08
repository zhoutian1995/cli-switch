# Roadmap: cli-switch Next Milestone

## Overview

This milestone turns the published v0.3.2 baseline into a tighter v2.0-ready runtime. The order deliberately closes resolver/preflight/error reliability before adding configuration, output repair, stronger sandboxing, and Skill workflow expansion.

## Phases

**Phase Numbering:**
- Integer phases are planned milestone work.
- Decimal phases are urgent insertions.

- [x] **Phase 1: Runtime Contract Closure** - Finish provider/vendor/transport strictness, preflight checks, and error-code closure.
- [x] **Phase 2: Configuration Coverage** - Add global/project/task config layering and config commands.
- [ ] **Phase 3: Output Validation and Repair** - Validate capability outputs and diffs, then add bounded repair.
- [ ] **Phase 4: Execution Isolation** - Add patch-only, temp project copy, and worktree execution modes.
- [ ] **Phase 5: Skill Workflow Foundation** - Add local reusable skill definitions and `skill run`.

## Phase Details

### Phase 1: Runtime Contract Closure
**Goal**: Resolver, doctor, and run paths surface incompatible providers, unsupported platforms, missing binaries, and runtime failures through documented structured errors.
**Depends on**: Nothing (first phase)
**Requirements**: [RT-01, RT-02, RT-03, RT-04]
**Success Criteria** (what must be TRUE):
  1. Explicit provider/vendor/transport conflicts consistently return `RESOLVE_CONFLICT`.
  2. Platform and required binary failures are detected before agent execution where the runtime path can know them.
  3. Public error codes are documented and covered by unit/e2e tests.
  4. Existing v0.3.2 commands remain backward compatible.
**Plans**: 3 plans

Plans:
- [x] 01-01: Audit and tighten provider/vendor/transport resolver contracts.
- [x] 01-02: Unify platform and binary preflight across resolve/doctor/run.
- [x] 01-03: Document and test runtime error-code closure.

### Phase 2: Configuration Coverage
**Goal**: Implement global, project, and task-level config overrides for gateway, routing, tier, and strategy defaults.
**Depends on**: Phase 1
**Requirements**: [CFG-01, CFG-02, CFG-03, CFG-04]
**Success Criteria** (what must be TRUE):
  1. Global `~/.cli-switch/config.yaml` loads with validation and safe errors.
  2. Project `.cli-switch.yaml` deep-merges over global config.
  3. CLI flags remain highest priority.
  4. `cli-switch config show/set/reset --json` works.
**Plans**: 3 plans

Plans:
- [x] 02-01: Add config schema, loader, and precedence rules.
- [x] 02-02: Wire config into gateway/routing/tier/strategy resolution.
- [x] 02-03: Add `config` command group and tests.

### Phase 3: Output Validation and Repair
**Goal**: Turn raw Agent output into validated capability results with bounded repair when schema or diff output is malformed.
**Depends on**: Phase 2
**Requirements**: [OUT-01, OUT-02, OUT-03]
**Success Criteria** (what must be TRUE):
  1. Each capability has a validation schema for required fields.
  2. Unified diff output is parsed and path-checked.
  3. Invalid output either repairs within budget or returns structured failure.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Add capability output schemas and validators.
- [ ] 03-02: Add diff validation and auto-repair pipeline.

### Phase 4: Execution Isolation
**Goal**: Prevent writable agents from directly mutating the real project unless the selected execution mode allows it.
**Depends on**: Phase 3
**Requirements**: [ISO-01, ISO-02, ISO-03]
**Success Criteria** (what must be TRUE):
  1. Patch-only mode can request and validate diffs without direct project writes.
  2. Temp project copy mode runs agents outside the real tree and brings back validated changes.
  3. Worktree mode creates and cleans task-specific worktrees.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Add patch-only execution mode and protected path checks.
- [ ] 04-02: Add temporary project copy execution.
- [ ] 04-03: Add git worktree execution and cleanup.

### Phase 5: Skill Workflow Foundation
**Goal**: Let users define reusable local skill workflows that map to capability, strategy, tier, and prompt templates.
**Depends on**: Phase 2
**Requirements**: [SKL-01, SKL-02]
**Success Criteria** (what must be TRUE):
  1. Local skill definitions load from a documented path and schema.
  2. `cli-switch skill run <name>` resolves a skill into an existing execution strategy.
  3. Invalid skill definitions fail with structured diagnostics.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Define and load local skill workflow schema.
- [ ] 05-02: Add `skill run` command and tests.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Runtime Contract Closure | 3/3 | Completed | 2026-05-08 |
| 2. Configuration Coverage | 3/3 | Completed | 2026-05-08 |
| 3. Output Validation and Repair | 0/2 | Not started | - |
| 4. Execution Isolation | 0/3 | Not started | - |
| 5. Skill Workflow Foundation | 0/2 | Not started | - |
