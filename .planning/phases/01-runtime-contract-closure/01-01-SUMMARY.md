# Phase 1 Plan 01 Summary: Provider Contract Strictness

## Objective

Tighten provider/vendor/transport resolver contracts and make conflict diagnostics actionable.

## Completed

- Added structured conflict context to provider contract validation.
- Preserved compatible default `claude-code` resolve behavior.
- Expanded resolver contract coverage from 9 to 12 tests.
- Updated gap and routing docs to reflect resolver-path strictness status.

## Files Changed

- `src/core/resolver/service.ts`
- `test/unit/resolver-contract.test.ts`
- `docs/IMPLEMENTATION_GAP_REPORT.md`
- `docs/specs/routing-spec.md`

## Verification

- `npm test -- test/unit/resolver-contract.test.ts test/e2e/cli-json.test.ts` — passed
- `npm run build` — passed
- `git diff --check -- docs/IMPLEMENTATION_GAP_REPORT.md docs/specs/routing-spec.md src/core/resolver/service.ts test/unit/resolver-contract.test.ts` — passed

## Deviations from Plan

One test expectation was adjusted during implementation: `provider=zhipu + model=sonnet + transport=native` correctly fails on vendor conflict before transport conflict. The transport-specific test now uses `model=glm-5` so it reaches the intended provider transport branch.

**Total deviations:** 1 test fixture correction.
**Impact:** Positive; the test now targets the intended invariant.

## Self-Check: PASSED

RT-01 is satisfied for the `resolve` path. Remaining run/doctor preflight alignment is covered by Plan 01-02.
