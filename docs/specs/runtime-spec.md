# Runtime Spec — 运行时规格

> **定位**：本文档定义 cli-switch 执行引擎的运行时行为规格，包括 JSON Schema、错误码体系、Context Policy、Output Validation 和 Agent Input Contract。
>
> **上游**：[PRD.md](../PRD.md)（四、核心功能 + 九、错误码）
>
> **下游**：实现层的执行引擎、策略引擎、校验模块
>
> **关系**：本 spec 是 PRD 运行时相关章节的结构化提取和细化，为架构设计和编码提供精确的数据结构定义。

---

## 1. JSON Schema 定义

### 1.1 Output Validation Schema

按 Capability 定义的核心输出字段。所有 Capability 必须包含 `status` 和 `summary`。

```yaml
# 通用 required 字段（所有 Capability 必须有）
required_fields:
  - status          # "success" | "failed"
  - summary         # string，人类可读的执行摘要

# 按 Capability 定义的 required 字段
required_by_capability:
  write_code:
    - files_changed    # string[] — 修改或新创建的文件路径列表
    - diff             # string — unified diff 格式
  write_tests:
    - test_files_created  # string[] — 创建的测试文件路径列表
  run_tests:
    - test_result        # { status: "pass"|"fail", output: string }
  review_code:
    - review_report      # { verdict: "pass"|"reject", comments: string[] }
  fix_error:
    - files_changed      # string[] — 修改的文件路径列表
    - diff               # string — unified diff 格式
  refactor:
    - files_changed      # string[]
    - diff               # string
    - test_validation    # { status: "pass"|"fail", output?: string }
  analyze:
    - analysis_report    # { root_cause: string, suggestion: string }
  explain:
    - explanation_text   # string — 解释/分析文本
```

**校验配置**：

```yaml
output_validation:
  schema:
    engine: zod                     # Zod schema 定义每个 Capability 的 output 结构
    strict: false                   # 允许额外字段（Agent 经常多输出 reasoning/confidence 等）
    strip_unknown_fields: true      # 多余字段无声丢弃，不影响校验
    required_fields:
      - status
      - summary
    required_by_capability:
      write_code: [files_changed, diff]
      write_tests: [test_files_created]
      run_tests: [test_result]
      review_code: [review_report]
      fix_error: [files_changed, diff]
      refactor: [files_changed, diff, test_validation]
      analyze: [analysis_report]
      explain: [explanation_text]
    on_invalid:
      action: auto_repair           # auto_repair | retry | fail
      max_repair_attempts: 2

  # 第二层：语义校验（写操作必须通过）
  semantic:
    diff_validator:
      parse_check: true             # diff 能否被 unified diff parser 解析
      path_check: true              # diff 中的文件路径是否在 target_files 白名单内
      on_invalid: auto_repair       # 解析失败自动修复
```

### 1.2 Execution State 完整 JSON Schema

Strategy 执行过程中维护的全局执行状态，所有步骤共享读写。

