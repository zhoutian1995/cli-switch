# Phase 3: Output Validation and Repair - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add capability-level output validation schemas, unified diff parsing/validation, and a bounded auto-repair pipeline. This phase reads raw Agent stdout (currently opaque strings) and turns it into structured, validated results. It must not implement execution isolation (Phase 4) or skill workflows (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Output schema design
- **D-01:** Define per-capability Zod output schemas with `status` and `summary` as universal required fields. Each capability adds its own required fields (e.g., `files_changed` + `diff` for write_code).
- **D-02:** Use Zod with `strict: false` (allow extra fields) since agents frequently output reasoning/confidence/etc. Strip unknown fields silently.
- **D-03:** Validation is opt-in during strategy execution — raw stdout passes through as before for `run` single-step mode; structured validation happens inside the strategy engine after each step.
- **D-04:** Don't parse agent output as JSON by default. Instead, treat output as structured text and apply lightweight heuristics (regex for file paths, diff headers) to extract capability fields. Only attempt JSON parse if the output starts with `{`.

### Diff validation
- **D-05:** Implement a unified diff parser that validates `---`, `+++`, `@@` hunk headers. Extract file paths from `--- a/path` lines.
- **D-06:** Path validation checks that diff file paths don't reference protected paths (`.git/`, `node_modules/`, `.env`).
- **D-07:** Diff validation runs only when capability is write_code, fix_error, or refactor (mutating capabilities that produce diffs).

### Auto-repair
- **D-08:** Auto-repair is bounded: max 2 attempts per step, total max 3 across a strategy execution.
- **D-09:** Repair strategies: (a) strip non-diff noise from output, (b) extract JSON structure from mixed text, (c) normalize diff headers. No LLM-assisted repair in this phase.
- **D-10:** If repair fails after budget, escalate to structured `VALIDATION_FAILED` error with details.

### Integration
- **D-11:** Add output validation as a post-step hook in the strategy engine, after executor returns but before updating history.
- **D-12:** Add `validatedOutput` field to `StepHistory` to store parsed/validated result alongside raw `output`.
- **D-13:** Strategy result gains optional `validatedOutputs` map for downstream consumers (JSON `--json` output includes it).

### Error codes
- **D-14:** New error codes: `OUTPUT_VALIDATION_FAILED`, `DIFF_PARSE_FAILED`, `DIFF_PATH_VIOLATION`, `REPAIR_BUDGET_EXCEEDED`.

### the agent's Discretion
- Exact helper module names and file organization under `src/core/validation/`.
- Regex patterns for heuristic extraction.
- Whether to add a `validate` command to the CLI (not required for this phase).

</decisions>

<specifics>
## Specific Ideas

- `runtime-spec.md §1.1` already defines the capability output schema requirements — implement those Zod schemas directly.
- `src/core/strategy/engine.ts` is the integration point — add validation after `executor()` call returns in the step loop.
- `src/core/strategy/error-classifier.ts` already classifies errors — the validator is complementary: it runs on success outputs too, not just failures.
- Current `StepHistory.output` is raw `string` — add optional `validatedOutput` as `Record<string, unknown>` or a typed union.
- `runSingle()` in `cmd/run.ts` currently doesn't go through strategy engine — output validation doesn't apply there (D-03).

</specifics>

<canonical_refs>
## Canonical References

### Specs
- `docs/specs/runtime-spec.md` §1.1 Output Validation Schema — defines required fields per capability.
- `docs/specs/runtime-spec.md` §1.3 Result Output JSON Schema — defines the envelope shape.
- `docs/specs/runtime-spec.md` §2.1 Error Type classification — existing error types.

### Source code
- `src/types/strategy.ts` — `StepHistory`, `StrategyResult`, `ErrorType` types.
- `src/types/capability.ts` — `CapabilityId` enum and `CAPABILITIES` registry.
- `src/core/strategy/engine.ts` — strategy execution loop (integration point).
- `src/core/strategy/error-classifier.ts` — error classification (complementary to validation).
- `src/core/strategy/registry.ts` — strategy definitions.
- `cmd/run.ts` — CLI integration, strategy execution path.
- `src/types/diagnostics.ts` — diagnostic types for structured errors.

### Planning
- `.planning/ROADMAP.md` — Phase 3 goals, requirements, success criteria.
- `.planning/REQUIREMENTS.md` — OUT-01, OUT-02, OUT-03 definitions.

</canonical_refs>
