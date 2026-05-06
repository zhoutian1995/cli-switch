# cli-switch 产品需求文档 v2.0

> 更新日期：2026-05-06
>
> 本文档描述 **v2.0 目标产品形态**。当前仓库版本为 v0.3.0，已具备基础路由、调度和多 Agent 支持；本文档用于统一后续重构和增强方向。

## 文档体系

| 文档 | 定位 |
|------|------|
| `docs/PRD.md`（本文件） | **做什么** — 产品定位、用户、功能、MVP Scope |
| `docs/architecture.md` | **怎么做** — 架构设计、执行引擎、适配器层、竞品借鉴 |
| `docs/specs/runtime-spec.md` | **运行时规格** — JSON Schema、错误码、校验规则 |
| `docs/specs/routing-spec.md` | **路由规格** — Tier 系统、Auto/Custom 规则、策略定义 |
| `docs/specs/sandbox-spec.md` | **沙盒规格** — 环境隔离、HOME 隔离、文件安全 |

---

## 一句话

**让 AI Agent 能像调用函数一样调用"能力"，并由系统自动选择最优 Agent + 模型 + 执行策略完成任务。**

---

## 一、产品定位

### 1.1 核心定义

cli-switch 是一个 **Agent Capability Router（能力路由执行层）**。

它为上层 Agent（Hermes / OpenClaw）提供统一能力调用接口：

```
cli-switch run "实现用户登录功能"
```

系统自动完成：

```
任务理解 → 能力识别 → 策略选择 → Agent 选择 → 模型选择 → 沙盒执行 → 返回结果
```

### 1.2 核心用户

**主用户（不是人）**：
- Hermes / OpenClaw / Claude Agent / 其他 AI Agent

**次用户**：
- 开发者 / 自动化脚本 / CLI 用户

### 1.3 产品哲学

```
CLI     是执行层
Skill   是能力封装
网关    是模型入口
Agent   是执行者
能力    是核心抽象
```

### 1.4 交付形态

- **独立 CLI 工具**：底层，任何 Agent/脚本都能调用
- **Hermes Skill**：上层封装，Hermes 直接可用
- 不绑死任何平台，其他 Agent 通过 CLI 使用

### 1.5 用户价值

用户不需要关心：
- 用哪个模型（系统自动选或用户简单配置 tier）
- 用哪个 Agent（系统自动路由）
- 如何组合流程（Strategy / Skill 封装）

一句话调用，结构化结果返回。

---

## 二、解决的痛点

| 痛点 | cli-switch 怎么解 |
|------|------------------|
| 选型困难：不同 Agent 不同场景表现差异大 | 能力识别 + 智能路由，自动选最优 Agent + 模型 |
| 调用成本高：每个 Agent 独立配置体系 | 统一网关入口，一个 API Key 搞定 |
| 无法协同：Agent 之间无法通信或接力 | Strategy 编排多步执行，Skill 封装可复用流程 |
| 模型选择难：不知道该用哪个模型 | 用户自定义策略 + 系统默认智能路由 |
| 不可控：纯智能路由是黑盒 | 双模式：Auto（智能）+ Custom（用户定义） |

---

## 三、关键设计原则

### 3.1 ❗ 只支持第三方模型网关

不直接调用官方 API（OpenAI / Anthropic），全部通过网关调用。

用户只需配置：
```yaml
SWITCH_API_KEY=xxx
SWITCH_BASE_URL=https://your-gateway
```

### 3.2 ❗ Agent ≠ 模型

```
Claude Code ≠ Claude 模型
Codex CLI   ≠ OpenAI 模型
```

- **Agent（执行器）**：Claude Code / Codex CLI，负责理解和执行
- **Model（来自网关）**：任何兼容模型，负责推理

CLI 是执行器，模型来自网关，两者解耦。

### 3.3 ❗ 三层抽象

```
Capability（能力）= 原子操作（write_code / review_code / run_tests ...）
Strategy（策略）  = 执行编排（写→测→修）
Skill（技能）     = 可复用模板（登录功能开发、Bug 修复流程）
```

这是整个系统的核心骨架，不可变。

### 3.4 沙盒隔离

一次执行 = 一个独立 Agent 执行环境。

```
不能污染用户本机环境变量
不能影响用户已有的 Claude Code / Codex
任务结束即销毁
```

### 3.5 双模式

