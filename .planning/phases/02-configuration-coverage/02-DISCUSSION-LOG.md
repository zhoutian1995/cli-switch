# Phase 2: Configuration Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 02-configuration-coverage
**Areas discussed:** Config file format and locations, precedence and merge behavior, command behavior, runtime integration, error handling and safety

---

## Config file format and locations

| Option | Description | Selected |
|--------|-------------|----------|
| YAML main config | Match PRD/spec paths: `~/.cli-switch/config.yaml` and `.cli-switch.yaml`. | ✓ |
| TOML main config | Align with existing `registry.override.toml`, but drift from PRD/spec wording. | |
| JSON main config | Simple to parse, but less friendly for hand-written user config. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Registry overrides stay TOML and separate from runtime config.

---

## Precedence and merge behavior

| Option | Description | Selected |
|--------|-------------|----------|
| CLI > task > project > global > env > built-ins | Matches existing type comments and preserves command-line authority. | ✓ |
| Env above config | More traditional for twelve-factor apps, but weakens project config control. | |
| Global-only config first | Smaller first implementation, but fails CFG-02. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Use deep merge for nested config objects.

---

## Command behavior

| Option | Description | Selected |
|--------|-------------|----------|
| `config show/set/reset` | Satisfies CFG-04 and gives scripts a JSON debugging surface. | ✓ |
| `config show` only | Easier first cut but incomplete against requirements. | |
| No command group | Leaves config opaque and fails PRD expectations. | |

**User's choice:** Auto-selected recommended default.
**Notes:** `show --json` must redact secrets and expose source metadata.

---

## Runtime integration

| Option | Description | Selected |
|--------|-------------|----------|
| Wire config into gateway, tier, execution, and strategy defaults | Completes the scoped runtime behavior for Phase 2. | ✓ |
| Gateway-only integration | Too narrow; leaves routing/strategy TODOs. | |
| Command-only config with no runtime wiring | Easy to demo but does not solve user defaults. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Preserve dry-run JSON compatibility through additive fields only.

---

## Error handling and safety

| Option | Description | Selected |
|--------|-------------|----------|
| Structured config errors plus centralized redaction | Fits Phase 1 error-code closure and protects secrets. | ✓ |
| Throw generic command errors | Faster, but creates another JSON inconsistency. | |
| Print raw config for debugging | Dangerous because config can contain API keys. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Missing config is normal; invalid config should fail when loaded.

---

## the agent's Discretion

- Exact module names and parser wrapper shape.
- Exact dot-path grammar for `config set/reset`.
- Whether project config discovery stays cwd-only or grows to parent search during planning, with cwd-only as the default recommendation.

## Deferred Ideas

- Recursive parent config discovery if monorepo users need it later.
- Output validation, stronger isolation, and Skill workflow remain later phases.
