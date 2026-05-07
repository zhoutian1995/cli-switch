# PR5 Code Review — v0.3 Strategy Engine

> Reviewer: AI Subagent
> Date: 2026-05-06
> Status: **ALL FIXED (H1+H2+M1+M2+M3+M4+M6)**

## Files Reviewed

- `src/types/strategy.ts` (NEW)
- `src/core/strategy/registry.ts` (NEW)
- `src/core/strategy/error-classifier.ts` (NEW)
- `src/core/strategy/engine.ts` (NEW)
- `src/core/strategy/index.ts` (NEW)
- `cmd/run.ts` (MODIFIED — strategy imports + dry-run)
- `test/unit/strategy-registry.test.ts` (NEW)
- `test/unit/error-classifier.test.ts` (NEW)
- `test/unit/strategy-engine.test.ts` (NEW)

## Findings

### HIGH

| # | File | Issue |
|---|------|-------|
| H1 | `cmd/run.ts` | `executeStrategy` 已 import 但从未调用。多步策略(write_review/write_test_fix/high_quality)从 CLI 完全不工作——只有 dry-run 展示。 |
| H2 | `engine.ts:27-28,158-159` | Engine 内部直接调 `routeByCapability`+`resolveTier`，绕过了 CLI 的 `--agent`/`--tier` 覆盖。需要接受外部 routing 注入。 |

### MEDIUM

| # | File | Issue |
|---|------|-------|
| M1 | `strategy.ts:68-74` | `StepHistory` 缺 `tokensUsed` 字段（runtime-spec §1.2 要求） |
| M2 | `error-classifier.ts:34` | `TypeError` 被归入 `syntax_error`，实际是 runtime_error |
| M3 | `error-classifier.ts:39-42` | `FAIL` 匹配太宽——非测试场景也会被误判为 `test_failure` |
| M4 | `error-classifier.ts:61-108` | `capability` 参数传入但未用于分类判断 |
| M5 | `engine.ts:228-250` | Loop handler 硬编码只处理 `run_tests`，不通用 |
| M6 | `registry.ts:76-85` | `single` 策略步骤硬编码 `write_code`，语义不匹配 `run_tests`→single 场景 |

### LOW

| # | File | Issue |
|---|------|-------|
| L1 | `error-classifier.ts:49-52` | Rate limit(429) 归入 `agent_error`，缺少 wait+retry 行为 |
| L2 | `strategy.ts:129` | `durationMs` 不在 runtime-spec §1.3 schema 中 |
| L3 | `strategy.ts:117-129` | `model` 字段声明但 `buildResult` 永远不设置 |
| L4 | `strategy-engine.test.ts:112-129` | Loop 测试用 `callCount` 控制失败，顺序脆弱 |

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 2 |
| MEDIUM | 6 |
| LOW | 4 |

**最关键问题：** H1（CLI 未调用 executeStrategy）+ H2（Engine 忽略 CLI 覆盖参数）意味着多步策略目前完全不可用。需要把 executeStrategy 接入 cmd/run.ts 的执行路径，并让 engine 接受外部 routing 注入。
