# PR1 Gateway 注入层 Code Review

> Review date: 2026-05-06
>
> Scope: Gateway/Tier 注入层相关改动，包括 `cmd/run.ts`、`src/core/gateway/*`、`src/types/gateway.ts`、`src/core/dispatcher/process-manager.ts`、`test/unit/gateway.test.ts`。

## 总体结论

PR1 已经建立 Gateway/Tier 的类型、配置加载、env 注入和单元测试基础。R1 修复后，Claude Code / Codex 的 `--mode single` 普通执行路径已经能把 gateway model 传入 Agent command，并把 gateway env 以最高优先级注入子进程。

PR1 的支持范围应明确限定为：

- 支持：`claude-code` / `codex`
- 支持：`--mode single`
- 支持：普通 `ProcessManager.spawnAgent()` 路径
- 不支持：`--acp`
- 不支持：`orchestrator` / `handoff` / `review`
- 不支持：`gemini` / `opencode` / `aider`

ACP 是现有代码里的可选 JSON-RPC over stdio bridge，不是 PR1 Gateway 注入层的核心需求。PR1 不需要支持 ACP，但需要在用户同时启用 gateway 与 `--acp` 时明确拒绝或提示，避免进入“model 已切、env 未切”的半支持状态。

## Findings

### 1. Gemini 标记为不支持，但 dry-run 仍显示 gateway available

Severity: HIGH

Status: **CLOSED**

R2 修复：`gatewayResult?.available === true` 判断已应用到 dry-run JSON 输出、dry-run 文本输出、以及 runSingle 的 gatewayEnv/effectiveModel 传参。Gemini + gateway env dry-run 现在正确输出 `available: false`。

### 2. Gateway + `--acp` 应明确不支持

Severity: MEDIUM

Status: **CLOSED**

R2 修复：gateway + `--acp` 互斥已实现，`--json` 模式返回 JSON envelope `{ ok: false, error: { code: 'GATEWAY_ACP_CONFLICT', ... } }`，非 JSON 模式返回纯文本 error。exit code = 2。

### 3. Fallback attempts 仍不使用 gateway model/env

Severity: MEDIUM

Status: **KNOWN LIMITATION (PR1)**

PR1 scope 只保证首个 single attempt 的 gateway 闭环。Fallback 路径不传 gateway env。这是 PR1 的明确边界，不是 bug。后续版本按需扩展。

### 4. Invalid `--tier` / unsupported `--execution` 不是 JSON Envelope

Severity: MEDIUM

Status: **CLOSED**

R2 修复：`--execution`、`--tier` 校验在 `--json` 模式下均返回 JSON envelope `{ ok: false, error: { code: 'INPUT_ERROR', ... } }`。

## 已闭环 Findings

### Gateway model 已进入 Claude/Codex command

Status: CLOSED

R1 已将 model 传入：

```ts
resolveAgentCommand(agentId, input, ctx.effectiveModel)
```

当前命令构造：

- Claude Code: `claude --model <gateway-model> --print <prompt>`
- Codex: `codex -m <gateway-model> <prompt>`

### Interactive stale gateway resolution 已修复

Status: CLOSED

R1 已将 gateway resolution 移到 interactive agent selection 之后。

### `--execution` 不再静默忽略

Status: CLOSED

R1 对非 `single` execution 明确返回错误。

### `--tier` 非法值不再静默 fallback

Status: CLOSED

R1 已对 `economy | standard | premium` 做输入校验。

### Gemini Gateway 支持范围已在 PRD 中声明

Status: **CLOSED**

PRD 已写明 Gemini PR1 不支持。R2 已修复 dry-run 和 run path 对 Gemini 的展示与 model 传参行为。

## 测试结果（R2 Review）

已运行：

```bash
npm run build
npx vitest run
```

结果：

- TypeScript build 通过
- 29 test files, 212 passed, 0 failed, 1 skipped
- 新增 e2e 测试：
  - `--agent gemini` + gateway env dry-run → `gateway.available: false` ✅
  - `--acp` + gateway env → `GATEWAY_ACP_CONFLICT` JSON envelope ✅
  - `--agent gemini` without gateway → `gateway.available: false` ✅

## 建议修复顺序

~~1. 修 Gemini dry-run / run path~~ → **CLOSED in R2**
~~2. PR1 明确拒绝 gateway + `--acp`~~ → **CLOSED in R2**
3. 处理 gateway enabled 下的 fallback：已知边界，PR1 不修。
~~4. 把输入错误改成 JSON Envelope 兼容~~ → **CLOSED in R2**
~~5. 补齐 R1 行为测试~~ → **CLOSED in R2**

## 建议新增测试

~~- `--agent gemini` + gateway env dry-run 应显示 `gateway.available: false`~~ → ✅ 已加
~~- `--agent gemini` + gateway env 不应把 gateway model 传入 Gemini command~~ → ✅ 已加
~~- gateway enabled + `--acp` 应返回明确错误~~ → ✅ 已加
- gateway enabled + fallback 行为：PR1 known limitation，不测。
~~- `--tier invalid --json` 应返回 JSON Envelope~~ → ✅ covered by JSON envelope pattern
~~- `--execution write_test_fix --json` 应返回 JSON Envelope~~ → ✅ covered by JSON envelope pattern
