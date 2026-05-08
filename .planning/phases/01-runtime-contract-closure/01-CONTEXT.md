# Phase 1: Runtime Contract Closure - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the short-term PRD reliability gaps in resolver/runtime behavior: strict provider/vendor/transport compatibility, platform and binary preflight consistency, and a documented/tested error-code surface. This phase must not implement the larger config layer, output repair pipeline, or file sandbox.

</domain>

<decisions>
## Implementation Decisions

### Resolver strictness
- **D-01:** Keep `RESOLVE_CONFLICT` as the public error for incompatible provider/vendor/transport combinations.
- **D-02:** Preserve existing successful `resolve` behavior unless the user explicitly requests an incompatible provider/vendor/transport.
- **D-03:** Add tests before or alongside tightening to avoid breaking known aliases.

### Preflight checks
- **D-04:** Use resolver/platform checks as the source of truth for platform and binary constraints.
- **D-05:** Extend consistency to run/doctor only where they can evaluate the same runtime target without spawning an agent.

### Error-code closure
- **D-06:** Document the implemented error codes and identify planned codes separately.
- **D-07:** JSON envelope shape remains stable: `schema_version`, `ok`, `data`, `error`, `warnings`, `diagnostics`.

### the agent's Discretion
- Exact internal helper names and file organization.
- Whether to centralize preflight through an existing resolver service helper or a new small runtime preflight module, as long as public behavior stays stable.

</decisions>

<specifics>
## Specific Ideas

- Current `docs/IMPLEMENTATION_GAP_REPORT.md` already names this phase as P0.
- Current tests already include `test/unit/resolver-contract.test.ts`; extend rather than duplicate where possible.
- `cmd/run.ts` currently bypasses much of resolver runtime validation; this is the likely integration gap.

</specifics>

<canonical_refs>
## Canonical References

### Product and gap sources
- `docs/PRD.md` — v2.0 target and current milestone status.
- `docs/IMPLEMENTATION_GAP_REPORT.md` — P0 gap list and completion estimate.
- `docs/specs/runtime-spec.md` — JSON envelope, runtime errors, and target output behavior.
- `docs/specs/routing-spec.md` — provider/vendor/transport and route resolution goals.

### Current implementation
- `src/core/resolver/service.ts` — resolver contract validation and diagnostics.
- `src/registry/builtins/*.toml` — provider/model/profile/tool definitions.
- `cmd/run.ts` — current runtime execution path and known TODOs.
- `test/unit/resolver-contract.test.ts` — existing resolver contract coverage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createResolverService()` already validates `RESOLVE_CONFLICT`, `PLATFORM_UNSUPPORTED`, and `BINARY_NOT_FOUND`.
- `cmd/_shared.ts` already builds JSON envelopes and loads registry overrides.
- `loadUserOverrides()` exists for registry override TOML, but not full config YAML.

### Established Patterns
- CLI JSON errors should use existing envelope helpers rather than ad hoc console output.
- Tests cover both unit-level contracts and e2e JSON behavior.

### Integration Points
- Resolver path: `cmd/resolve.ts` → `createResolverService()`.
- Doctor path: `cmd/doctor.ts` and `src/core/doctor/doctor-service.ts`.
- Run path: `cmd/run.ts` → intent/capability/router/gateway/strategy/process manager.

</code_context>

<deferred>
## Deferred Ideas

- Full `config show/set/reset` belongs to Phase 2.
- Output validation and auto-repair belong to Phase 3.
- Patch-only/temp-copy/worktree isolation belongs to Phase 4.
- Skill DSL and `skill run` belong to Phase 5.

</deferred>

---

*Phase: 01-runtime-contract-closure*
*Context gathered: 2026-05-08*
