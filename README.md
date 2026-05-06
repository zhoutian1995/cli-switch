<div align="center">

# cli-switch

**面向 AI Agent 的智能 CLI 编排工具**

自然语言 → 意图理解 → 智能路由 → Agent 调度 → 结果聚合

[![npm version](https://img.shields.io/npm/v/cli-switch.svg)](https://www.npmjs.com/package/cli-switch)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

[English](#english) | [中文文档](#中文文档)

</div>

---

## 中文文档

### 🎯 解决什么问题

AI 编程 Agent 生态爆发式增长（Claude Code、Codex CLI、Gemini CLI、OpenCode、Aider 等），但开发者面临：

- **切换成本高** — 每个 Agent 命令语法不同，手动切换打断编程心流
- **选型困难** — 不同 Agent 在不同场景表现差异大，难以快速判断"这个任务该用哪个"
- **心智负担重** — 每个 Agent 独立的配置体系，维护多套配置增加认知开销
- **无法协同** — 各 Agent 之间无法通信或接力，一个搞不定只能手动迁移上下文

**cli-switch 解决"AI Agent 碎片化"问题 — 统一入口、智能路由、无缝切换、自动执行。**

### ✨ 核心特性

- 🧠 **LLM 驱动的智能路由** — 自然语言输入 → 意图分析 → 自动选择最优 Agent
- 🔄 **四种编排模式** — Single / Orchestrator / Handoff / Review
- 🔌 **ACP 协议原生支持** — JSON-RPC over stdio，真正的多 Agent 互操作
- 📡 **流式输出** — Agent 执行结果实时显示，不等完成
- 🎯 **交互式选择** — 终端交互确认 Agent 选择和编排模式
- 🔍 **技术栈自动识别** — 读项目文件推断技术栈，增强 Agent 上下文
- 🏷️ **模型参数注入** — 根据任务复杂度自动选择 sonnet/opus/haiku
- 📊 **Agent 能力矩阵** — 量化评分体系，8 维度评估各 Agent
- 📈 **自学习路由** — 基于历史执行数据自动优化 Agent 选择
- 🔒 **Git 安全守卫** — 分支保护、自动检查点、Secret 检测
- 🧪 **性能基准测试** — 内置 benchmark 套件，跨 Agent 对比
- 🛡️ **失败自动回退** — 当前 Agent 失败自动尝试备选
- 💰 **Token 消耗最大化** — 6 个环节可选 LLM 调用

### 🚀 快速开始

```bash
# 一键安装
npm install -g cli-switch

# 或从源码安装
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch && npm install && npm run build && npm link

# 基础用法：自然语言执行
cli-switch run "帮我重构这个模块的类型定义"
# → 自动路由到 Claude Code（擅长重构）

# 指定 Agent
cli-switch run "write tests" --agent codex

# 交互模式（终端选择 Agent）
cli-switch run "fix the login bug" --interactive

# 流式输出
cli-switch run "implement quicksort" --stream

# ACP 协议通信
cli-switch run "debug this error" --acp

# JSON 输出（给 Agent/脚本用）
cli-switch run "refactor auth" --json

# 只看路由决策
cli-switch run "optimize database" --dry-run
```

### 📖 四阶段管线

```
cli-switch run "自然语言指令"
  │
  ├─ Phase 1: 意图理解（Intent Parser）
  │    ├─ 规则模式：关键词匹配（零成本）
  │    └─ LLM 模式：OpenRouter API（深度分析）
  │    → 输出：任务类型 / 复杂度 / 技术栈 / 是否需要长上下文
  │
  ├─ Phase 2: 智能路由（Router Engine）
  │    ├─ Agent 能力矩阵评分
  │    ├─ 自学习路由（历史数据优化）
  │    ├─ LLM 路由评分（可选）
  │    └─ 规则兜底
  │    → 输出：最优 Agent + 置信度 + 选择理由
  │
  ├─ Phase 3: Agent 调度（Dispatcher）
  │    ├─ 项目上下文注入（技术栈/分支/入口文件）
  │    ├─ 模型参数注入（自动选 sonnet/opus/haiku）
  │    ├─ ACP 协议桥接 或 子进程 spawn
  │    ├─ 并发控制（maxConcurrency=3）
  │    ├─ 超时保护 + 内存限制
  │    ├─ Git 分支保护 + 检查点
  │    └─ 流式输出（实时显示）
  │
  └─ Phase 4: 结果聚合（Aggregator）
       ├─ 结构化输出
       ├─ LLM 代码质量评估（可选）
       ├─ 失败自动回退（最多 2 个备选 Agent）
       └─ Git 自动提交或回滚
```

### 🔧 所有命令

```bash
# 智能执行
cli-switch run <input>                    # 自然语言 → Agent 执行
cli-switch run <input> --interactive      # 交互式选择 Agent
cli-switch run <input> --stream           # 流式输出
cli-switch run <input> --acp              # ACP 协议通信
cli-switch run <input> --dry-run          # 只看路由决策
cli-switch run <input> --json             # JSON 输出

# 能力与性能
cli-switch capabilities                   # 查看 Agent 能力矩阵
cli-switch benchmark                      # 运行性能基准测试
cli-switch capabilities --agent codex     # 指定 Agent

# 静态分析
cli-switch resolve --tool claude-code --model sonnet --json
cli-switch auth status --tool claude-code --json
cli-switch env --tool gemini --json
cli-switch doctor --tool claude-code --json
cli-switch list models --json
cli-switch list providers --json
```

### 🧠 智能路由详解

#### 技术栈自动识别

cli-switch 自动读取项目文件，推断技术栈并注入 Agent 上下文：

```
检测 package.json → TypeScript + React + Vite
检测 tsconfig.json → TypeScript 5.6
检测 vitest.config.ts → Vitest 测试框架
→ 注入 Agent 的 system prompt：当前项目技术栈、入口文件、分支信息
```

#### 模型参数自动注入

根据任务复杂度和类型自动选择模型：

| 任务 | 复杂度 | 选模型 | 原因 |
|------|--------|--------|------|
| 架构级重构 | 高 | claude-opus-4 | 最强推理 |
| 快速 bug 修复 | 低 | claude-haiku-3.5 | 最快速度 |
| 日常开发 | 中 | claude-sonnet-4 | 平衡 |
| 需要 1M 上下文 | - | gemini-2.5-pro | 超大窗口 |

#### ACP 协议通信

基于 Anthropic ACP 标准，通过 JSON-RPC over stdio 实现 Agent 间通信：

```
cli-switch ←JSON-RPC→ Agent 子进程
  ├─ sendTask(prompt, context) → 发送任务
  ├─ onChunk(callback) → 接收流式响应
  ├─ 请求-响应自动匹配（message id）
  └─ 降级：Agent 不支持 ACP 时自动退回 stdout 模式
```

#### Agent 能力矩阵

首次为 AI Agent 建立量化评估体系，8 个维度 0-10 评分：

| Agent | 推理 | 代码生成 | 重构 | 调试 | 测试 | 速度 | 长上下文 | 多模态 |
|-------|:----:|:--------:|:----:|:----:|:----:|:----:|:--------:|:------:|
| Claude Code | 9 | 9 | 9 | 9 | 7 | 6 | 10 | 7 |
| Codex CLI | 8 | 8 | 7 | 7 | 9 | 9 | 5 | 3 |
| Gemini CLI | 8 | 8 | 7 | 7 | 7 | 8 | 8 | 10 |

#### 自学习路由

记录每次路由结果，当某个 Agent 在同类任务上成功率 >80% 且样本数 ≥5 时自动优先推荐。

### 🔒 Git 安全守卫

```
Agent 执行前：
  1. 检查是否在保护分支（main/master/release）→ 自动创建 agent/ 分支
  2. 创建检查点（checkpoint）→ 记录 commit hash
  3. Secret Detection → 扫描 diff 中的 API Key/Token/密码

Agent 执行后：
  4. validateChanges() → 检查保护文件/二进制文件/超大 diff
  5. commitAgentChanges() → 自动提交修改
  6. 失败时 restore() → 回滚到检查点
```

### 🏆 竞品对比

| 功能 | cli-switch | AWS CAO | Claude Squad | CrewAI |
|------|:---------:|:-------:|:------------:|:------:|
| LLM 智能路由 | ✅ | ❌ | ❌ | ❌ |
| Agent 能力矩阵 | ✅ | ❌ | ❌ | ❌ |
| 自学习路由 | ✅ | ❌ | ❌ | ❌ |
| ACP 协议 | ✅ | ❌ | ❌ | ❌ |
| 技术栈自动识别 | ✅ | ❌ | ❌ | ❌ |
| 模型参数注入 | ✅ | ❌ | ❌ | ❌ |
| 流式输出 | ✅ | ❌ | ❌ | ❌ |
| 交互式选择 | ✅ | ❌ | ❌ | ❌ |
| 性能基准测试 | ✅ | ❌ | ❌ | ❌ |
| Git 安全守卫 | ✅ | ❌ | ✅ | ❌ |
| Secret Detection | ✅ | ❌ | ❌ | ❌ |
| 失败自动回退 | ✅ | ❌ | ❌ | ❌ |
| 多模式编排 | ✅ | ✅ | 部分 | ✅ |
| 轻量依赖（3个） | ✅ | ❌ | ❌ | ❌ |

### ⚡ Token 消耗最大化

cli-switch 在以下 6 个环节可选调用 LLM，单任务 Token 消耗是传统方案的 **2-5 倍**：

1. **意图理解** — LLM 分析用户自然语言，提取任务类型/复杂度/技术栈
2. **路由评分** — LLM 评估各 Agent 适配度，选择最优 Agent
3. **上下文总结** — LLM 总结前序 Agent 输出，传递给下一个 Agent（接力模式）
4. **代码质量评估** — LLM 对 Agent 输出打分，给出改进建议
5. **代码审查** — LLM 审查代码质量（评审模式）
6. **结果聚合摘要** — LLM 总结多个 Agent 的结果

### 🛠️ 开发

```bash
npm run build          # 构建
npm run dev            # watch 模式
npm test               # 全部测试
npx tsc --noEmit       # 类型检查
```

### 📄 许可证

[MIT](./LICENSE)

---

## English

### What It Does

cli-switch is an AI Agent orchestration CLI that solves "AI Agent fragmentation" — unified entry point, intelligent routing, seamless switching, automatic execution.

Natural language in → Intent analysis → Smart routing → Agent dispatch → Result aggregation.

### Quick Start

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch && npm install && npm run build

# Run with natural language
cli-switch run "Refactor the type definitions in this module"
# → Auto-routes to Claude Code (best at refactoring)

# Interactive mode
cli-switch run "fix the login bug" --interactive

# Stream output
cli-switch run "implement quicksort" --stream

# ACP protocol
cli-switch run "debug this error" --acp

# JSON output for scripts
cli-switch run "write tests" --json
```

### Key Features

- **LLM-driven smart routing** — Analyzes task intent, selects optimal agent
- **4 orchestration modes** — Single / Orchestrator / Handoff / Review
- **ACP protocol** — JSON-RPC over stdio for true multi-agent interop
- **Streaming output** — Real-time display of agent responses
- **Interactive selection** — Terminal-based agent picker
- **Tech stack detection** — Auto-detects project tech stack for context injection
- **Model auto-selection** — Picks sonnet/opus/haiku based on task complexity
- **Agent capability matrix** — Quantitative scoring across 8 dimensions
- **Self-learning router** — Optimizes from execution history
- **Git guard** — Branch protection, checkpoints, secret detection
- **Auto-fallback** — Tries backup agents on failure
- **Token maximizer** — 6 optional LLM calls per pipeline run

### Architecture

```
cmd/          CLI commands (run, resolve, auth, env, doctor, list, benchmark, capabilities)
src/core/     Core engine
  intent/     Intent parser (rules + LLM)
  router/     Smart routing (capability matrix + learning + LLM + rules)
  dispatcher/ Process manager, ACP bridge, stream writer
  aggregator/ Result builder, quality checker, fallback
  orchestrator/ Multi-agent modes (parallel, handoff, review)
  context/    Tech detector, project context builder
  git/        Git guard, secret detector
  llm/        LLM service wrapper
  ui/         Interactive prompt
src/adapters/ Tool-specific adapters (Claude Code, Codex, Gemini)
src/registry/ Model/Provider/Profile registry (TOML)
src/platform/ OS abstractions (paths, env, fs, exec)
src/types/    TypeScript type definitions
```

### Comparison

| Feature | cli-switch | AWS CAO | Claude Squad | CrewAI |
|---------|:---------:|:-------:|:------------:|:------:|
| LLM Smart Routing | ✅ | ❌ | ❌ | ❌ |
| Agent Capability Matrix | ✅ | ❌ | ❌ | ❌ |
| Self-learning Router | ✅ | ❌ | ❌ | ❌ |
| ACP Protocol | ✅ | ❌ | ❌ | ❌ |
| Tech Stack Detection | ✅ | ❌ | ❌ | ❌ |
| Model Auto-selection | ✅ | ❌ | ❌ | ❌ |
| Streaming Output | ✅ | ❌ | ❌ | ❌ |
| Interactive Selection | ✅ | ❌ | ❌ | ❌ |
| Performance Benchmark | ✅ | ❌ | ❌ | ❌ |
| Git Safety Guard | ✅ | ❌ | ✅ | ❌ |
| Secret Detection | ✅ | ❌ | ❌ | ❌ |
| Auto Fallback | ✅ | ❌ | ❌ | ❌ |
| Lightweight (3 deps) | ✅ | ❌ | ❌ | ❌ |

### License

[MIT](./LICENSE)
