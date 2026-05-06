# cli-switch 架构设计文档 v1.0

> **本文档是 cli-switch 架构设计文档，与 PRD 互补。PRD 定义"做什么"，本文档定义"怎么做"。**
>
> 本文档聚焦**设计决策与为什么**，具体配置详见各 spec 文档。
>
> 更新日期：2026-05-06

---

## 一、架构概览

### 1.1 三层抽象：Capability / Strategy / Skill

```
Skill = Strategy + Capability 组合
Strategy = Capability 执行顺序
Capability = 原子能力
```

```
┌─────────────────────────────────────────────┐
│  Skill（技能）= 可复用模板                    │
│  login_feature_dev / bug_fix_flow / ...     │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Strategy（策略）= 可执行编排规则       │  │
│  │  steps[] + on_fail + loop 控制        │  │
│  │                                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │
│  │  │Capability│ │Capability│ │Capability│ │  │
│  │  │ (原子)   │→│ (原子)   │→│ (原子)   │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**为什么三层**：
- **Capability** 是最小粒度，对应 Agent 一次执行的明确行为，便于复用和组合
- **Strategy** 将 Capability 串成可执行流程，定义失败处理和循环控制
- **Skill** 是面向用户的模板，将 Strategy + 默认参数封装为可复用方案

### 1.2 Capability 清单

| Capability | 执行行为 | 输入 | 产出 | system_prompt 模板 | expected_output |
|-----------|---------|------|------|-------------------|-----------------|
| `write_code` | 生成或修改代码（新文件/新函数/已有文件修改） | task + context + target_files? | files_changed + diff | You are a code modification agent. Modify the target files to complete the task. Only modify the specified files. | Unified diff in `--- a/ ... +++ b/ ... @@` format |
| `review_code` | 审查代码（只读，不改文件） | target_files + review_focus | review_report (pass/reject + comments) | You are a code reviewer. Analyze the target files for bugs, style issues, and design concerns. Do not modify any files. | Structured review with pass/reject verdict and line-level comments |
| `write_tests` | 编写测试用例 | target_files + test_framework | test_files_created | You are a test engineer. Write comprehensive tests for the target files using the specified framework. | New test files with proper assertions and coverage |
| `run_tests` | 执行测试（只运行，不写） | test_command | test_result (pass/fail + output) | You are a test runner. Execute the given test command and report the results. | Test execution output with pass/fail counts and failure details |
| `analyze` | 分析错误原因（只分析，不修复） | error_output + context | analysis_report (root_cause + suggestion) | You are a debugging analyst. Identify the root cause of the error and suggest a fix. Do not modify any files. | Root cause analysis with suggested fix approach |
| `fix_error` | 修复已知错误 | error_output + analysis | files_changed + diff | You are a debugging agent. Fix the reported error in the target files based on the analysis. Produce a unified diff. | Unified diff fixing the reported error |
| `refactor` | 重构（改结构不改行为） | target_files + refactor_goal | files_changed + diff + test_validation | You are a refactoring agent. Restructure the target code to improve design without changing behavior. Produce a unified diff. | Unified diff preserving all existing test behavior |
| `explain` | 解释/分析（纯文本，不改文件） | target_files + question | explanation_text | You are a technical writer. Explain the specified code or concept clearly and concisely. Do not modify any files. | Plain text explanation with code references |

> **注意**：原 PRD 中 `generate_code` 和 `modify_code` 已合并为 `write_code`。

### 1.3 执行契约（Execution Contract）

每个 Capability 的输入/产出必须可结构化：

```yaml
capability: write_code
input:
  task: string              # 用户任务描述
  target_files: string[]    # 要修改的文件（可选，Agent 可自动发现）
  context: string           # 补充上下文（可选）
output:
  status: success | failed
  files_changed: string[]
  diff: string
  summary: string
```

**设计约束**：
- 每个 Capability 对应**一个明确执行行为**，不能模糊
- 读操作（review/explain/analyze）**禁止修改文件**
- 写操作（write_code/fix_error/refactor）**必须产出 diff**
- Agent 不知道 Capability 的存在，它只收到结构化 prompt

### 1.4 Capability 上下文传递规则

Strategy 的多步执行中，每一步的输出自动流入下一步的输入：

```
Step 1 (write_code) → output.files_changed, output.diff, output.summary
    ↓ 自动注入
