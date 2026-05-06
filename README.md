# cli-switch

AI Agent 编排 CLI — 智能路由、多 Agent 调度、结构化输出。

一句话：`cli-switch run "帮你重构这个模块" → 自动选 Agent → 执行 → 返回结果`

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-196%20passed-green.svg)](https://github.com/zhoutian1995/cli-switch)

## 安装

```bash
npm install -g cli-switch
```

从源码：

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install && npm run build && npm link
```

## 快速上手

```bash
# 自然语言执行 — 自动选择最合适的 Agent
cli-switch run "帮我重构这个模块的类型定义"

# 指定 Agent
cli-switch run "write tests" --agent codex

# 交互模式 — 终端选择 Agent 和编排模式
cli-switch run "fix the login bug" --interactive

# 只看路由决策，不执行
cli-switch run "optimize database" --dry-run

# JSON 输出（给脚本/Agent 用）
cli-switch run "refactor auth" --json

# 流式输出
cli-switch run "implement quicksort" --stream

# ACP 协议通信
cli-switch run "debug this error" --acp
```

## 所有命令

### run — 智能执行

```bash
cli-switch run <任务描述> [选项]

选项：
  --mode <mode>         编排模式: single | orchestrator | handoff | review
  --agent <agent>       指定 Agent: claude-code | codex | gemini | opencode | aider
  --dry-run             只看路由决策
  --interactive, -i     交互式选择
  --stream              流式输出（默认开启）
  --no-stream           关闭流式输出
  --acp                 使用 ACP 协议
  --json                JSON 输出
  --timeout <秒>        超时时间（默认 120 秒）
  --reviewer <agent>    评审模式指定审查 Agent
  --no-git              跳过 Git 分支管理
  --rollback            失败时自动回滚
```

### 静态分析命令

```bash
cli-switch resolve --tool <工具> --model <模型> --json   # 解析运行时 spec
cli-switch auth status --tool <工具> --json               # 检查认证状态
cli-switch env --tool <工具> --json                       # 查看环境配置
cli-switch doctor --tool <工具> --json                    # 综合诊断
cli-switch list models [--tool <工具>] --json              # 列出支持的模型
cli-switch list providers --json                          # 列出支持的提供商
cli-switch list profiles --json                           # 列出运行配置
```

### 其他

```bash
cli-switch capabilities [--agent <agent>]    # Agent 能力矩阵
cli-switch benchmark                         # 性能基准测试
cli-switch --version                         # 版本号
cli-switch --help                            # 帮助
```

## 工作原理

```
cli-switch run "任务描述"
  │
  ├─ 1. 意图解析 — 分析任务类型、复杂度、技术栈需求
  │     └─ 规则匹配（零成本）或 LLM 分析（需 OPENROUTER_API_KEY）
  │
  ├─ 2. 智能路由 — 评估各 Agent 适配度，选最优 Agent
  │     └─ 能力矩阵评分 + 历史数据 + 规则兜底
  │
  ├─ 3. Agent 调度 — 执行任务
  │     ├─ 自动检测项目技术栈，注入上下文
  │     ├─ 根据复杂度自动选模型（opus/sonnet/haiku）
  │     ├─ 并发控制（最多 3 个并行）+ 超时保护
  │     ├─ Git 分支保护 + 检查点 + Secret 检测
  │     └─ 流式实时输出
  │
  └─ 4. 结果聚合 — 结构化输出
        ├─ 失败自动回退（最多尝试 2 个备选 Agent）
        └─ Git 自动提交或回滚
```

## 支持的 Agent

| Agent | 命令 | 擅长 |
|-------|------|------|
| Claude Code | `claude` | 重构、调试、长上下文（200K） |
| Codex CLI | `codex` | 测试生成、快速执行 |
| Gemini CLI | `gemini` | 多模态、超长上下文（1M） |
| OpenCode | `opencode` | 通用开发 |
| Aider | `aider` | 代码补全 |

## 编排模式

- **single** — 单 Agent 执行（默认）
- **orchestrator** — 多 Agent 并行，各自独立完成同一任务
- **handoff** — 链式接力，前一个 Agent 的输出传给下一个
- **review** — 代码 + 审查，一个 Agent 写代码，另一个审查

## 项目结构

```
cmd/              CLI 命令入口
src/core/
  intent/         意图解析
  router/         智能路由（能力矩阵 + 自学习 + LLM）
  dispatcher/     进程管理、ACP 协议桥接、流式输出
  aggregator/     结果聚合、质量评估、失败回退
  orchestrator/   多 Agent 编排
  context/        技术栈检测、项目上下文
  git/            Git 守卫、Secret 检测
  llm/            LLM 服务
  ui/             交互式提示
src/adapters/     Agent 适配器（Claude Code / Codex / Gemini）
src/registry/     模型/Provider/Profile 注册表（TOML）
src/platform/     平台抽象（路径、环境、文件系统）
src/types/        TypeScript 类型定义
schema/           JSON Schema
test/             测试（单元、契约、E2E、压力）
```

## 开发

```bash
npm run build          # 构建
npm run dev            # watch 模式
npm test               # 全部测试（196 个）
npm run smoke          # 安装后验证测试（9 个）
npm run lint           # 类型检查
```

## 前置依赖

- Node.js >= 18.0.0
- 需要至少一个 AI CLI 已安装：`claude` / `codex` / `gemini`
- LLM 路由需要设置 `OPENROUTER_API_KEY`（可选，不设则用规则路由）

## 许可证

[MIT](./LICENSE)