```json
{
  "$schema": "execution_state",
  "type": "object",
  "required": ["strategy_name", "current_step", "current_capability", "total_steps"],
  "properties": {
    "strategy_name": {
      "type": "string",
      "description": "当前执行的策略名称"
    },
    "current_step": {
      "type": "integer",
      "minimum": 1,
      "description": "当前执行到第几步（1-indexed）"
    },
    "current_capability": {
      "type": "string",
      "enum": ["write_code", "write_tests", "run_tests", "review_code", "fix_error", "refactor", "analyze", "explain"],
      "description": "当前执行的 Capability"
    },
    "total_steps": {
      "type": "integer",
      "description": "策略总步骤数"
    },

    "iteration": {
      "type": "integer",
      "default": 1,
      "description": "当前第几轮（Loop 场景）"
    },
    "max_iterations": {
      "type": "integer",
      "default": 5,
      "description": "Loop 最大迭代次数"
    },

    "history": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["step", "capability", "status"],
        "properties": {
          "step": { "type": "integer" },
          "capability": { "type": "string" },
          "status": { "type": "string", "enum": ["success", "failed"] },
          "output": { "type": "object" },
          "tokens_used": { "type": "integer" },
          "duration_ms": { "type": "integer" }
        }
      },
      "description": "所有步骤的执行记录（裁剪后的）"
    },

    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["step", "error_type"],
        "properties": {
          "step": { "type": "integer" },
          "capability": { "type": "string" },
          "iteration": { "type": "integer" },
          "error_type": {
            "type": "string",
            "enum": ["syntax_error", "test_failure", "runtime_error", "agent_error", "timeout", "unknown"]
          },
          "error_output": { "type": "string" },
          "repair_action": { "type": "string" }
        }
      },
      "description": "错误累积记录"
    },

    "total_tokens_used": {
      "type": "integer",
      "default": 0,
      "description": "累计 token 消耗"
    },
    "total_duration_ms": {
      "type": "integer",
      "default": 0,
      "description": "累计执行时长（毫秒）"
    },
    "start_time": {
      "type": "string",
      "format": "date-time",
      "description": "策略执行开始时间（ISO 8601）"
    }
  }
}
```

**写入时机**：

| 事件 | 写入内容 |
|------|---------|
| 每步执行前 | 更新 `current_step` / `current_capability` |
| 每步执行后 | 追加 `history[]` + 更新资源计数 |
| 错误发生时 | 追加 `errors[]` |
| Loop 回注时 | `iteration++` + 裁剪旧 history（遵循 context_policy） |

### 1.3 Result Output JSON Schema（含 decision_trace）

cli-switch 对外返回的统一结果结构。

```json
{
  "$schema": "result_output",
  "type": "object",
  "required": ["status", "summary", "strategy", "agent", "tier", "decision_trace"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["success", "failed"],
      "description": "最终执行结果"
    },
    "summary": {
      "type": "string",
      "description": "执行摘要（人类可读）"
    },
    "files_changed": {
      "type": "array",
      "items": { "type": "string" },
      "description": "修改/创建的文件路径列表"
    },
    "diff": {
      "type": "string",
      "description": "unified diff 内容"
    },
    "errors": {
      "type": "array",
      "items": { "type": "object" },
      "description": "错误详情列表"
    },
    "iterations": {
      "type": "integer",
      "description": "总迭代次数（Loop 场景）"
    },
    "strategy": {
      "type": "string",
      "description": "执行的策略名称"
    },
    "agent": {
      "type": "string",
      "enum": ["claude-code", "codex"],
      "description": "最终执行的 Agent"
    },
    "tier": {
      "type": "string",
      "enum": ["economy", "standard", "premium"],
      "description": "最终使用的模型 tier"
    },
    "model": {
      "type": "string",
      "description": "网关返回的实际模型名"
    },
    "decision_trace": {
      "type": "object",
      "required": ["capability", "strategy", "agent_reason", "model_reason"],
      "properties": {
        "capability": {
          "type": "string",
          "description": "识别出的能力类型"
        },
        "strategy": {
          "type": "string",
          "description": "选择的策略名称"
        },
        "agent_reason": {
          "type": "string",
          "description": "选择此 Agent 的理由"
        },
        "model_reason": {
          "type": "string",
          "description": "选择此 tier 的理由"
        },
        "loop_iterations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "iteration": { "type": "integer" },
              "step": { "type": "string" },
              "result": { "type": "string", "enum": ["passed", "failed"] },
              "error_type": { "type": "string" }
            }
          },
          "description": "Loop 每次迭代的决策记录"
        }
      },
      "description": "决策追溯 — 为什么选这个 Agent / 模型 / 策略"
    }
  }
}
```

**decision_trace 数据源**：从 `execution_state.history` 生成。

**decision_trace 的作用**：
- 用户能看懂**为什么选这个 Agent / 模型**
- Loop 过程可追溯，每次迭代有明确结果
- 方便后续 Experience Pool 自动学习