Step 2 (write_tests) → input.context = 上一步的 {files_changed, diff, summary}
    ↓ 自动注入
Step 3 (run_tests)   → input.context = 上一步的 {test_files_created}
    ↓ 失败时注入
Step 4 (fix_error)   → input.error_output = run_tests 的 output.test_result
                        input.context = write_code 的 output
```

**默认传递规则**：
```
上一步 output → 下一步 input.context（自动合并）
失败时：失败步骤的 output → fix_error 的 input.error_output
Loop 回注：验证失败的 error_output → 下一轮的 input.context
```

**Context Token 预算控制**：

多步 / 多轮 Loop 执行中，context 会指数增长。必须有 token 预算机制防止炸上下文。

**设计思路**：
- 单步 `input.context` 有 `max_tokens` 上限（MVP 固定 8000）
- 超限时按优先级裁剪：最近一步 output > error_output > 历史 summaries > target_files > diff
- Loop 只保留最近 3 轮完整 context，更早轮次只保留 summary
- 支持 truncate / summarize 两种策略

> 详见 `specs/runtime-spec.md` 中 context_policy 完整配置。

**可选显式映射**（覆盖默认）：

```yaml
steps:
  - capability: write_code
    on_fail: abort
  - capability: write_tests
    context_mapping:                      # 显式指定传什么
      - from: write_code.files_changed    # 取 write_code 的 files_changed
        to: target_files                  # 作为 write_tests 的 target_files
      - from: write_code.diff             # 取 diff
        to: context                       # 作为 context
```

### 1.5 Agent 输入标准化

Agent 不知道 Capability 的存在。cli-switch 将 Capability 的 input/output 转换为标准 prompt 结构后发送给 Agent。

**设计思路**：
- 所有 Agent（Claude Code / Codex）收到**相同的 prompt 结构**，只有 system_prompt 按 Capability 不同
- prompt 包含：`system_prompt` + `task` + `target_files` + `context` + `expected_output_format` + `constraints`
- `expected_output_format` 强制 Agent 输出 cli-switch 可解析的结构化格式
- Agent 不知道自己在执行哪个 Capability，也不知道前后还有其他步骤

> 详见 `specs/runtime-spec.md` 中 agent_input 完整结构和各 Capability 的 prompt 模板。

### 1.6 Agent 输出校验（Output Validation）

Agent 输出不可信。cli-switch 必须在解析前做强校验，校验失败有自动修复机制。

**处理流程**：
```
Agent stdout → stdout 预处理（去噪） → 解析为结构化输出 → Schema 校验 → 成功则进入下一步
                                                            → 失败则自动修复
