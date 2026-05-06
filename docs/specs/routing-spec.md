# Routing Spec — 路由规格

> **定位**：本文档定义 cli-switch 的模型路由和策略路由规则，包括 Tier 系统、Auto 模式路由规则、Custom 模式配置和默认策略。
>
> **上游**：[PRD.md](../PRD.md)（四、核心功能 + 七、CLI 命令）
>
> **下游**：实现层的路由引擎、策略引擎、配置管理模块
>
> **关系**：本 spec 是 PRD 路由相关章节的结构化提取和细化，为路由引擎和策略引擎的设计提供精确规则定义。
>
> **状态说明**：本文档包含当前 v0.3.0 路由实现和 PRD v2.0 目标路由。当前代码以 intent type + agent ranking + registry model resolution 为主；tier/gateway/capability routing 是 v2.0 目标。

---

## 0. 当前实现基线（v0.3.0）

当前 `run` 路由链路：

```
parseIntent(input, optional OpenRouter config)
  ↓
routeWithFallback(intent, optional LLMService)
  ↓
selectModel(agent, intent)
  ↓
resolveAgentCommand(agent, input)
  ↓
ProcessManager / ACPBridge
```

当前 intent taxonomy 不是 `write_code` / `fix_error` 等 Capability，而是中文任务类型：

| 当前 TaskIntent.type | 触发关键词示例 |
|----------------------|----------------|
| `代码生成` | 默认类型 |
| `重构` | refactor / 重构 |
| `调试` | debug / fix / bug / 调试 / 修复 |
| `测试` | test / spec / 测试 |
| `解释` | explain / what / why / 解释 / 说明 |

当前 Auto 路由是 LLM-first 可选：
- 如果存在 `OPENROUTER_API_KEY`，`run` 会用 OpenRouter 做 intent 解析和 LLM 路由增强。
- LLM 调用失败或未配置时，回退到规则路由。
- 规则路由：长上下文、调试、跨仓库复杂度倾向 Claude Code；测试倾向 Codex；默认 Claude Code。

当前模型解析分两条路径：
- `run` 路径使用 `src/core/router/model-selector.ts` 的 agent/intent 模型选择。
- `resolve` 路径使用 Registry / Resolver，根据 tool/profile/model/provider/vendor/transport 生成 `RuntimeSpec`。

当前 Registry 支持的内置 tools：

| Tool | 默认 profile | 默认模型来源 |
|------|--------------|--------------|
| `claude-code` | `default` / `api` | `src/registry/builtins/profiles.toml` + adapter alias |
| `codex` | `default` | `src/registry/builtins/profiles.toml` + adapter alias |
| `gemini` | `default` | `src/registry/builtins/profiles.toml` + adapter alias |

## 0.1 当前到 v2 Capability 的映射

v2.0 应在当前 intent taxonomy 之上增加 Capability 归一层：

| 当前 TaskIntent.type | 默认 v2 Capability | 备注 |
|----------------------|--------------------|------|
| `代码生成` | `write_code` | 需要根据任务是否只读进一步细分 |
| `重构` | `refactor` | 当前路由偏 Claude Code |
| `调试` | `analyze` 或 `fix_error` | 需要根据是否允许改文件判断 |
| `测试` | `write_tests` 或 `run_tests` | 需要根据是否提供 test command 判断 |
| `解释` | `explain` | 只读能力 |

Capability 归一后，才能启用后文的 `capability_tier_override`、Strategy 选择和输出 schema。

---

## 1. Tier 系统

> v2.0 目标：当前代码尚未实现 `economy / standard / premium` tier 配置，也未实现 `SWITCH_API_KEY` / `SWITCH_BASE_URL` gateway-only 路由。当前代码使用 registry profile 默认模型、adapter model alias，以及 Agent 原生命令的认证环境变量。

### 1.1 Tier 定义

cli-switch 不硬编码模型名，用 **tier（等级）** 抽象模型选择：

| Tier | 说明 | 定位 |
|------|------|------|
| `economy` | 轻量模型 | 低成本 / 批量任务 / 简单任务 |
| `standard` | 默认模型 | 普通任务 / 日常开发 |
| `premium` | 高算力模型 | 高质量 / 高风险 / 复杂推理 |

### 1.2 Tier 到模型名的映射（通过 Gateway 配置）

tier 到真实模型名的映射由 **gateway 配置** 决定，cli-switch 只负责传给网关：

```yaml
# ~/.cli-switch/config.yaml
gateway:
  api_key: ${SWITCH_API_KEY}
  base_url: ${SWITCH_BASE_URL}
  # tier → 真实模型名映射（用户按自己网关的模型命名填写）
  models:
    economy: your-gateway-cheap-model
    standard: your-gateway-default-model
    premium: your-gateway-premium-model
```

