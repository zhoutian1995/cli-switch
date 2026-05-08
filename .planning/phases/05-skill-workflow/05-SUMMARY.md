---
phase: 5
title: Skill Workflow Foundation
status: completed
plans_completed: 2
requirements:
  - SKL-01
  - SKL-02
test_count: 640
files_added:
  - src/core/skill/schema.ts
  - src/core/skill/loader.ts
  - src/core/skill/renderer.ts
  - src/core/skill/index.ts
  - cmd/skill.ts
  - test/unit/skill-schema.test.ts
  - test/unit/skill-loader.test.ts
  - test/unit/cmd-skill.test.ts
  - test/unit/skill-config.test.ts
files_modified:
  - src/types/config.ts
  - cmd/config.ts
  - cmd/root.ts
completed: "2026-05-08"
---

# Phase 05: Skill Workflow Foundation — Summary

## Overview

Phase 05 adds local reusable skill definitions that map to capability, strategy, tier, and prompt templates. Users can define skills as YAML files, list them, inspect them, and execute them through `cli-switch skill run <name>` with full flag passthrough.

## Plans Completed

| Plan | Description | Tests |
|------|-------------|-------|
| 05-01 | Define and load local skill workflow schema | 30 |
| 05-02 | Add `skill` command group and config integration | 31 |

**Total test results:** 640 passed, 1 failed (pre-existing gateway.test.ts), 1 skipped.

## What Was Built

### 1. Skill Schema, Loader, Renderer (05-01)
- `src/core/skill/schema.ts` — Zod schema (strict) with `SkillDefinition`, `SkillInfo`, and `SkillLoadError` interfaces. Validates name, version, description, capability, strategy, tier, prompt template, and optional metadata.
- `src/core/skill/loader.ts` — `loadSkill()`, `listSkills()`, `getSkillDirs()` with project-first-then-global resolution. Scans `.cli-switch/skills/` in the project directory, then `~/.cli-switch/skills/` globally.
- `src/core/skill/renderer.ts` — `renderPrompt()` with `{input}` template substitution for dynamic skill prompts.
- `src/core/skill/index.ts` — Barrel export for all skill modules.
- 30 unit tests covering schema validation, loader resolution order, and prompt rendering.

### 2. Skill Commands + Config Integration (05-02)
- `cmd/skill.ts` (569 lines) — Full skill command group:
  - `skill list [--json]` — Lists all available skills with metadata.
  - `skill show <name> [--json]` — Displays detailed skill definition.
  - `skill run <name> [input...]` — Executes a skill with full flag passthrough: `--dry-run`, `--strategy`, `--tier`, `--execution-mode`, `--agent`, `--no-git`, `--timeout`, `--stream/--no-stream`, `--json`, `--acp`.
- `src/types/config.ts` — Added `skillsSectionSchema` and `SkillsSection` interface for config integration.
- `cmd/config.ts` — Added `skills` to `VALID_TOP_LEVEL_KEYS` and render output.
- `cmd/root.ts` — Registered `createSkillCommand()`, updated help text.
- 31 unit tests covering command parsing, config integration, and error handling.

## Key Decisions

- **Project-first resolution**: Skills are resolved from `.cli-switch/skills/` first, then `~/.cli-switch/skills/` globally, matching the existing config precedence pattern.
- **Template substitution**: Skills use simple `{input}` placeholder in prompt templates — no complex templating engine needed for v1.
- **Flag passthrough**: `skill run` accepts all standard execution flags, mapping them directly to the underlying run command.
- **YAML definitions**: Skills are defined as `.yaml` files for consistency with the existing config format.

## Error Codes Added

| Code | Description |
|------|-------------|
| `SKILL_NOT_FOUND` | Requested skill name does not exist in any resolved skill directory |
| `SKILL_INVALID` | Skill YAML fails schema validation |
| `SKILL_LOAD_FAILED` | Skill file exists but cannot be read or parsed |

## Requirements Satisfied

| Requirement | Status | Verification |
|-------------|--------|-------------|
| SKL-01 | ✅ Done | Skill definitions load from documented path with Zod schema validation |
| SKL-02 | ✅ Done | `cli-switch skill run <name>` resolves and executes registered local skills |