```

#### stdout 预处理

Agent 的 stdout 经常包含噪音——reasoning、greeting、markdown 包装、ANSI 转义码。必须在校验前清洗。

**设计思路**：
- 三遍处理：物理清洗（ANSI/换行/空白）→ 结构提取（diff/JSON/code_block）→ 噪音检测（开头废话/结尾废话）
- 提取策略 `greedy`：从 stdout 中找到最大的匹配块（优先 diff > json > code_block）
- 提取失败（找不到任何匹配块）→ 整段 stdout 作为 context 发给 auto_repair
- 预处理器不修改 stdout 原文，输出清洗后的副本

> 详见 `specs/runtime-spec.md` 中 stdout_preprocessor 完整配置。

#### 两层校验

- **第一层：格式校验**（Zod schema，必须通过）
  - 所有 Capability 必须有 `status` + `summary`
  - 写操作还必须有 `files_changed` / `diff` 等 Capability 特有字段
  - 允许额外字段（Agent 经常多输出 reasoning/confidence 等），多余字段无声丢弃
- **第二层：语义校验**（写操作必须通过）
  - diff 能否被 unified diff parser 解析
  - diff 中的文件路径是否在 target_files 白名单内

> 详见 `specs/runtime-spec.md` 中 output_validation 完整配置。

#### 自动修复与降级链

写操作 diff 校验失败时，按以下顺序尝试修复：

```
同一 Agent（免费，有完整上下文）→ standard tier → retry 当前步骤 → abort
```

economy 模型不参与 diff 修复——指令遵循精度不够，容易越修越乱。

> 详见 `specs/runtime-spec.md` 中 Diff 修复流程和降级链完整定义。

**核心约束**：
- 任何进入下一步的数据必须经过 schema 校验，不信任 Agent 的原始输出
- 读操作（explain / analyze）输出格式校验失败 → retry 一次 → 失败则返回原文 + 警告
- 写操作（write_code / fix_error / refactor）diff 校验失败 → auto_repair → 再失败则 abort

### 1.7 Strategy 全局执行状态

Strategy 执行过程中维护一个全局 `execution_state`，所有步骤共享读写。

**结构概述**：
- **基础信息**：strategy_name / current_step / current_capability / total_steps
- **Loop 控制**：iteration / max_iterations
- **累积数据**：history[]（所有步骤的执行记录，裁剪后）
- **错误累积**：errors[]（按步骤和迭代记录错误）
- **资源追踪**：total_tokens_used / total_duration_ms / start_time

**执行状态的作用**：
- **decision_trace 数据源**：最终输出的 decision_trace 从 execution_state.history 生成
- **Loop 控制**：`iteration` / `errors` 驱动 Loop 的继续/退出决策
- **超时判断**：`total_duration_ms` vs `timeout` 配置
- **成本控制**：`total_tokens_used` vs `max_tokens_budget`（后续可加）
- **调试 / 回溯**：完整的步骤历史 + 错误累积，方便排查问题

**写入时机**：
- 每步执行前：更新 `current_step` / `current_capability`
- 每步执行后：追加 `history[]` + 更新资源计数
- 错误发生时：追加 `errors[]`
- Loop 回注时：`iteration++` + 裁剪旧 history（遵循 context_policy）

**裁剪策略**（长 Loop 场景下防止 history 持续增长）：
- history 超过 10 步时，旧步骤只保留 `{step, capability, status, summary}`，丢弃完整 output
- errors 超过 5 个时，旧错误只保留 `{error_type, step, iteration}`，丢弃 error_output
- 与 `context_policy.loop_history.max_iterations_kept: 3` 对齐

> 详见 `specs/runtime-spec.md` 中 execution_state 完整 YAML 定义和 execution_state_policy 配置。

### 1.8 文件系统操作边界

Agent 写操作受严格限制：

```
允许读：项目目录内所有文件（递归）
允许写：仅限 target_files 白名单 + 新建文件（必须在 project 目录内）
禁止：  删除文件、修改 .git/、修改 node_modules/、修改配置文件（除非明确指定）
```

**设计思路**：
- MVP 只做写白名单，不做细粒度权限（够用即可）
- `output_mode: patch`：写操作产出 patch，不直接改文件
- protected_paths（.git/、node_modules/、.env、*.lock）绝对不能碰

**两层安全**：
1. **Prompt 层**：在 system_prompt 中告知 Agent 限制（软约束）
2. **执行层**：禁用直接写入或在临时项目副本中执行，只接收 patch，再由 cli-switch 校验后 apply（硬约束）

> 详见 `specs/sandbox-spec.md` 中 file_policy 完整配置。

---

## 二、适配器层

### 2.1 ACP 协议

cli-switch 和 Agent（Claude Code / Codex）之间的目标标准对话层基于 **ACP（Agent Client Protocol）**，使用 **NDJSON（Newline-Delimited JSON）over stdio** 通信。

实现约束：
- ACP 作为优先协议层；Agent 原生不支持 ACP 时，使用进程适配器桥接 stdout/stderr/stdin。
- `@agentclientprotocol/sdk` 是目标协议依赖，正式引入前需在实现计划中明确版本、API 面和 fallback 行为。
- 适配器层不得假设所有 Agent 都天然支持 ACP。

| 模块 | Paseo 源文件 | 行数 | cli-switch 怎么用 |
|------|-------------|------|------------------|
| ACP 完整实现 | `acp-agent.ts` | 2511 | 直接搬，精简掉 UI 相关部分 |
| 通用 ACP 适配器 | `generic-acp-agent.ts` | 38 | **核心**：一行配置接入新 Agent |
| Claude 适配器 | `claude-agent.ts` | 4611 | 搬核心逻辑，去掉 Paseo 特有依赖 |
| Codex 适配器 | `codex-app-server-agent.ts` | 4821 | 同上 |
| 统一类型系统 | `agent-sdk-types.ts` | 550 | AgentClient / AgentSession / AgentStreamEvent 等 44 个类型 |

**关键设计模式**：
- `generic-acp-agent.ts` 只需传入 `command` + `args` + `env`，即可接入任何 ACP 兼容 Agent
- Claude / Codex 适配器继承通用层，只实现各自特有的消息解析和流式处理
- 子进程通过 stdio 双向通信，协议与进程生命周期解耦

### 2.2 Claude Code 适配器

```
claude-code adapter
  ├── 继承 GenericACP 基础通信层
  ├── 实现特有消息解析（Claude 的 tool_use / text 输出格式）
  ├── 实现流式处理（Claude 的 content_block_delta 事件）
  └── 长上下文支持（200K tokens）
