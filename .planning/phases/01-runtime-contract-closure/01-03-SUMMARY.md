# Phase 1 Plan 03 Summary: Runtime Error-Code Closure

## Objective

Document and test runtime error-code closure for the public CLI JSON failure surface.

## Completed

- Updated `docs/specs/runtime-spec.md` from v0.3.0 baseline wording to v0.3.2 runtime reality.
- Added a current public error-code inventory with implemented, partial, and fallback codes.
- Split current public error codes from v2 target strategy error types.
- Updated `docs/IMPLEMENTATION_GAP_REPORT.md` so P0 provider/preflight/error-code items no longer appear as missing.
- Added JSON golden coverage for `INPUT_ERROR` while preserving existing resolver, gateway, and runtime/preflight coverage.

## Files Changed

- `docs/specs/runtime-spec.md`
- `docs/IMPLEMENTATION_GAP_REPORT.md`
- `test/e2e/cli-json.test.ts`

## Verification

- `npm test -- test/e2e/cli-json.test.ts test/unit/resolver-contract.test.ts` — passed
- `npm run build` — passed
- `git diff --check` — passed
- `rg "INPUT_ERROR|TOOL_NOT_FOUND|MODEL_NOT_FOUND|ADAPTER_NOT_FOUND|RESOLVE_CONFLICT|PLATFORM_UNSUPPORTED|BINARY_NOT_FOUND|GATEWAY_ACP_CONFLICT|RUN_FAILED|RESOLVE_FAILED" docs/specs/runtime-spec.md cmd src test/e2e/cli-json.test.ts` — passed

## Deviations from Plan

No command rendering changes were needed. The existing JSON helpers already preserve the envelope fields for the covered paths; this plan only added the missing `INPUT_ERROR` golden.

**Total deviations:** 1 scoped no-op decision.
**Impact:** Positive; avoided changing stable JSON behavior without need.

## Self-Check: PASSED

RT-04 is satisfied. The runtime spec and gap report now match the implemented v0.3.2 error surface, and representative JSON failures are covered by deterministic tests.
