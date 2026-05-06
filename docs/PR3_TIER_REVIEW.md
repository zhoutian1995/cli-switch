# PR3 Code Review — Tier Routing + Capability→Tier Mapping

> Reviewer: AI Subagent
> Date: 2026-05-06
> Status: **ALL FIXED**

## Files Reviewed

- `src/core/router/tier-resolver.ts` (NEW)
- `test/unit/tier-resolver.test.ts` (NEW)
- `cmd/run.ts` (MODIFIED)
- `src/types/capability.ts` (from PR2)
- `src/core/capability/resolver.ts` (from PR2+fix)
- `src/core/intent/parser.ts` (from PR2 fix)

---

## 🔴 HIGH Severity

### H1. `review_code` capability missing from `CapabilityId` and default tier map

**File:** `capability.ts`, `tier-resolver.ts`

routing-spec §1.3 明确定义 `review_code: premium`，但当前 `CapabilityId` 只有 7 个值，缺少 `review_code`。`DEFAULT_CAPABILITY_TIER` 也缺少对应条目。

**Fix:** 加 `review_code` 到 `CapabilityId` + `DEFAULT_CAPABILITY_TIER` + `CAPABILITIES`。

### H2. Config 从未传入 `resolveTier` — `RoutingConfig` 是死代码

**File:** `cmd/run.ts:112`

```ts
const effectiveTier = resolveTier(capability, undefined, options.tier);
```

第二参数硬编码 `undefined`，config 的 `capability_tier_override` 和 `tier_default` 永远不走。

**Recommendation:** PR3 可接受，但需加 `// TODO: PR4 wire config loading` 注释。

### H3. `--tier` 校验分散在两处，resolver 静默吞掉非法值

**File:** `tier-resolver.ts:44` vs `cmd/run.ts:146-154`

`run.ts` 做白名单校验退出，`resolveTier` 也做了但静默 fallback。两处校验逻辑重复。

**Recommendation:** 统一到 resolver 一处校验，或加 TODO。

---

## 🟡 MEDIUM Severity

### M1. `review` 关键词映射到 `解释` 而非 `review_code`

**File:** `intent/parser.ts:10`

routing-spec §2.1 说 `review` 应映射到 `review_code`，但当前映射到了 `解释`。

### M2. 未知 intent type 静默 fallback 到 `write_code`

**File:** `capability/resolver.ts:41`

LLM 返回非预期 type 时静默 fallback，建议加 warning。

### M3. `RunResult.capability` 类型是 `string` 不是 `CapabilityId`

**File:** `types/agent.ts:44`

丢失类型安全。应改为 `capability?: CapabilityId`。

### M4-M6. 测试覆盖不足

- M4: 无 `review_code` 测试（因为不存在）
- M5: 无 unknown capability fallback 测试
- M6: `tier_default` 路径未被真正测试

---

## 🟢 LOW Severity

| ID | File | Issue |
|----|------|-------|
| L1 | capability/resolver.ts:32,53 | ANALYZE_HINTS 和 ANALYZE_ONLY_HINTS 重复，应合并 |
| L2 | cmd/run.ts:32 | `options.tier` 是 `string` 不是 `Tier` |
| L4 | cmd/run.ts:135 | 错误消息仍引用 "PR1"，应更新 |
| L5 | cmd/run.ts:178 | JSON dry-run 新增 `tier` 字段位置未文档化 |

---

## Summary

| Severity | Count | Must Fix |
|----------|-------|----------|
| HIGH | 3 | H1 (review_code), H2 (加 TODO) |
| MEDIUM | 6 | M3 (类型安全) |
| LOW | 4 | 可后续 |

**建议：** H1 和 H2 必须在 merge 前修。H3 加 TODO 即可。M3 建议修。