```

- 源文件：`claude-agent.ts`（4611 行）
- 适配内容：核心逻辑搬入，去掉 Paseo 特有依赖
- 定位：重型执行器，擅长长上下文、复杂推理、架构级任务

### 2.3 Codex 适配器

```
codex adapter
  ├── 继承 GenericACP 基础通信层
  ├── 实现特有消息解析（Codex 的 message 格式）
  ├── 实现流式处理（Codex 的 stream 事件）
  └── 快速执行优化
```

- 源文件：`codex-app-server-agent.ts`（4821 行）
- 适配内容：核心逻辑搬入，去掉 Paseo 特有依赖
- 定位：轻型执行器，擅长快速生成、测试、简单任务

### 2.4 GenericACP 通用适配器（一行配置接入）

`generic-acp-agent.ts` 只需 38 行，传入 `command` + `args` + `env` 即可接入任何 ACP 兼容 Agent：

```typescript
// 示例：接入一个新的 ACP 兼容 Agent
const agent = new GenericACPAgent({
  command: "my-agent",
  args: ["--stdio"],
  env: { ...baseEnv, API_KEY: "xxx" }
});
```

任何实现了 ACP 协议的 CLI 工具都可以通过这个通用适配器接入 cli-switch，无需编写额外代码。

### 2.5 统一类型系统

来自 `agent-sdk-types.ts`（550 行），包含 44 个核心类型：

| 类型 | 说明 |
|------|------|
| `AgentClient` | Agent 客户端接口（create / destroy / send / subscribe） |
| `AgentSession` | 单次会话状态（id / status / events） |
| `AgentStreamEvent` | 流式事件类型（text / tool_use / error / done） |
| `AgentMessage` | 消息结构（role / content / metadata） |
| `AgentConfig` | Agent 配置（command / args / env / timeout） |
| ... | 共 44 个类型，覆盖完整生命周期 |

所有适配器共享统一类型系统，确保上层代码无需关心底层 Agent 差异。

---

## 三、执行引擎

### 3.1 主链路流程

```
用户 / Agent 输入
  ↓
任务解析（识别任务类型、复杂度、技术栈）
  ↓
能力识别（映射到 Capability）
  ↓
执行策略选择（Auto / Custom）
  ↓
Agent 路由（选 Claude Code 或 Codex）
  ↓
模型路由（通过网关选模型）
  ↓
创建沙盒 → 注入配置 → 调用 CLI
  ↓
可选：审核 / 测试 / 重试
  ↓
销毁沙盒
  ↓
返回结构化结果
```

### 3.2 Strategy 引擎

Strategy 不是描述性文字，是**结构化执行规则**，必须定义每一步的行为和流转条件。

**Strategy 定义格式**：

```yaml
strategy:
  name: write_test_fix
  steps:
    - capability: write_code
      on_fail: abort                     # 代码写不出来直接终止
    - capability: write_tests
      on_fail: abort
    - capability: run_tests
      on_fail: fix_error                 # 测试失败进入修复
    - capability: fix_error
      on_fail: abort                     # 修复也失败，终止
  loop:
    target: run_tests                    # 哪一步可以循环
    max_iterations: 5
    exit_condition: tests_passed         # 退出条件
    exit_conditions:
      - all_steps_passed                 # 所有步骤成功
      - max_iterations_reached           # 达到最大循环次数