- **Auto**（默认）：零配置，系统自动路由
- **Custom**：用户定义每个能力用哪个 Agent / 模型 / 策略

---

## 四、核心功能

### 4.1 能力路由

系统识别用户意图，映射到 Capability，自动选择 Agent + 模型。

| Capability | 说明 |
|-----------|------|
| `write_code` | 写代码（新建或修改） |
| `write_tests` | 编写测试 |
| `run_tests` | 执行测试 |
| `review_code` | 审查代码 |
| `fix_error` | 修复错误 |
| `refactor` | 重构 |
| `analyze` | 分析问题 |
| `explain` | 解释代码 |

> 详细定义见 `architecture.md`

### 4.2 模型路由

通过 tier 抽象选择模型，不硬编码模型名：

| tier | 含义 | 典型场景 |
|------|------|---------|
| `economy` | 轻量模型 | 写测试、跑测试、解释 |
| `standard` | 默认模型 | 日常开发 |
| `premium` | 高算力模型 | 写代码、审查、复杂调试 |

> tier 到真实模型名的映射由用户 gateway 配置决定。详细规则见 `routing-spec.md`

### 4.3 沙盒隔离

每次执行在独立环境中：
- 独立环境变量和 API Key
- HOME 隔离（Agent 读不到用户本机配置）
- 文件系统白名单（Agent 只能碰项目目录内文件）
- 任务结束即销毁

> 详细方案见 `sandbox-spec.md`

### 4.4 Strategy 执行

定义能力的执行顺序和失败处理：

```
单步执行       write_code
写 + 审        write_code → review_code
写 + 测 + 修   write_code → write_tests → run_tests → fix_error（Loop）
高质量模式     全部 premium tier
```

系统支持自动 Loop（写→测→失败→修→重测），失败自动分类处理：
- `syntax_error` → 重试
- `test_failure` → 修复后重跑
- `timeout` → 升级模型或切换 Agent
- `agent_error` → 重启 Agent

> 详细定义见 `architecture.md`，错误码见 `runtime-spec.md`

### 4.5 结构化输出

所有执行结果统一为 JSON 格式，包含：
- 执行状态和摘要
- 文件变更和 diff
- 错误信息
- `decision_trace`（为什么选这个 Agent / 模型 / 策略）

> 完整 JSON Schema 见 `runtime-spec.md`

### 4.6 异常恢复

系统支持多级异常恢复：
- 输出校验失败 → 自动修复（diff 格式修复、噪音清洗）
- 执行失败 → 自动重试 / 升级模型 / 切换 Agent
- 上下文溢出 → 自动裁剪（保留关键信息，丢弃冗余）

> 详细流程见 `runtime-spec.md`

---

## 五、MVP Scope

### v0.1 — 基础可运行

- [ ] 沙盒环境（进程隔离 + 环境变量注入）
- [ ] Claude Code 适配器（单步执行）
- [ ] Gateway 注入（SWITCH_API_KEY / SWITCH_BASE_URL）
- [ ] JSON 输出
- [ ] `cli-switch run <任务> --agent claude-code`

### v0.2 — 双 Agent

- [ ] Codex 适配器
- [ ] Auto 模式（规则路由：能力 → Agent）
- [ ] Tier 路由（economy / standard / premium）
- [ ] `cli-switch run <任务>` （自动选 Agent）

### v0.3 — 编排

- [ ] Strategy 引擎（多步编排）
- [ ] Loop 自动迭代（写→测→修）
- [ ] 失败分类 + 升级链
- [ ] `cli-switch run <任务> --execution write_test_fix`

### v0.4 — 体验

- [ ] Skill 基础版（YAML 模板）
- [ ] Custom 模式（能力路由配置）
- [ ] 项目级配置覆盖
- [ ] `cli-switch skill run login_dev`

### v0.5 — 健壮性

- [ ] Diff Repair Pipeline
- [ ] Context Budget 控制
- [ ] 输出校验 + 自动修复
- [ ] `cli-switch doctor` 诊断

### 暂不做

- ❌ Committee 多 Agent 评审（v2.0）
- ❌ Skill Marketplace（v2.0）
- ❌ Experience Pool 能力学习（v2.0）
- ❌ Git Worktree 隔离（v0.5 后续）
- ❌ 显式 MCP Agent-to-Agent（v2.0 后续）
- ❌ 复杂 Skill DSL（YAML 够用）

---

## 六、支持的 Agent

### 核心支持：2 个