> **设计原则**：cli-switch 不绑定任何具体模型，gateway 决定 tier 的实际含义。

### 1.3 capability_tier_override

不同 Capability 对模型能力要求不同。默认用策略的 tier，但可按能力覆盖：

```yaml
# ~/.cli-switch/config.yaml
routing:
  tier_default: standard                  # 全局默认 tier
  capability_tier_override:               # 按能力覆盖
    write_code: premium                   # 写代码必须用好模型
    review_code: premium                   # 审查也用好模型
    write_tests: economy                   # 写测试轻量模型够用
    run_tests: economy                     # 跑测试不需要好模型
    explain: economy                       # 解释也够用
    analyze: standard                      # 分析错误需要中等模型
```

---

## 2. Auto 模式路由规则

> v2.0 目标：本节描述 Capability 归一后的目标路由。当前实现见“0. 当前实现基线”。

### 2.1 能力识别规则映射表

输入：用户任务关键词 / 特征
输出：能力类型

| 关键词 / 特征 | 识别为能力 |
|--------------|-----------|
| 写/实现/开发/创建 | write_code |
| 审/审查/review | review_code |
| 测试/test | write_tests |
| 调试/debug/报错 | analyze |
| 重构/refactor | refactor |
| 解释/说明 | explain |
| 修复/fix/解决 | fix_error |

### 2.2 Agent 路由规则（Auto 模式）

v2.0 目标规则路由（不依赖 LLM）：

| 条件 | Agent | 理由 |
|------|-------|------|
| 长上下文 / 复杂推理 / 重构 / 调试 | Claude Code | Claude Code 擅长 200K 长上下文和复杂推理 |
| 快速生成 / 测试 / 简单任务 | Codex | Codex 擅长快速生成和轻量任务 |
| 用户自定义配置覆盖 | 按配置执行 | Custom 模式优先级高于 Auto |

### 2.3 策略选择规则

系统根据识别出的能力自动选择默认策略：

| 能力 | 默认策略 | 理由 |
|------|---------|------|
| write_code | 单步执行 | 生成新代码，一步到位 |
| review_code | 单步执行 | 审查是独立动作 |
| write_tests | 写+测+修（Loop） | 需要验证测试通过 |
| analyze | 单步执行 | 分析是探索性任务，不改文件 |
| refactor | 写+审 | 重构有风险，需要审查 |
| explain | 单步执行 | 纯文本输出 |
| fix_error | 写+测+修（Loop） | 必须验证修复成功 |

**策略流程对照**：

| 策略 | 流程 | 适用场景 |
|------|------|---------|
| **单步执行**（默认） | Agent 执行 → 输出 | 简单生成、解释 |
| **写 + 审** | write_code → review_code | 功能开发 |
| **写 + 测 + 修**（Loop） | write_code → write_tests → run_tests → 失败则 fix_error → 重试 | 需要验证的任务 |
| **高质量模式** | write_code(premium) → review_code(premium) → run_tests → 修复 | 关键功能、高风险 |

---

## 3. Custom 模式

### 3.1 Routing Config YAML 格式

```yaml
# ~/.cli-switch/config.yaml
routing:
  write_code:
    agent: claude-code
    tier: premium                      # 生成新代码用好模型
  review_code:
    agent: claude-code
    tier: premium                      # 审查要严
  write_tests:
    agent: codex
    tier: economy                      # 写测试轻量够用
  run_tests:
    agent: codex
    tier: economy                      # 跑测试不需要好模型
  analyze:
    agent: codex
    tier: standard
  fix_error:
    agent: claude-code
    tier: standard
  refactor:
    agent: claude-code
    tier: standard
  explain:
    agent: codex
    tier: economy
```

### 3.2 策略级配置格式

策略级配置包含两个独立维度：**成本档位**（决定 Agent + Tier）和**执行模式**（决定编排方式）。

```yaml
# 概念示例：实际内置文件按 cost_profiles/ 和 execution_modes/ 拆分存放

# 维度 1：成本档位（每个 Capability 的 Agent + Tier 选择）
cost_profiles:
  high_quality:
    write_code:
      agent: claude-code
      tier: premium
    review_code:
      agent: claude-code
      tier: premium
    write_tests:
      agent: claude-code
      tier: premium
    run_tests:
      agent: claude-code
      tier: premium
    fix_error:
      agent: claude-code
      tier: premium
    analyze:
      agent: claude-code
      tier: premium
    refactor:
      agent: claude-code
      tier: premium
    explain:
      agent: claude-code
      tier: standard

# 维度 2：执行模式（Capability 编排规则）
execution_modes:
  write_test_fix:
    steps:
      - capability: write_code
        on_fail: abort
      - capability: write_tests
        on_fail: abort
      - capability: run_tests
        on_fail: fix_error
      - capability: fix_error
        on_fail: abort
    loop:
      target: run_tests
      max_iterations: 5
      exit_condition: tests_passed
  write_review:
    steps:
      - capability: write_code
        on_fail: abort
      - capability: review_code
        on_fail: abort
```