---

## 2. 错误码体系

### 2.1 错误类型分类

| 错误类型 | 识别方式 | 处理策略 |
|---------|---------|---------|
| `syntax_error` | 解析错误 / 编译失败 | retry（同 Agent，错误信息回注） |
| `test_failure` | 测试用例失败 | fix_error → run_tests（修复后重跑） |
| `runtime_error` | 运行时异常 / 超时 | analyze → fix_error |
| `agent_error` | Agent 崩溃 / 输出异常 | retry（重启动 Agent 实例） |
| `timeout` | 单次执行超时 | 升级 tier（economy → standard → premium）或切换 Agent |
| `unknown` | 无法分类 | retry 一次，再失败则终止 |

### 2.2 错误处理升级链

```
retry(same agent) → upgrade_tier → switch_agent → abort
```

详细说明：

| 阶段 | 行为 | 触发条件 |
|------|------|---------|
| **retry** | 同一 Agent 重试，错误信息回注 prompt | `syntax_error` / `agent_error` / `unknown`（首次） |
| **upgrade_tier** | 提升 tier 等级重试 | `timeout`；或同一 Agent retry 后仍失败 |
| **switch_agent** | 切换到另一 Agent 重试 | upgrade_tier 后仍失败 |
| **abort** | 终止执行，返回错误详情 | 所有手段耗尽（达到 max_repair_attempts / max_iterations） |

### 2.3 错误码列表

| 错误场景 | 错误类型 | 默认处理 | 备注 |
|---------|---------|---------|------|
| 编译失败 | `syntax_error` | retry | 回注编译错误信息 |
| 测试用例失败 | `test_failure` | fix_error → run_tests | 触发 Loop 修复流程 |
| 运行时异常 | `runtime_error` | analyze → fix_error | 先分析再修复 |
| Agent 进程崩溃 | `agent_error` | retry | 重启 Agent 实例 |
| Agent 输出解析失败 | `agent_error` | auto_repair → retry | output_validation 流程处理 |
| 单次执行超时 | `timeout` | upgrade_tier → retry | tier 升级：economy → standard → premium |
| 总执行超时 | `timeout` | abort | 不可恢复 |
| 无法识别的错误 | `unknown` | retry → abort | retry 一次，再失败终止 |
| Schema 校验失败 | `agent_error` | auto_repair | max_repair_attempts: 2 |
| Diff 语义校验失败 | `agent_error` | auto_repair | diff_validator 处理 |

### 2.4 控制参数

| 参数 | 默认值 | 说明 |
|------|-------|------|
| max_repair_attempts | 2 | 单步最大 auto_repair 次数 |
| max_iterations | 5 | Loop 最大迭代次数 |
| single_timeout | 120s | 单次执行超时 |
| total_timeout | 300s | 总执行超时 |

---

## 3. Context Policy

### 3.1 完整配置

```yaml
context_policy:
  max_tokens: 8000                       # 单步 input.context 最大 token 数（MVP 固定，后续支持用户配置）
  strategy: truncate                     # truncate | summarize（超限处理策略）
  truncate_order:                        # 超限时裁剪优先级（从高到低保留）
    1: last_step_output                  # 最近一步的完整 output（必须保留）
    2: error_output                      # 最近一次错误信息（必须保留）
    3: summaries                         # 所有历史步骤的 summary
    4: target_files                      # 涉及的文件列表
    5: diff                              # diff 内容（最可能超长，优先裁剪）
  loop_history:
    max_iterations_kept: 3               # Loop 只保留最近 3 轮的完整 context
    older_than: summarize                # 更早的轮次只保留 summary
```

### 3.2 truncate_order 说明

当 `input.context` 超出 `max_tokens` 时，按 `truncate_order` 从**低到高**（5 → 4 → 3）裁剪：
- 优先裁剪 `diff`（最可能超长）
- 其次裁剪 `target_files`
- 再裁剪旧轮次的 `summaries`
- `last_step_output` 和 `error_output` **必须保留**，不参与裁剪

