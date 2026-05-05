# cli-switch

面向 Agent 和高级 CLI 工作流的多 AI CLI 兼容与运行时编排层。

cli-switch 让 AI Agent（如 OpenClaw）通过统一接口智能调度 Claude Code、Codex CLI、Gemini CLI 等 AI 编程工具，实现自动路由和执行。

## 为什么做它

AI 编程 Agent 生态爆发式增长，但开发者面临：

- **切换成本高**：每个 Agent 命令语法不同，手动切换打断编程心流
- **选型困难**：不同 Agent 在不同场景表现差异大，难以快速判断"这个任务该用哪个"
- **心智负担重**：每个 Agent 独立的配置体系，维护多套配置增加认知开销
- **无法协同**：各 Agent 之间无法接力，一个搞不定只能手动迁移上下文

cli-switch 解决这些问题：**统一入口、智能路由、无缝切换、自动执行**。

## 核心能力

### 智能路由（LLM 驱动）

用户只需描述意图，cli-switch 自动选择最合适的 Agent：

```
cli-switch run "帮我重构这个模块的类型定义"
→ 意图分析：重构 / 多文件 → 路由到 Claude Code
```

路由规则：
| 场景 | Agent | 原因 |
|------|-------|------|
| 长上下文需求 | Claude Code | 200K context |
| 调试任务 | Claude Code | 擅长推理 |
| 测试任务 | Codex CLI | 快速生成 |
| 跨仓库复杂度 | Claude Code | 复杂推理能力 |
| 默认 | Claude Code | 通用 |

### 手动模式

```bash
# 手动指定 Agent
cli-switch run "fix the bug" --agent codex

# 只看路由决策，不执行
cli-switch run "refactor auth" --dry-run

# JSON 输出（给 Agent 用）
cli-switch run "write tests" --json
```

### 静态分析（已有功能）

```bash
# 解析运行时 spec
cli-switch resolve --tool claude-code --model sonnet --json

# 检查认证状态
cli-switch auth status --tool claude-code --json

# 环境诊断
cli-switch env --tool gemini --json

# 综合诊断
cli-switch doctor --tool claude-code --json

# 列出支持的模型/Provider/Profile
cli-switch list models --json
cli-switch list providers --json
cli-switch list profiles --json
```

## 安装

```bash
# 从 GitHub 安装
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install
npm run build

# 全局链接（可选）
npm link
```

## 配置

### 环境变量

```bash
# LLM 意图分析（可选，不设则用规则匹配）
export OPENROUTER_API_KEY=sk-or-v1-xxx

# Agent 认证
export ANTHROPIC_API_KEY=sk-ant-xxx    # Claude Code
export OPENAI_API_KEY=sk-xxx           # Codex CLI
export GEMINI_API_KEY=xxx              # Gemini CLI
```

### 用户覆盖配置

在 `~/.config/cli-switch/registry.override.toml` 中添加自定义模型或 Profile：

```toml
[models.my-model]
alias = "my-model"
resolvedName = "my-model-v1"
family = "custom"
vendor = "my-vendor"
capabilities = ["chat", "code"]
```

## 架构

```
cli-switch run "自然语言指令"
  │
  ├─ Phase 1: 意图理解（Intent Parser）
  │    ├─ 规则模式：关键词匹配（零成本）
  │    └─ LLM 模式：OpenRouter API（可选）
  │
  ├─ Phase 2: 智能路由（Router Engine）
  │    └─ 规则 + 配置 → RoutingDecision
  │
  ├─ Phase 3: Agent 调度（Process Manager）
  │    ├─ spawn 子进程
  │    ├─ 超时保护
  │    ├─ 内存限制
  │    └─ 并发控制
  │
  └─ Phase 4: 结果聚合（Result Builder）
       ├─ 结构化输出
       └─ 失败时建议备选 Agent
```

### 四层架构

1. **CLI Layer**（`cmd/`）— 参数解析与输出渲染
2. **Core Layer**（`src/core/`）— Intent / Router / Dispatcher / Aggregator
3. **Registry + Adapter Layer**（`src/registry/` + `src/adapters/`）— 静态定义 + 工具差异
4. **Platform Layer**（`src/platform/`）— XDG、PATH、环境变量

### Agent 注册表

内置 Agent 定义在 `src/registry/builtins/agents.toml`：

| Agent | 命令 | 模式 | 能力 |
|-------|------|------|------|
| Claude Code | `claude` | single/orchestrator/handoff/review | 长上下文、代码生成、重构、调试、MCP |
| Codex CLI | `codex` | single | 快速生成、代码补全 |
| Gemini CLI | `gemini` | single | 多模态、图片理解 |

## 开发

```bash
# 构建
npm run build

# 开发模式（watch）
npm run dev

# 运行所有测试
npm test

# 运行特定测试
npx vitest run test/unit/dispatcher
npx vitest run test/unit/router
npx vitest run test/unit/intent

# 类型检查
npx tsc --noEmit
```

## 给 Agent 使用的最佳实践

cli-switch 的核心场景是**被其他 AI Agent 调用**：

```bash
# Agent 模式：获取环境变量（零副作用，并发安全）
eval "$(cli-switch env opus4)" && claude -p "任务"

# Agent 模式：智能路由执行
cli-switch run "修复登录页面的 CSS 问题" --json

# Agent 模式：dry-run 获取路由建议
cli-switch run "重构数据库层" --dry-run --json
```

## 支持的 Agent

| Agent | 安装 | 认证方式 |
|-------|------|---------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `npm install -g @anthropic-ai/claude-code` | Login / API Key |
| [Codex CLI](https://github.com/openai/codex) | `npm install -g @openai/codex` | API Key |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `npm install -g @anthropic-ai/claude-code` | API Key |

## 竞品对比

| 功能 | cli-switch | AWS CAO | Claude Squad |
|------|-----------|---------|-------------|
| Agent 能力矩阵 | ✅ 量化评分体系 | ❌ | ❌ |
| 自学习路由 | ✅ 基于历史数据优化 | ❌ | ❌ |
| 性能基准测试 | ✅ 内置 benchmark 套件 | ❌ | ❌ |
| 智能路由（LLM+规则） | ✅ | ✅ | ✅ |
| 多 Agent 编排 | ✅ | ✅ | ✅ |
| 失败自动回退 | ✅ | ❌ | ❌ |
| 代码质量评估 | ✅ LLM 评估 | ❌ | ❌ |
| Git 安全守卫 | ✅ 自动检查点 | ❌ | ❌ |

## 差异化亮点

### Agent 能力矩阵

首次为 AI Agent 建立量化评估体系。每个 Agent 在推理、代码生成、重构、调试、测试、长上下文、速度、多模态等维度获得 0-10 评分。

```bash
# 查看所有 Agent 能力
cli-switch capabilities

# 指定 Agent
cli-switch capabilities --agent codex --json
```

路由时自动根据任务类型加权计算各 Agent 得分，选出最优。

### 自学习路由

基于历史执行数据自动优化 Agent 选择。每次执行后记录结果（成功/失败、耗时、质量评分），当某个 Agent 在同类任务上成功率 >80% 且样本数 ≥5 时，优先推荐。

### 性能基准测试

内置 5 个 benchmark 任务，跨 Agent 对比性能：

```bash
# 全部 Agent
cli-switch benchmark

# 指定 Agent
cli-switch benchmark --agent claude-code --iterations 5

# JSON 输出
cli-switch benchmark --json
```

## License

MIT