| Agent | 定位 | 擅长 |
|-------|------|------|
| Claude Code | 重型执行器 | 长上下文、复杂推理、架构级任务 |
| Codex CLI | 轻型执行器 | 快速生成、测试、简单任务 |

当前 v0.3.0 已通过 registry/adapter 体系预留并部分支持 Gemini / OpenCode / Aider 等 Agent。v2.0 的核心产品验证仍以 Claude Code + Codex CLI 为主，其他 Agent 作为扩展适配器接入。

### 多 Agent 协作

v2.0 不暴露显式 MCP Agent-to-Agent 能力。多 Agent 协作只通过 Strategy / Skill 的编排结果体现，用户不需要感知底层是否发生 Agent 切换、审查或接力。

---

## 七、CLI 命令

### 核心命令

```bash
cli-switch run <任务描述> [选项]
```

选项：
```
--agent <agent>           指定 Agent: claude-code | codex
--model <tier|model-id>   指定 tier 或网关模型 ID
--profile <name>          指定成本档位: balanced | high_quality | low_cost
--execution <mode>       指定执行模式: single | write_review | write_test_fix
--verify <cmd>            Loop 验证命令（如 "npm test"）
--max-iterations <n>      Loop 最大迭代次数（默认 5）
--dry-run                 只看路由决策，不执行
--json                    JSON 输出
--timeout <秒>            超时时间（默认 120 秒）
--cwd <路径>              工作目录
```

### 配置命令

```bash
cli-switch config show          # 显示当前配置
cli-switch config set <key> <v> # 修改配置
cli-switch config reset         # 重置为默认
```

### 诊断命令

```bash
cli-switch doctor               # 综合诊断
cli-switch auth status          # 检查网关连接
cli-switch list agents          # 列出可用 Agent
cli-switch list models          # 列出网关可用模型
```

---

## 八、性能目标

| 指标 | 目标 |
|------|------|
| 沙盒启动时间 | < 500ms |
| 单步执行超时 | 120s（可配置） |
| 最大 Loop 迭代 | 5 次（可配置） |
| 总执行超时 | 300s（可配置） |
| JSON 输出延迟 | < 100ms（执行完成后） |

---

## 九、错误码

| 错误码 | 含义 | 上层 Agent 行为 |
|--------|------|----------------|
| `AGENT_TIMEOUT` | Agent 单次执行超时 | 可重试，详见 runtime-spec 升级链 |
| `AGENT_CRASHED` | Agent 进程崩溃 | 重启后重试 → 升级 tier → 切换 Agent |
| `SCHEMA_INVALID` | Agent 输出校验失败 | 系统自动修复，详见 runtime-spec |
| `RATE_LIMITED` | 网关限流 | 等待后重试 |
| `GATEWAY_ERROR` | 网关不可用 | 检查配置 |
| `SANDBOX_ERROR` | 沙盒创建/销毁失败 | 检查系统环境 |
| `STRATEGY_ABORTED` | Strategy 达到最大重试 | 人工介入 |
| `CONFIG_INVALID` | 配置文件格式错误 | 检查配置 |

> 完整错误码定义和处理策略见 `runtime-spec.md`

---

## 十、兼容性

### 向后兼容

- v0.1 → v0.2：配置格式不变，新增字段有默认值
- v0.2 → v0.3：CLI 命令不变，新增 `--execution` 选项
- v0.3 → v0.4：新增 `skill` 命名空间，不影响 `run`

### 旧版迁移

旧 cli-switch 用户（v0.3.0）配置需要迁移：
- `~/.cli-switch/config.json` → `~/.cli-switch/config.yaml`
- 模型名称改为 tier 抽象
- 旧 `--strategy` 参数如曾用于执行模式，迁移为 `--execution`
- 首次运行自动检测旧配置并提示迁移

---

## 十一、文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| PRD | `docs/PRD.md` | 产品定位、功能、MVP（本文件） |
| 架构设计 | `docs/architecture.md` | 三层抽象、执行引擎、适配器层、竞品借鉴 |
| 运行时规格 | `docs/specs/runtime-spec.md` | JSON Schema、错误码、校验规则、Context Policy |
| 路由规格 | `docs/specs/routing-spec.md` | Tier 系统、Auto/Custom 路由规则、策略定义 |
| 沙盒规格 | `docs/specs/sandbox-spec.md` | 环境隔离、HOME 隔离、文件安全 |