> 执行模式的完整 Schema 详见 `architecture.md` 3.2 Strategy 引擎。

### 3.3 配置三级覆盖

```
任务级配置  >  项目配置  >  全局配置
```

**配置文件路径约定**：

| 层级 | 路径 | 优先级 | 说明 |
|------|------|-------|------|
| 全局 | `~/.cli-switch/config.yaml` | 低 | 用户全局默认 |
| 成本档位（内置） | `~/.cli-switch/cost_profiles/balanced.yaml` | — | 内置，不可修改 |
| 成本档位（内置） | `~/.cli-switch/cost_profiles/high_quality.yaml` | — | 内置，不可修改 |
| 成本档位（内置） | `~/.cli-switch/cost_profiles/low_cost.yaml` | — | 内置，不可修改 |
| 执行模式（内置） | `~/.cli-switch/execution_modes/single.yaml` | — | 内置，不可修改 |
| 执行模式（内置） | `~/.cli-switch/execution_modes/write_review.yaml` | — | 内置，不可修改 |
| 执行模式（内置） | `~/.cli-switch/execution_modes/write_test_fix.yaml` | — | 内置，不可修改 |
| 执行模式（自定义） | `~/.cli-switch/execution_modes/custom.yaml` | — | 用户自定义 |
| 项目级 | `./.cli-switch.yaml` | 高 | 项目根目录覆盖（最高优先级） |
| 任务级 | CLI 参数 `--profile` / `--execution` / `--agent` / `--model` | 最高 | 单次执行覆盖 |

**覆盖规则示例**：

```yaml
# 全局配置 (~/.cli-switch/config.yaml)
routing:
  write_code:
    agent: claude-code
    tier: standard

# 项目级覆盖 (./.cli-switch.yaml) — 只覆盖需要变更的字段
routing:
  write_code:
    tier: premium                    # 这个项目用高质量模型
  review_code:
    agent: codex                     # 这个项目用 Codex 审查
loop:
  verify_command: "pytest"           # 这个项目用 pytest
```

**合并规则**：
- 项目级配置与全局配置**深度合并**（deep merge）
- 项目级只声明需要覆盖的字段，未声明的字段继承全局配置
- CLI 命令行参数的优先级高于所有配置文件

---

## 4. 默认策略

### 4.1 两个维度

cli-switch 的策略由两个独立维度组合：

| 维度 | 名称 | 可选值 | 含义 |
|------|------|--------|------|
| **成本档位**（cost profile） | `balanced` / `high_quality` / `low_cost` | 决定 Agent + Tier 选择 |
| **执行模式**（execution mode） | `single` / `write_review` / `write_test_fix` | 决定 Capability 步骤编排 |

两个维度独立配置，通过 `--profile <档位>` 和 `--execution <模式>` 分别指定。

### 4.2 成本档位（Cost Profile）

决定每个 Capability 用哪个 Agent + 哪个 Tier：

| 档位 | 说明 | write_code | review_code | write_tests / run_tests |
|------|------|-----------|------------|------------------------|
| **balanced**（默认） | 均衡 | Claude Code + standard | Claude Code + standard | Codex + standard |
| **high_quality** | 高质量 | Claude Code + premium | Claude Code + premium | Claude Code + premium |
| **low_cost** | 低成本 | Codex + economy | Codex + economy | Codex + economy |

### 4.3 执行模式（Execution Mode）

决定 Capability 的编排方式（详见 `architecture.md` 3.2 Strategy 引擎）：

| 模式 | 流程 | 适用场景 |
|------|------|---------|
| **single**（默认） | 单步执行 | 生成、解释、分析 |
| **write_review** | write_code → review_code | 功能开发 |
| **write_test_fix** | write_code → write_tests → run_tests → fix_error（Loop） | 需要验证的任务 |

### 4.4 默认组合

Auto 模式下，系统根据能力自动选择默认组合：

| 能力 | 默认档位 | 默认执行模式 | 理由 |
|------|---------|-------------|------|
| write_code | balanced | single | 生成代码一步到位 |
| review_code | balanced | single | 审查是独立动作 |
| write_tests | balanced | write_test_fix | 需要验证测试通过 |
| run_tests | balanced | single | 只执行测试 |
| analyze | balanced | single | 探索性任务 |
| refactor | balanced | write_review | 重构需要审查 |
| explain | balanced | single | 纯文本输出 |
| fix_error | balanced | write_test_fix | 必须验证修复 |

用户可通过 Custom 模式覆盖默认组合。

> 详细配置格式见 3.2 Custom 模式。