```

**内置策略**：

```
single          单步执行（默认）
write_review    写 + 审
write_test_fix  写 + 测 + 修（Loop）
high_quality    写 + 审 + 测（全部 premium tier）
```

**设计约束**：
- 每个 Strategy 必须定义 `steps` + `on_fail`（失败行为）
- Loop 类策略必须定义 `max_iterations` + `exit_condition`
- 不支持任意 DAG，只支持**线性步骤 + 单点循环**（MVP 够用）

### 3.3 Loop 自动迭代

```
while (iteration < max && !abort) {
  1. Worker Agent 执行任务
  2. Shell 验证（npm test / lint）
  3. 验证通过 → 返回结果
  4. 验证失败 → 错误分类 → 按策略处理
}
```

**失败分类与处理**：

| 错误类型 | 识别方式 | 处理策略 |
|---------|---------|---------|
| `syntax_error` | 解析错误 / 编译失败 | retry（同 Agent，错误信息回注） |
| `test_failure` | 测试用例失败 | fix_error → run_tests（修复后重跑） |
| `runtime_error` | 运行时异常 / 超时 | analyze → fix_error |
| `agent_error` | Agent 崩溃 / 输出异常 | retry（重启动 Agent 实例） |
| `timeout` | 单次执行超时 | 升级 tier（economy → standard → premium）或切换 Agent |
| `unknown` | 无法分类 | retry 一次，再失败则终止 |

**升级链**：
```
retry(same agent) → upgrade_tier → switch_agent → abort
```

**控制参数**：
- Shell 验证命令（如 `npm test`）
- Agent 验证（可选，LLM 评审）
- 最大迭代次数（默认 5）
- 单次执行超时（默认 120 秒）
- 总超时（默认 300 秒）

**借鉴来源**：Paseo Loop RPC schema（自建执行引擎）

---

## 四、竞品借鉴

### 4.1 从 Paseo 借鉴

> **Paseo**（https://github.com/getpaseo/paseo）：开源 Agent 调度平台，38 万行 TS monorepo，直接竞品。cli-switch 借鉴其协议层和执行层。

#### 4.1.1 ACP 协议 — P0

- **借鉴了什么**：ACP 完整实现 + 通用/Agent 专用适配器 + 统一类型系统
- **为什么**：已验证的 Agent 通信方案，`generic-acp-agent.ts` 仅 38 行实现一行配置接入
- **源文件**：`acp-agent.ts`（2511 行）、`generic-acp-agent.ts`（38 行）、`claude-agent.ts`（4611 行）、`codex-app-server-agent.ts`（4821 行）、`agent-sdk-types.ts`（550 行）

> 模块对照表和关键设计模式详见 2.1 ACP 协议。

#### 4.1.2 Loop 自动迭代 — P0

- **借鉴了什么**：Loop RPC 消息协议的 Schema 设计（Zod）
- **为什么**：Schema 定义了完整的 Loop 协议（Run/Inspect/Stop/IterationRecord/VerifyCheckResult），cli-switch 在此基础上自建执行引擎并增加失败分类和升级链
- **源文件**：`loop/rpc-schemas.ts`（195 行）
- **cli-switch 怎么用**：基于 schema 自建 Loop 引擎，实现 Worker + Verifier 双角色循环，增加 syntax_error/test_failure/timeout 等失败分类

#### 4.1.3 Agent 生命周期管理 — P0

- **借鉴了什么**：Agent 注册表（Factory + Registry 模式）+ 状态管理（ready/busy/error + TTL 5min 刷新）+ 事件订阅
- **为什么**：已验证的多 Agent 实例管理模式，支持按需创建和状态追踪
- **源文件**：`agent-manager.ts`（3113 行）、`provider-snapshot-manager.ts`（441 行）、`provider-registry.ts`（583 行）
- **cli-switch 怎么用**：PROVIDER_CLIENT_FACTORIES 注册表模式直接搬入，状态刷新通过事件驱动

#### 4.1.4 沙盒 / 环境注入 — P0

- **借鉴了什么**：环境变量 overlay 合并 + 父进程泄漏清除 + 子进程独立环境注入
- **为什么**：Agent 子进程需要独立 API_KEY/BASE_URL/MODEL，且必须清除父进程泄漏的 CLAUDECODE 等环境变量
- **源文件**：`provider-launch-config.ts`（252 行）、`spawn.ts`
- **cli-switch 怎么用**：`createExternalProcessEnv(baseEnv, envOverlay)` 模式直接搬入，加入 tier 解析逻辑

#### 4.1.5 流式输出 + 结构化结果 — P1

- **借鉴了什么**：stdout 流式输出 + Zod 结构化验证 + 跨 Agent 降级链
- **为什么**：Agent 输出需要实时展示 + 最终解析为结构化结果，验证失败时降级到其他 provider
- **源文件**：`agent-response-loop.ts`（453 行）
- **cli-switch 怎么用**：降级链思路直接采用（claude+haiku → codex+mini → fallback），与 cli-switch 的 tier 机制整合

#### 4.1.6 Agent 调 Agent — P1

- **借鉴了什么**：通过 MCP Server 创建工具集，主 Agent 调用子 Agent 完成子任务
- **为什么**：复杂任务需要分解为子任务，子 Agent 上下文隔离避免炸上下文
- **源文件**：`mcp-server.ts`（2136 行）
- **cli-switch 怎么用**：封装在 Strategy 内部，用户不感知，通过 `callerAgentId` 继承 cwd/mode

#### 4.1.7 Git Worktree 隔离 — P2

- **借鉴了什么**：每次 Loop 迭代创建独立 worktree，完成后自动清理
- **为什么**：避免文件冲突，支持并行执行
- **源文件**：`worktree-core.ts`（154 行）、`worktree-session.ts`（753 行）、`worktree-bootstrap.ts`（1009 行）
- **cli-switch 怎么用**：后续迭代接入，MVP 暂不实现

### 4.2 从 Symphony 借鉴

> **Symphony**（https://github.com/openai/symphony）：OpenAI 官方的 Codex 编排工具（Elixir 后端），虽然只绑 Codex，但其编排设计有参考价值。

#### 4.2.1 线性 → Codex 工作流

- **借鉴了什么**：Orchestrator 模式（GenServer poll-tick 驱动）+ Spawn 模式（Task.Supervisor + Process.monitor）+ Solid 模板引擎 + Multi-turn 机制
- **为什么**：Orchestrator 的 reconcile → validate → fetch → sort → dispatch → spawn → monitor 流程是成熟的编排模式；Solid strict templates 避免 prompt 注入
- **cli-switch 怎么用**：Strategy 引擎参考 Orchestrator 的 tick-reconcile 模式，prompt 构建参考 Solid 模板思路

#### 4.2.2 状态仪表盘

- **借鉴了什么**：实时 Agent 状态追踪 + 执行历史记录 + Terminal TUI 渲染 + ObservabilityPubSub 广播
- **为什么**：执行可见性是调试和用户信任的关键
- **cli-switch 怎么用**：对应 cli-switch 的 `decision_trace` + `execution_state`，后续可加 TUI

#### 4.2.3 与 Paseo 的差异

| 维度 | Paseo | Symphony |
|------|-------|----------|
| Agent 支持 | Claude Code + Codex + OpenCode + Aider | 只绑 Codex |
| 通信协议 | ACP（NDJSON over stdio） | 自定义协议 |
| 语言 | TypeScript | Elixir |
| 智能路由 | 无（手动选 Agent） | 无（只有 Codex） |
| Agent 调 Agent | 有（MCP） | 无 |
| Loop | 有（LoopService） | 有（重试机制） |
| Worktree | 有 | 无 |
| UI | 有（Electron App） | 有（Web Dashboard） |

**结论**：cli-switch 的协议层搬 Paseo，编排思路参考 Symphony 的 Orchestrator 模式，两者互补。

### 4.3 cli-switch 自建模块

| 模块 | 说明 |
|------|------|
| 能力识别 | 任务 → Capability 映射（规则引擎），Paseo/Symphony 都没有 |
| 策略引擎 | Strategy 步骤编排 + on_fail 流转 + Loop 控制 + 上下文传递 |
| 沙盒管理 | 环境变量隔离 + 进程生命周期，借鉴 Paseo 但加入 tier 解析 |
| 配置管理 | 全局/项目/任务级三层配置 + tier 抽象，Paseo/Symphony 都没有 |
| Hermes Skill | 封装 CLI 为 Hermes 可调用的 skill，cli-switch 独有 |

### 4.4 从 MetaGPT 借鉴

| 模块 | 说明 |
|------|------|
| Experience Pool | 成功/失败经验自动沉淀，RAG 检索相似场景（后续） |
| Quick Think | 简单问题不进路由，直接回答（后续） |