### 3.3 loop_history 策略

| 场景 | 行为 |
|------|------|
| Loop 迭代 ≤ `max_iterations_kept` | 保留所有轮次的完整 context |
| Loop 迭代 > `max_iterations_kept` | 只保留最近 3 轮完整 context，更早轮次只保留一行 summary |

### 3.4 execution_state_policy（裁剪策略）

长 Loop 场景下 `execution_state.history` / `execution_state.errors` 会持续增长，必须裁剪：

```yaml
execution_state_policy:
  max_history_steps: 10                  # 超过只保留最近 10 步完整记录
  max_errors: 5                          # 超过只保留最近 5 个错误
  older_than: summarize                  # 超出部分的完整记录压缩为一行 summary
```

**裁剪规则**：
- history 超过 10 步时，旧步骤只保留 `{step, capability, status, summary}`，丢弃完整 output
- errors 超过 5 个时，旧错误只保留 `{error_type, step, iteration}`，丢弃 error_output
- `total_tokens_used` / `total_duration_ms` **始终保留**（累计值，不裁剪）
- 与 `context_policy.loop_history.max_iterations_kept: 3` 对齐——context 只传最近 3 轮，history 保留最近 10 步

### 3.5 默认传递规则

```
上一步 output → 下一步 input.context（自动合并）
失败时：失败步骤的 output → fix_error 的 input.error_output
Loop 回注：验证失败的 error_output → 下一轮的 input.context
```

### 3.6 可选显式映射（覆盖默认）

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

---

## 4. Output Validation

### 4.1 stdout_preprocessor 完整配置

```yaml
stdout_preprocessor:
  # 第一遍：物理清洗
  strip_ansi: true                       # 去掉 ANSI 转义码（颜色、光标等）
  strip_carriage_return: true            # 统一换行符
  trim_whitespace: true                  # 去首尾空白

  # 第二遍：结构提取
  extract_strategy: greedy              # greedy | first_match | largest_block
  extractors:
    - type: unified_diff                # 提取 --- a/ ... +++ b/ ... @@ 块
      pattern: "^--- a/.+\\n\\+\\+\\+ b/.+\\n@@"
    - type: json_block                  # 提取 { ... } JSON 块
      pattern: "\\{[\\s\\S]*\\}$"
    - type: code_block                  # 提取 ```lang ... ``` 块
      pattern: "```[a-z]+\\n[\\s\\S]*?\\n```"

  # 第三遍：噪音检测
  noise_patterns:
    - "^(Sure|好的|I'll|Let me|Here is)"  # Agent 常见开头废话
    - "(Done|完成|Hope this helps)"       # Agent 常见结尾废话
  noise_action: strip                   # strip | keep
```

**核心约束**：
- stdout 预处理在 schema 校验**之前**执行，是必经步骤
- 提取策略 `greedy`：从 stdout 中找到最大的匹配块（优先 diff > json > code_block）
- 提取失败（找不到任何匹配块）→ 整段 stdout 作为 context 发给 auto_repair
- 预处理器不修改 stdout 原文，输出清洗后的副本

### 4.2 Schema 校验规则

```yaml
output_validation:
  schema:
    engine: zod
    strict: false
    strip_unknown_fields: true
    required_fields: [status, summary]
    required_by_capability:
      write_code: [files_changed, diff]
      write_tests: [test_files_created]
      run_tests: [test_result]
      review_code: [review_report]
      fix_error: [files_changed, diff]
      refactor: [files_changed, diff, test_validation]
      analyze: [analysis_report]
      explain: [explanation_text]
    on_invalid:
      action: auto_repair
      max_repair_attempts: 2
```

**校验失败处理差异**：

