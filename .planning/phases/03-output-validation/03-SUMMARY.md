---
phase: 03-output-validation
status: completed
plans_completed: 2
requirements_satisfied: [OUT-01, OUT-02, OUT-03]
test_count: 517
files_added: [src/core/validation/output-schemas.ts, src/core/validation/validator.ts, src/core/validation/diff-validator.ts, src/core/validation/repair.ts, src/core/validation/index.ts, test/unit/validation-schemas.test.ts, test/unit/validation-usage.test.ts, test/unit/diff-validator.test.ts, test/unit/repair.test.ts, test/unit/strategy-validation.test.ts]
files_modified: [src/types/strategy.ts, src/core/strategy/engine.ts]
commits: [61327d8, daa833f]
---

# Phase 03: Output Validation and Repair — Summary

**Completed:** 2026-05-08
**Plans:** 2 of 2
**Tests:** 517 passed (1 pre-existing Hermes env failure, 1 skipped)
**Requirements satisfied:** OUT-01, OUT-02, OUT-03

## What Was Built

### Plan 03-01: Capability Output Schemas and Validators

- **Per-capability Zod schemas** — each known capability now has a typed output schema defining required fields (`status`, `summary`, and capability-specific fields like `files` for file operations or `diff` for patch capabilities).
- **`validateOutput()`** — unified validator that accepts raw agent output, matches it against the appropriate capability schema, and returns a typed result or structured validation errors.
- **Passthrough schemas** — capabilities without specific schemas use a lenient passthrough that still checks for `status` and `summary` fields, ensuring no capability output is completely unvalidated.

### Plan 03-02: Diff Validation, Auto-Repair, and Strategy Integration

- **Unified diff parser** — parses standard unified diff format (`--- a/`, `+++ b/`, `@@ hunk @@`) into structured change objects with file paths, line ranges, and content lines.
- **Path validator** — checks that diff target paths resolve within the project root, detecting traversal attempts and path injection.
- **Bounded repair** — attempts automatic repair of malformed output (truncated JSON, missing delimiters, incomplete hunks) within a configurable attempt/cost budget. Repairs that exceed budget return structured failure rather than silent corruption.
- **Strategy engine integration** — `validateOutput` and diff validation are wired into the strategy execution loop as optional post-processing steps, returning validation results alongside the strategy output.

## Key Decisions

1. **Opt-in validation** — validation is not forced on every strategy execution; callers explicitly request it. This avoids breaking existing flows and keeps overhead zero for simple use cases.

2. **Passthrough schemas for unknown capabilities** — rather than rejecting output from capabilities without a specific schema, a lenient passthrough validates only common fields (`status`, `summary`). New capabilities can add strict schemas incrementally.

3. **Non-fatal validation in strategy loop** — when validation is enabled in the strategy engine, validation failures produce warnings/structured results but do not abort execution. This keeps the strategy loop resilient while surfacing issues.

4. **Bounded repair budget** — auto-repair has a configurable maximum number of attempts and cost per repair cycle. This prevents infinite loops on pathological output while still recovering from common malformations.

## Files Changed

### Added (10 files)

| File | Purpose |
|------|---------|
| `src/core/validation/output-schemas.ts` | Per-capability Zod output schemas |
| `src/core/validation/validator.ts` | `validateOutput()` unified validator |
| `src/core/validation/diff-validator.ts` | Unified diff parser + path validator |
| `src/core/validation/repair.ts` | Bounded auto-repair logic |
| `src/core/validation/index.ts` | Module barrel export |
| `test/unit/validation-schemas.test.ts` | Schema correctness tests |
| `test/unit/validation-usage.test.ts` | Validator integration tests |
| `test/unit/diff-validator.test.ts` | Diff parser and path checks |
| `test/unit/repair.test.ts` | Repair logic tests |
| `test/unit/strategy-validation.test.ts` | Strategy engine validation wiring |

### Modified (2 files)

| File | Change |
|------|--------|
| `src/types/strategy.ts` | Added validation options to strategy types |
| `src/core/strategy/engine.ts` | Integrated validation into execution loop |

## Commits

- `61327d8` — feat(03-01): capability output schemas and validator
- `daa833f` — feat(03-02): diff validation, auto-repair, strategy integration
