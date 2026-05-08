# Requirements: cli-switch Next Milestone

**Defined:** 2026-05-08
**Core Value:** AI agents can call coding capabilities through one stable CLI/JSON interface without hard-coding agent, model, gateway, or execution details.

## v1 Requirements

### Runtime Reliability

- [ ] **RT-01**: Explicit provider/vendor/transport requests fail with structured `RESOLVE_CONFLICT` when incompatible.
- [ ] **RT-02**: Tool/profile platform constraints are checked before command execution across resolve, doctor, and run paths where applicable.
- [ ] **RT-03**: Required binaries are checked before execution and surfaced as structured `BINARY_NOT_FOUND` diagnostics.
- [ ] **RT-04**: Error codes used by resolver, run, strategy, gateway, sandbox, and config paths are documented and covered by tests.

### Configuration

- [ ] **CFG-01**: Global `~/.cli-switch/config.yaml` can define gateway, routing, tier, strategy, and loop defaults.
- [ ] **CFG-02**: Project `.cli-switch.yaml` can override global config via deep merge.
- [ ] **CFG-03**: CLI task options override project and global config.
- [ ] **CFG-04**: `cli-switch config show/set/reset` exists with JSON output support.

### Execution Output

- [ ] **OUT-01**: Capability outputs can be validated against schemas for status, summary, and capability-specific fields.
- [ ] **OUT-02**: Diff output can be parsed and validated before apply or reporting.
- [ ] **OUT-03**: Invalid output can trigger bounded auto-repair or structured failure.

### Isolation

- [ ] **ISO-01**: Patch-only execution can collect diffs without allowing direct writes to the real project.
- [ ] **ISO-02**: Temporary project copy execution can run agents away from the real working tree.
- [ ] **ISO-03**: Worktree execution can create, use, and clean task-specific git worktrees.

### Skill Workflow

- [ ] **SKL-01**: Basic Skill workflow definitions map reusable task templates to capability/strategy execution.
- [ ] **SKL-02**: `cli-switch skill run <name>` can execute a registered local skill.

## v2 Requirements

### Deferred Product Expansion

- **UI-01**: Desktop/mobile/web remote control surface.
- **DMN-01**: Long-running daemon with attach/send/list session control.
- **RLY-01**: Encrypted relay for remote agent access.
- **MKT-01**: Skill marketplace or community registry.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Directly copying Paseo code | Paseo is AGPL-3.0; cli-switch is MIT. |
| Mobile or desktop client | Current milestone targets CLI/runtime reliability. |
| Full daemon/session architecture | Useful later, but not required for PRD short-term gaps. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RT-01 | Phase 1 | Pending |
| RT-02 | Phase 1 | Pending |
| RT-03 | Phase 1 | Pending |
| RT-04 | Phase 1 | Pending |
| CFG-01 | Phase 2 | Pending |
| CFG-02 | Phase 2 | Pending |
| CFG-03 | Phase 2 | Pending |
| CFG-04 | Phase 2 | Pending |
| OUT-01 | Phase 3 | Pending |
| OUT-02 | Phase 3 | Pending |
| OUT-03 | Phase 3 | Pending |
| ISO-01 | Phase 4 | Pending |
| ISO-02 | Phase 4 | Pending |
| ISO-03 | Phase 4 | Pending |
| SKL-01 | Phase 5 | Pending |
| SKL-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after PRD gap review*