| 操作类型 | 校验失败行为 |
|---------|------------|
| 读操作（explain / analyze） | retry 一次 → 失败则返回原文 + 警告 |
| 写操作（write_code / fix_error） | auto_repair → 再失败则 abort |

### 4.3 Semantic 校验规则（diff_validator）

```yaml
semantic:
  diff_validator:
    parse_check: true                 # diff 能否被 unified diff parser 解析
    path_check: true                  # diff 中的文件路径是否在 target_files 白名单内
    on_invalid: auto_repair           # 解析失败自动修复
```

### 4.4 Diff auto-repair 流程

高频场景：Agent 输出不规范 diff。

```
1. 尝试标准 unified diff 解析
2. 失败 → 检测是否为代码块格式（```typescript ... ```）
   成功 → 提取代码块，按文件路径构造 diff
3. 失败 → 检测是否为完整文件内容（无 hunk header）
   成功 → 与原始文件对比，生成 diff
4. 失败 → 用同一 Agent 修复（它刚看过原始文件，上下文最完整）
   发送：raw output + 原始文件 + "请输出标准 unified diff 格式"
5. 失败 → 降级到 standard tier 模型修复
6. 再失败 → retry 当前步骤（重头来，最多 2 次）
```

### 4.5 修复模型降级链

```
同一 Agent（免费，有完整上下文）→ standard tier → retry 当前步骤 → abort
```

> **注意**：economy tier 模型不参与 diff 修复——指令遵循精度不够，容易越修越乱。

---

## 5. Agent Input Contract

Agent 不知道 Capability 的存在。cli-switch 将 Capability 的 input/output 转换为标准 prompt 结构后发送给 Agent。

### 5.1 agent_input prompt 结构

```yaml
# cli-switch 内部构建，Agent 实际收到的 prompt
agent_input:
  system_prompt: |
    You are a code modification agent. Modify the target files to complete the task.
    Only modify the specified files. Produce a unified diff as output.
  task: "实现用户登录功能"
  target_files: ["src/auth/login.ts", "src/auth/session.ts"]
  context: |
    ## 前序步骤产出
    - 修改文件：src/auth/login.ts
    - Diff 摘要：新增 login() 函数
  expected_output_format: |
    Respond with a unified diff in the following format:
    --- a/file.ts
    +++ b/file.ts
    @@ -1,3 +1,4 @@
    ...
  constraints:
    file_access: whitelist            # 只能改 task 中列出的文件
    output_format: diff               # 必须输出 diff
    readonly_files: ["package.json"] # 这些文件只读
```

### 5.2 constraints 结构

```yaml
constraints:
  file_access:                        # 文件访问控制
    mode: whitelist                   # whitelist | project_dir
    target_files: []                  # 允许访问的文件列表
    readonly_files: []                # 只读文件列表
  output_format:                      # 期望的输出格式
    type: string                      # "diff" | "json" | "text"
    schema?: object                   # 可选的输出 schema 定义
```

### 5.3 expected_output_format

按 Capability 类型不同，`expected_output_format` 会包含对应的格式说明和示例：

| Capability | expected_output_format |
|-----------|----------------------|
| write_code | unified diff 格式 + 文件路径 |
| write_tests | 测试文件路径 + 测试代码 |
| run_tests | 测试结果 JSON |
| review_code | 审查报告 JSON（verdict + comments） |
| fix_error | unified diff 格式 + 修复说明 |
| refactor | unified diff 格式 + 变更说明 |
| analyze | 分析报告 JSON（root_cause + suggestion） |
| explain | 纯文本解释 |

### 5.4 核心约束

- 所有 Agent（Claude Code / Codex）收到**相同的 prompt 结构**，只有 system_prompt 按 Capability 不同
- `expected_output_format` 强制 Agent 输出 cli-switch 可解析的结构化格式
- Agent 不知道自己在执行哪个 Capability，也不知道前后还有其他步骤
- 任何进入下一步的数据必须经过 schema 校验，不信任 Agent 的原始输出
