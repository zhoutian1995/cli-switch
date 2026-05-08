# cli-switch 实现差异清单

基准文档：
- `99-临时文件/cli-switch-docs/05-详细设计.md`

## 1. 已对齐

### 架构分层
已具备：
- CLI Layer
- Core Resolver Layer
- Registry + Adapter Layer
- Platform / Runtime Layer

### MVP 命令面
已实现：
- `resolve`
- `env`
- `auth status`
- `doctor`
- `list models`
- `list providers`
- `list profiles`

### JSON Envelope
已统一：
- `schema_version`
- `ok`
- `data`
- `error`
- `warnings`
- `diagnostics`

### Auth 状态枚举
已支持：
- `ready`
- `missing`
- `expired`
- `conflict`
- `unsupported`
- `unknown`

## 2. 已补齐的关键差异

### 模型 registry key 契约
此前问题：`models.toml` key 未按 alias 存储，导致 doctor/resolve 行为不一致。

现状：已修复为 alias key。

### resolve 严格模型校验
此前问题：模型找不到时仅 warning，不 fail。

现状：已改为返回 `MODEL_NOT_FOUND`。

### capability 冲突校验
此前问题：缺少 `disallowCapabilities` / `requiredCapabilities` 的严格检查。

现状：已补 `RESOLVE_CONFLICT` 校验。

### runtime / registry 契约测试
已新增：
- `test/contract/registry-contract.test.ts`
- `test/contract/runtime-contract.test.ts`

### CLI JSON golden tests
已新增：
- `test/e2e/cli-json.test.ts`

## 3. 部分对齐

### provider / vendor / transport 语义分离
现状：字段已分离，resolver 对显式 provider/vendor/transport 冲突执行严格 `RESOLVE_CONFLICT` 校验，并在 diagnostics details 中返回 requested/resolved provider、vendor、transport 以及 provider 支持范围。

不足：该严格校验主要覆盖 `resolve` 路径；`run` 路径仍以 agent/intent/gateway 路由为主，尚未完全复用 resolver runtime preflight。

风险等级：中

### adapter doctor 职责
现状：adapter 接口定义了 `doctor()`，但主诊断逻辑仍集中在 `core/doctor`。

不足：尚未形成“公共检查 + adapter 专项检查”的完整组合机制。

风险等级：中

### 文本输出稳定性
现状：已补 renderer snapshot 测试。

不足：还未建立外部 golden file 机制，当前依赖 inline snapshot。

风险等级：低

## 4. 未完全对齐 / 后续建议

## 4.1 v0.3.2 对 PRD v2.0 的剩余任务盘点

当前 `cli-switch@0.3.2` 已经是可发布、可试用的 v0.3 基线。对照 `docs/PRD.md` 的 v2.0 目标，剩余工作按功能包计算如下：

| 优先级 | 功能包 | 当前状态 | 说明 |
|--------|--------|----------|------|
| P0 | provider/vendor/transport 严格解析 | resolve 路径完成 | `resolve` 已有严格冲突校验、机器可读 details 和契约测试；run/doctor 集成留给 preflight 收口。 |
| P0 | 平台与二进制前置检查 | 部分完成 | Resolver 层已有 `PLATFORM_UNSUPPORTED` / `BINARY_NOT_FOUND`，run/doctor 路径仍需统一。 |
| P0 | 错误码闭环 | 部分完成 | JSON envelope 和 resolver 错误较完整；run/strategy/sandbox/config 错误仍需统一。 |
| P1 | 执行策略增强 | 部分完成 | `single/write_review/write_test_fix/high_quality` 已有；`--strategy`、`--verify`、`--max-iterations`、`--profile` 未完成。 |
| P1 | 配置覆盖层 | 部分完成 | `registry.override.toml` 已有；`~/.cli-switch/config.yaml`、项目级 `.cli-switch.yaml`、`config show/set/reset` 未完成。 |
| P1 | 输出校验和自动修复 | 未完成 | 尚无 Capability schema 校验、diff validator、auto repair pipeline。 |
| P2 | 完整文件沙盒 | 未完成 | 当前只有环境隔离和 gateway HOME 隔离。 |
| P2 | patch-only 执行 | 未完成 | Agent 仍可直接修改真实工作区。 |
| P2 | 临时项目副本 | 未完成 | 尚未在 temp copy 内执行 Agent。 |
| P2 | worktree 隔离 | 未完成 | 尚未支持按任务创建/清理 git worktree。 |
| P2 | Skill 工作流 | 未完成 | 仅有 Hermes skill 雏形，未实现 `cli-switch skill run` 或 YAML Skill DSL。 |

估算完成度：
- v0.3 可用基线：约 80%+。
- PRD v2.0 完整目标：约 45%–55%。
- 下一轮建议先收口 P0 三项，再进入 P1 配置与输出校验。

### provider 解析策略收紧
现状：
- 当用户显式指定 `provider/vendor/transport` 时，resolver 执行严格兼容性校验。
- 不兼容时返回 `RESOLVE_CONFLICT`，并包含 requested/resolved/provider support details。

剩余建议：
- 在 run/doctor 的 runtime preflight 中复用 resolver 约束，避免命令路径行为分叉。

优先级：高

### 平台约束校验
建议：
- 对 `tool.supportedPlatforms`
- `profile.constraints.supportedPlatforms`
- `requiresBinary`
执行 resolver 期前校验

优先级：高

### 错误码体系闭环
建议补齐并统一测试：
- `CONFIG_NOT_FOUND`
- `BINARY_NOT_FOUND`
- `PLATFORM_UNSUPPORTED`

优先级：中

### 用户配置覆盖层
详细设计里有 `loadUserOverrides` / `merge` 概念。

现状：当前主要还是 builtins。

优先级：中

## 5. 当前结论

当前项目已经从“可运行 MVP”进入“生产级收口阶段”。

已具备：
- 可编译
- 可测试
- JSON 协议稳定
- 核心契约已有自动化护栏

距离严格对齐详细设计，还需要继续补：
- run/doctor 路径的 provider/vendor/transport 与 resolver preflight 对齐
- 平台与二进制约束前置校验
- 错误码闭环
- 用户配置覆盖层
