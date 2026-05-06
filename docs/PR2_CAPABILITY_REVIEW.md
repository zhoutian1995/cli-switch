# PR2 Capability 归一层 Code Review

> Review date: 2026-05-06
>
> Scope: Capability 归一层相关改动，包括 `src/types/capability.ts`、`src/core/capability/*`、`cmd/run.ts`、`src/types/agent.ts`、`src/types/index.ts`、`test/unit/capability.test.ts`。

## 总体结论

PR2 建立了从当前 `TaskIntent.type` 到 v2 `CapabilityId` 的归一层，并在 dry-run JSON / 文本输出中展示 capability。整体方向与 `routing-spec.md §0.1 当前到 v2 Capability 的映射` 一致。

当前 PR2 更准确的状态：

- Capability enum / metadata：已实现
- intent type 到 capability 的基础映射：已实现
- `调试` 和 `测试` 的子分类 heuristics：部分实现
- dry-run capability 展示：已实现
- 真实 `RunResult.capability` 输出：尚未闭环
- capability 驱动 routing / tier / strategy / output schema：仍是后续阶段

## Findings

### 1. 中文分析类请求在真实 CLI 中仍会落到 `write_code`

Severity: HIGH

`resolveCapability()` 对 `调试` intent 支持 analyze 子分类：

```ts
if (intent.type === '调试') {
  if (ANALYZE_HINTS.some(h => lower.includes(h))) {
    return 'analyze';
  }
}
```

但当前 `parseIntent()` 不会把常见中文分析类输入归为 `调试` 或 `解释`。例如：

```bash
cli-switch run "分析一下这个错误" --dry-run --json
cli-switch run "为什么登录失败" --dry-run --json
```

当前实际输出：

```json
{
  "intent": { "type": "代码生成" },
  "capability": "write_code"
}
```

Impact:

- `analyze` capability 在常见中文请求中不可达
- read-only 分析请求会被归到 mutating capability `write_code`
- 后续如果 capability 驱动 sandbox / output schema / tier，这会带来错误的写权限和模型选择

Suggested fix:

- 在 `src/core/intent/parser.ts` 的 `TYPE_KEYWORDS` 中增加分析类关键词：
  - `分析`
  - `为什么`
  - `看看`
  - `inspect`
  - `analyze`
- 或让 `resolveCapability()` 在 `intent.type === '代码生成'` 时也检查 read-only / analyze hints，并优先返回 `analyze`。
- 增加 E2E 测试覆盖：
  - `分析一下这个错误` → `analyze`
  - `为什么登录失败` → `analyze`

### 2. `RunResult.capability` 类型字段已添加，但真实执行结果没有填充

Severity: MEDIUM

`src/types/agent.ts` 给 `RunResult` 增加了：

```ts
capability?: string;
```

但 `cmd/run.ts` 只在 dry-run 输出中加入 capability；真实执行路径中的 `buildResult(proc, startTime)` 仍返回不带 capability 的 `RunResult`。

Impact:

- 类型暗示运行结果可能携带 capability，但当前真实 `run --json` 执行不会有该字段
- 上层 Agent 如果依赖 `RunResult.capability`，只能在 dry-run 拿到，真实执行拿不到

Suggested fix:

- 将 `capability` 传入 `runSingle()` context。
- 在 `printSingleResult()` 前合并到 `RunResult`：

```ts
result = { ...result, capability };
```

- fallback result 也应保留原始 capability。
- 增加单元或 E2E 测试，验证非 dry-run JSON result 包含 capability。

### 3. Capability metadata 没有出现在 dry-run 输出中

Severity: LOW

PR2 已定义 `CAPABILITIES`，包含 `mutates` / `description`，但 dry-run 只输出 capability id 字符串。

Impact:

- 用户无法从 dry-run 直接判断该 capability 是否会修改文件
- 后续 sandbox 策略需要 mutates 信息时，还要再次查 registry

Suggested fix:

- dry-run JSON 可扩展为：

```json
"capability": {
  "id": "write_code",
  "mutates": true,
  "description": "Generate or modify source code files"
}
```

- 若要保持兼容，可新增 `capability_meta` 字段，而不是改变 `capability` 字段类型。

## 已闭环项

### 1. routing-spec §0.1 映射已落地

Status: CLOSED

基础映射与文档一致：

| TaskIntent.type | Capability |
|-----------------|------------|
| `代码生成` | `write_code` |
| `重构` | `refactor` |
| `调试` | `fix_error` / `analyze` |
| `测试` | `write_tests` / `run_tests` |
| `解释` | `explain` |

### 2. 测试类子分类可用

Status: CLOSED

真实 CLI 验证：

```bash
node dist/cmd/root.js run '执行 npm test' --dry-run --json
```

输出：

```json
{
  "intent": { "type": "测试" },
  "capability": "run_tests"
}
```

### 3. dry-run 展示 capability

Status: CLOSED

`cmd/run.ts` 已在 dry-run JSON 和文本输出中展示 capability。

## 验证结果

已运行：

```bash
npm run build
npm test -- test/unit/capability.test.ts test/unit/intent.test.ts test/e2e/run-command.test.ts
node dist/cmd/root.js run 'run tests' --dry-run --json
node dist/cmd/root.js run '分析一下这个错误' --dry-run --json
node dist/cmd/root.js run '为什么登录失败' --dry-run --json
```

结果：

- TypeScript build 通过
- capability / intent / run-command 相关测试通过，25 tests passed
- `run tests` → `run_tests` 通过
- 中文分析类请求目前仍误归为 `write_code`

## 建议修复顺序

1. 修中文分析类请求的 intent/capability 归类，避免 read-only 请求落到 mutating capability。
2. 将 `capability` 填入真实 `RunResult`，不要只在 dry-run 中出现。
3. dry-run 增加 capability metadata 或 `mutates` 标记。
4. 更新 routing-spec，把 PR2 当前实现状态从“目标”调整为“部分已实现”。

## 建议新增测试

- E2E: `分析一下这个错误 --dry-run --json` 应输出 `capability: analyze`。
- E2E: `为什么登录失败 --dry-run --json` 应输出 `capability: analyze`。
- E2E 或 unit: 真实执行 JSON result 包含 `capability`。
- Unit: `getCapability('write_code').mutates === true`，`getCapability('analyze').mutates === false`。
