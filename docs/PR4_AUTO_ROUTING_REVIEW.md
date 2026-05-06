# PR4 Code Review — Auto Mode Capability→Agent Routing

> Reviewer: AI Subagent
> Date: 2026-05-06
> Status: **ALL FIXED**

## Files Reviewed

- `src/core/router/capability-router.ts` (NEW)
- `test/unit/capability-router.test.ts` (NEW)
- `src/core/router/engine.ts` (MODIFIED)
- `src/core/router/index.ts` (MODIFIED)
- `src/core/router/capability-matrix.ts` (MODIFIED)
- `cmd/run.ts` (MODIFIED)

---

## 🔴 HIGH

### H1. `analyze` 路由冲突 — 代码映射 claude-code，但 routing-spec §3.1/§4.2 显示 analyze → codex

routing-spec §2.2 的条件表说"调试→Claude Code""简单任务→Codex"，但 analyze 在两边都未明确出现。而 §3.1 Custom 默认配置和 §4.2 balanced cost profile 都把 analyze 映射到 codex。

**决策点：** analyze 需要"深度推理"（代码的注释）还是"轻量分析"（spec 的默认）？

### H2. 无 routeWithFallback + capability 参数的集成测试

`routeWithFallback` 现在有新 capability 参数改变优先级，但：
- `router.test.ts` 只测旧 `route()` 函数
- `capability-router.test.ts` 只测 `routeByCapability()` 孤立功能
- **零覆盖**实际优先级链：capability→LLM→legacy

---

## 🟡 MEDIUM

### M1. routeWithFallback 位置参数模式 — 未来扩展会脆弱
### M2. capability routing 硬编码 confidence 0.95 无说明
### M3. capability-matrix 的代码审查权重在 capability routing 下是死代码

---

## 🟢 LOW

### L1. 测试 import 路径风格不一致
### L2. 缺 unknown capability 防御性测试
### L3. routeByCapability null 检查是死代码（Record 类型已保证完整性）
### L4. dry-run 同时显示 legacy ranking 和 capability routing，可能误导

---

## Summary

| Severity | Count | Must Fix |
|----------|-------|----------|
| HIGH | 2 | H1 (spec 对齐), H2 (补测试) |
| MEDIUM | 3 | 建议 |
| LOW | 4 | 可后续 |

---

## Maintainer Follow-up Review

> Reviewer: Codex
> Date: 2026-05-06
> Status: **PENDING FIX**

### Decision: H1 选择 `analyze -> codex`

PR4 应按 `routing-spec` 当前默认配置收敛：`analyze` 默认路由到 `codex`，tier 为 `standard`。

理由：

- `routing-spec` §3.1 Custom 默认配置明确写了 `analyze.agent: codex`。
- `routing-spec` §4.2 balanced profile 也把 `analyze` 放在 Codex + standard 档。
- `analyze` 在 Capability 元数据里是 `mutates: false` 的只读探索任务；深度分析走 Claude Code 可以作为后续 `high_quality` / custom override 行为，而不应覆盖 Auto 默认。

需要修改：

- `src/core/router/capability-router.ts`: `CAPABILITY_AGENT_MAP.analyze` 从 `claude-code` 改为 `codex`。
- `src/core/router/capability-router.ts`: `CAPABILITY_AGENT_REASON.analyze` 改成类似 `分析任务默认走标准档快速Agent`，避免继续表达"深度推理"。
- `test/unit/capability-router.test.ts`: `analyze -> claude-code` 测试改为 `analyze -> codex`。

### Confirmed Findings

#### HIGH: H1 仍成立

`src/core/router/capability-router.ts:26` 当前仍是 `analyze: 'claude-code'`，和 `routing-spec` 默认配置冲突。

#### HIGH: H2 仍成立

当前测试只覆盖了：

- `test/unit/capability-router.test.ts`: `routeByCapability()` 单点映射。
- `test/unit/router.test.ts`: legacy `route()`。

还没有覆盖 `routeWithFallback(intent, llm, capability)` 的真实优先级链。至少需要补：

- 有 capability 时优先 capability route，不调用 LLM。
- 无 capability 且 LLM 成功时使用 LLM route。
- 无 capability 且 LLM 抛错时 fallback 到 legacy route。
- `analyze` capability 最终路由到 `codex`。

#### MEDIUM: fallback 后丢失 `capability`

`cmd/run.ts:353` 首次执行结果会写入 `capability`，但 fallback 分支在 `cmd/run.ts:376` 重新赋值时只设置 `{ ...buildResult(...), fallback: true }`，会把 `capability` 丢掉。

建议改为：

```ts
result = { ...buildResult(fbProc, ctx.startTime), capability: ctx.capability, fallback: true };
```

#### MEDIUM: `tier_default` 优先级实现和注释不一致

`src/core/router/tier-resolver.ts:37` 注释写的是 `CLI override > config override > default`，文件头部也写了 global `tier_default` 应在 hardcoded default 之前。但 `src/core/router/tier-resolver.ts:58` 实际返回 `DEFAULT_CAPABILITY_TIER[capability] ?? config?.tier_default ?? 'standard'`，导致 `tier_default` 对所有已知 capability 都不会生效。

如果 `tier_default` 设计成全局默认，应调整为：

```ts
return config?.tier_default ?? DEFAULT_CAPABILITY_TIER[capability] ?? 'standard';
```

如果它只用于 unknown capability，需要改注释和测试名，避免误导。

### Verification

- `npm run build` passed.
- `npm test -- test/unit/capability-router.test.ts test/unit/router.test.ts test/unit/tier-resolver.test.ts test/unit/intent.test.ts` passed: 4 files, 44 tests.
