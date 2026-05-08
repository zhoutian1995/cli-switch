# cli-switch

## What This Is

cli-switch is an AI Agent Capability Router for coding CLIs. It gives developers, scripts, Hermes/OpenClaw-style agents, and automation systems one command surface for routing tasks to Claude Code, Codex CLI, and future agent adapters while keeping gateway credentials and runtime decisions centralized.

Current public baseline is `cli-switch@0.3.2`: published on npm, documented on GitHub, and verified by build/test/release checks.

## Core Value

AI agents can call coding capabilities through one stable CLI/JSON interface without hard-coding agent, model, gateway, or execution details.

## Requirements

### Validated

- ✓ Basic CLI commands exist: `resolve`, `env`, `auth status`, `doctor`, `list`, `run`, `capabilities`, `benchmark`.
- ✓ `run` supports Claude Code and Codex routing, manual `--agent`, `--tier`, `--execution`, `--dry-run`, and `--json`.
- ✓ Gateway aliases support `SWITCH_*`, `SWITCH_RELAY_*`, and `OPENROUTER_*`.
- ✓ v0.1 sandbox baseline isolates child process env, scrubs parent session env, and supports gateway HOME isolation.
- ✓ npm and GitHub release pipeline exists for `0.3.x`.

### Active

- [ ] Close the short-term reliability gap: provider/vendor/transport strictness, platform/binary preflight consistency, and error-code closure.
- [ ] Add user/project/task configuration coverage for routing, tier, strategy, and gateway defaults.
- [ ] Add output validation and auto-repair for capability results and diffs.
- [ ] Add stronger execution isolation: patch-only, temp project copies, and worktree isolation.
- [ ] Grow Skill workflows without turning cli-switch into a full UI or remote-control product.

### Out of Scope

- Mobile, desktop, or web UI — Paseo already explores that category; cli-switch remains the CLI capability layer.
- Direct source copying from Paseo — Paseo is AGPL-3.0 while cli-switch is MIT.
- Full remote daemon/relay architecture in the next milestone — useful later, not needed to close the current PRD gaps.
- Direct official provider billing integration — PRD principle is gateway-first.

## Context

- Canonical product intent is in `docs/PRD.md`.
- Detailed runtime, routing, and sandbox targets live in `docs/specs/`.
- Current gap analysis lives in `docs/IMPLEMENTATION_GAP_REPORT.md`.
- Paseo is a design reference for worktree/session/skill ideas, documented in `docs/PASEO_REUSE_ANALYSIS.md`.

## Constraints

- **License**: Keep cli-switch MIT-compatible; do not copy AGPL implementation from Paseo.
- **Product boundary**: Keep the next milestone CLI/runtime-focused, not UI/daemon-focused.
- **Compatibility**: Preserve current `cli-switch@0.3.x` command behavior unless the PRD explicitly changes it.
- **Safety**: Do not describe current sandbox as full filesystem isolation until file policy or worktree/temp-copy execution exists.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD brownfield planning from current docs | Existing PRD/specs already define intent; re-questioning would waste time | — Pending |
| Prioritize P0 runtime reliability before sandbox P2 | Resolver/preflight/error gaps are smaller and unlock safer later execution | — Pending |
| Treat Paseo as design reference only | AGPL-3.0 is incompatible with direct MIT code reuse | ✓ Good |

---
*Last updated: 2026-05-08 after v0.3.2 release and PRD gap review*
