# cli-switch

**AI Agent Capability Router for coding CLIs.**

[![npm version](https://img.shields.io/npm/v/cli-switch.svg)](https://www.npmjs.com/package/cli-switch)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

`cli-switch` is a command-line orchestration layer for AI coding agents. It
routes a task to the right agent, injects gateway credentials, chooses model
tiers, isolates the child process environment, and returns text or JSON output
that scripts and higher-level agents can consume.

Current release: `cli-switch@1.0.0`

## Languages

- [English](#english)
- [中文](#中文)
- [日本語](#日本語)
- [한국어](#한국어)

---

## English

### What It Is

Modern coding agents are powerful, but every CLI has different authentication,
model flags, environment variables, strengths, and failure modes. `cli-switch`
adds a routing layer above those tools:

```text
task
  -> intent and capability detection
  -> agent and tier selection
  -> gateway credential injection
  -> sandboxed child process execution
  -> text or JSON result
```

It is designed for developers, automation scripts, and agent frameworks that
need one stable interface for multiple coding agents.

### What You Can Use It For

- Route coding tasks between Claude Code and Codex CLI.
- Use one gateway or self-hosted relay API key across supported agents.
- Reuse OpenRouter-style keys without changing each agent's global config.
- Run dry-run routing decisions before spending model tokens.
- Build higher-level agent workflows that need stable JSON output.
- Dispatch review, test-writing, refactor, explain, analysis, and fix tasks.
- Keep parent session variables out of child agent processes.
- Inspect local agent readiness with diagnostics and auth checks.
- Define reusable skill workflows with prompt templates.
- Run agents in isolated worktrees or temp copies without touching the real project.

### Good Fit

| Scenario | Why `cli-switch` helps |
| --- | --- |
| Multi-agent coding workflow | Select Claude Code or Codex per task instead of hard-coding one tool. |
| Self-hosted LLM relay | Map relay credentials into agent-native env variables automatically. |
| Agent framework integration | Use `--json`, `--dry-run`, and stable command surfaces. |
| Cost and quality routing | Route by `economy`, `standard`, or `premium` model tiers. |
| CI-style diagnostics | Check env, auth, models, providers, and runtime specs from scripts. |
| Execution isolation | Run agents in worktrees or temp copies to protect the real project. |
| Skill automation | Define reusable task templates with `skill run <name>`. |

### Current Status

`cli-switch@1.0.0` — all 5 roadmap phases complete. 51 test files, 640 tests
passing.

Implemented:

- `cli-switch run <task>` with smart routing.
- Agent override with `--agent claude-code|codex`.
- Execution modes: `single`, `write_review`, `write_test_fix`, `patch-only`,
  `temp-copy`, `worktree`.
- Tier routing: `economy`, `standard`, `premium`.
- Gateway aliases: `SWITCH_*`, `SWITCH_RELAY_*`, `OPENROUTER_*`.
- Config layering: global `~/.cli-switch/config.yaml` + project
  `.cli-switch.yaml` + CLI flags (CLI > project > global > env).
- Config commands: `config show/set/reset` with dot-path keys, type coercion,
  `--project`/`--global` scope, `--json` output.
- Output validation schemas and diff validation with bounded auto-repair.
- Execution isolation: patch-only mode, temp project copies, git worktrees.
- Skill definitions: local `.cli-switch/skills/` and `~/.cli-switch/skills/`
  with `skill list/show/run` commands.
- JSON output for automation.
- Diagnostics: `resolve`, `env`, `auth status`, `doctor`, `list`.
- Process environment isolation and gateway HOME isolation.
- Full TypeScript build and automated test suite.

Known limits:

- `--strategy balanced|high_quality|low_cost` is accepted but not implemented
  as a runtime cost strategy selector yet.
- Gateway injection currently targets Claude Code and Codex.

### Install

```bash
npm install -g cli-switch
```

Verify:

```bash
cli-switch --version
cli-switch doctor --json
```

From source:

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install
npm run build
npm link
```

### Quick Start

Preview a routing decision:

```bash
cli-switch run "refactor the auth module" --dry-run
```

Run with automatic routing:

```bash
cli-switch run "write tests for the payment parser"
```

Force a specific agent:

```bash
cli-switch run "fix this TypeScript error" --agent codex
cli-switch run "review this architecture change" --agent claude-code
```

Use an execution mode:

```bash
cli-switch run "implement login validation" --execution write_test_fix
cli-switch run "refactor safely" --execution worktree
```

### Gateway And Relay Configuration

Preferred variables:

```bash
export SWITCH_API_KEY=your-gateway-key
export SWITCH_BASE_URL=https://your-relay.example.com/v1
export SWITCH_MODEL_ECONOMY=your-economy-model
export SWITCH_MODEL_STANDARD=your-standard-model
export SWITCH_MODEL_PREMIUM=your-premium-model
```

Self-hosted relay aliases:

```bash
export SWITCH_RELAY_API_KEY=your-relay-key
export SWITCH_RELAY_BASE_URL=https://your-relay.example.com/v1
```

OpenRouter-compatible aliases:

```bash
export OPENROUTER_API_KEY=sk-or-v1-xxx
export OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Priority:

```text
SWITCH_* > SWITCH_RELAY_* > OPENROUTER_*
```

When gateway mode is enabled:

| Agent | Injected variables | Model flag |
| --- | --- | --- |
| Claude Code | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | `--model` |
| Codex CLI | `OPENAI_API_KEY`, `OPENAI_BASE_URL` | `-m` |

### Config Files

Global config: `~/.cli-switch/config.yaml`

```bash
cli-switch config set gateway.base_url https://your-relay.example.com/v1
cli-switch config set gateway.api_key your-key
cli-switch config set gateway.models.economy your-economy-model
cli-switch config set gateway.default_tier standard
cli-switch config show --json
```

Project config: `.cli-switch.yaml` (per-repository, overrides global)

```bash
cli-switch config set --project gateway.default_tier premium
cli-switch config show
```

Config priority: CLI flags > project config > global config > env vars.

### Commands

```bash
cli-switch resolve         # Resolve tool/profile/model to a runtime spec
cli-switch env             # Inspect environment and config sources
cli-switch auth status     # Check auth status for a tool
cli-switch doctor          # Run diagnostics
cli-switch list            # List models, providers, and profiles
cli-switch run             # Route and run an AI agent
cli-switch config show     # Show merged config
cli-switch config set      # Set a config value (dot-path)
cli-switch config reset    # Reset a config value
cli-switch skill list      # List available skills
cli-switch skill show      # Show skill details
cli-switch skill run       # Run a skill by name
cli-switch capabilities    # Show the capability matrix
cli-switch benchmark       # Run capability simulations across agents
```

Current `run` options:

```text
--mode <mode>        single|orchestrator|handoff|review
--agent <agent>      claude-code|codex
--execution <mode>   single|write_review|write_test_fix|patch_only|temp_copy|worktree
--tier <tier>        economy|standard|premium
--json               output JSON
--dry-run            show routing decision without executing
--timeout <seconds>  agent timeout, default 120
--reviewer <agent>   reviewer agent for review mode
--no-git             skip Git guard
--rollback           try rollback on failure
--stream             stream output, default true
--interactive        interactive agent selection
--acp                JSON-RPC over stdio bridge
```

### Architecture

```text
cmd/                  CLI command entrypoints
src/core/router/      capability and model routing
src/core/gateway/     gateway config and env injection
src/core/dispatcher/  agent process management
src/core/sandbox/     environment and HOME isolation helpers
src/core/strategy/    execution mode engine
src/core/config/      config schema, loader, and precedence
src/core/validation/  output validation and repair pipeline
src/core/skill/       skill definitions, loader, and runner
src/registry/         built-in agents, models, providers, profiles
schema/               runtime and config JSON schemas
test/                 unit, contract, e2e, and stress tests
```

### Development

```bash
npm run build
npm test
npm run smoke
npm run lint
```

Verification baseline:

```text
51 test files
640 tests passing
```

### Roadmap — Complete ✅

All 5 planned phases delivered:

1. **Runtime Contract Closure** — resolver strictness, platform/binary preflight, error-code inventory.
2. **Configuration Coverage** — global/project config layering, `config show/set/reset`.
3. **Output Validation and Repair** — capability schemas, diff validation, bounded auto-repair.
4. **Execution Isolation** — patch-only, temp project copy, git worktree modes.
5. **Skill Workflow Foundation** — local skill definitions, `skill run`.

---

## 中文

### 它是什么

`cli-switch` 是面向 AI 编程 CLI 的 **Agent Capability Router（能力路由执行层）**。
它不是新的模型，也不是 Claude Code / Codex CLI 的替代品，而是位于这些工具上方
的一层统一入口：

```text
任务输入
  -> 意图与能力识别
  -> Agent 与模型档位选择
  -> 中转站 / Gateway 凭据注入
  -> 子进程沙盒执行
  -> 文本或 JSON 结果
```

核心目标是让上层 Agent、自动化脚本或开发者不再直接关心"这个任务到底该用哪个
Agent、哪个模型、哪个 API Key、哪个命令参数"。你只描述任务，`cli-switch` 负责
把任务路由到合适的执行器。

### 为什么要做

AI 编程工具越来越多，但它们的调用方式并不统一：

- Claude Code、Codex CLI 等工具各自有不同的认证方式和环境变量。
- 不同 Agent 擅长的任务不同，例如复杂重构、测试生成、错误修复、代码解释。
- 自建中转站、OpenRouter、第三方 Gateway 通常需要把同一套 API Key 映射成不同
  Agent 原生变量。
- 上层 Agent 需要稳定 JSON 输出，而不是解析各个 CLI 的非结构化终端输出。
- 直接让子进程继承用户全局 HOME 和会话变量，容易产生配置污染和不可重复行为。

`cli-switch` 解决的是"多 Agent 能力调用标准化"的问题：把不同 CLI 包装成统一能力，
让系统根据任务自动选择 Agent、模型档位和执行策略。

### 它能做什么

- 在 Claude Code 和 Codex CLI 之间进行任务路由。
- 使用 `--agent` 强制指定某个 Agent。
- 使用 `--tier economy|standard|premium` 表达成本/质量档位。
- 使用 `--execution single|write_review|write_test_fix|patch_only|temp_copy|worktree`
  表达执行流程。
- 把自建中转站或 OpenRouter 兼容 Key 注入为 Claude/Codex 需要的原生环境变量。
- 用 `--dry-run` 查看路由决策，避免盲目消耗模型调用。
- 用 `--json` 接入脚本、CI、上层 Agent 或自动化系统。
- 全局配置 `~/.cli-switch/config.yaml` + 项目配置 `.cli-switch.yaml` 多层覆盖。
- `config show/set/reset` 命令管理配置，支持 dot-path、类型自动转换、`--project`/`--global`。
- 输出校验与自动修复 pipeline，包含能力输出 schema 和 diff 校验。
- Patch-only、临时项目副本、git worktree 三种隔离执行模式。
- 本地 Skill 定义 + `skill list/show/run` 可复用工作流。
- 隔离子进程环境，清理父进程会话变量。

### 当前状态

`cli-switch@1.0.0` — 5 个路线图阶段全部完成。51 个测试文件，640 个测试通过。

当前边界：

- `--strategy balanced|high_quality|low_cost` 目前会被接受并提示 warning，但还没有真正
  作为运行时成本策略生效。
- Gateway 注入当前主要面向 Claude Code 和 Codex。

### 安装与快速开始

```bash
npm install -g cli-switch
cli-switch --version
cli-switch doctor --json
```

查看路由决策：

```bash
cli-switch run "帮我重构 auth 模块" --dry-run
```

自动选择 Agent 执行：

```bash
cli-switch run "给 payment parser 写测试"
```

指定 Agent：

```bash
cli-switch run "修复这个 TypeScript 错误" --agent codex
```

隔离执行：

```bash
cli-switch run "重构这个模块" --execution worktree
```

### 配置文件

全局配置 `~/.cli-switch/config.yaml`：

```bash
cli-switch config set gateway.base_url https://your-relay.example.com/v1
cli-switch config set gateway.api_key your-key
cli-switch config set gateway.models.economy your-economy-model
cli-switch config show --json
```

项目配置 `.cli-switch.yaml`（每个仓库独立，覆盖全局）：

```bash
cli-switch config set --project gateway.default_tier premium
```

优先级：CLI 参数 > 项目配置 > 全局配置 > 环境变量。

### 中转站 / Gateway 配置

```bash
export SWITCH_API_KEY=your-gateway-key
export SWITCH_BASE_URL=https://your-relay.example.com/v1
export SWITCH_MODEL_ECONOMY=your-economy-model
export SWITCH_MODEL_STANDARD=your-standard-model
export SWITCH_MODEL_PREMIUM=your-premium-model
```

优先级：

```text
SWITCH_* > SWITCH_RELAY_* > OPENROUTER_*
```

### 路线图 — 全部完成 ✅

1. **Runtime Contract Closure** — 解析收紧、平台/二进制前置检查、错误码闭环。
2. **Configuration Coverage** — 全局/项目配置分层、`config show/set/reset`。
3. **Output Validation and Repair** — 能力输出 schema、diff 校验、有界自动修复。
4. **Execution Isolation** — patch-only、临时项目副本、git worktree 隔离。
5. **Skill Workflow Foundation** — 本地 Skill 定义、`skill run`。

---

## 日本語

### What / これは何か

`cli-switch` は AI コーディング CLI のための **Agent Capability Router** です。
Claude Code や Codex CLI を置き換えるものではなく、それらの上に置く統一実行
レイヤーです。

```text
タスク入力
  -> 意図と Capability の判定
  -> Agent とモデル Tier の選択
  -> Gateway 認証情報の注入
  -> 分離された子プロセスで実行
  -> テキストまたは JSON 結果
```

開発者、自動化スクリプト、上位 Agent フレームワークが、複数の AI コーディング
Agent を 1 つの安定した CLI インターフェースから呼び出せるようにすることが目的です。

### Why / なぜ必要か

AI コーディング CLI は強力ですが、実運用では次の問題があります。

- ツールごとに認証方式、環境変数、モデル指定フラグが異なる。
- Agent ごとに得意領域が違うため、タスクごとの使い分けが必要。
- 自前の LLM relay や OpenRouter 互換 Gateway を使う場合、同じ Key を各 CLI の
  ネイティブ環境変数へ変換する必要がある。
- 上位 Agent や CI では、端末向けの非構造化出力より安定した JSON が必要。

`cli-switch` はこれらを「Capability Routing」という形で標準化します。

### Current Status / 現在の状態

`cli-switch@1.0.0` — 5 つのロードマップフェーズすべて完了。51 テストファイル、
640 テスト通過。

実装済み機能：

- `cli-switch run` スマートルーティング。
- `--agent`, `--tier`, `--execution` フラグ。
- 6 つの実行モード：`single`, `write_review`, `write_test_fix`,
  `patch_only`, `temp_copy`, `worktree`。
- グローバル + プロジェクト設定レイヤー、`config show/set/reset`。
- 出力バリデーション + diff 自動修復。
- ローカル Skill 定義 + `skill list/show/run`。
- 子プロセス環境分離。

制限：

- `--strategy` は受け付けますが、実行時コスト戦略としては未実装。
- Gateway 注入の主対象は Claude Code と Codex。

### Roadmap / ロードマップ — 完了 ✅

1. **Runtime Contract Closure** — resolver 厳密化、preflight checks、error-code closure。
2. **Configuration Coverage** — グローバル/プロジェクト設定、`config show/set/reset`。
3. **Output Validation and Repair** — capability schema、diff validation、bounded repair。
4. **Execution Isolation** — patch-only、temp copy、worktree モード。
5. **Skill Workflow Foundation** — ローカル Skill 定義、`skill run`。

---

## 한국어

### What / 무엇인가

`cli-switch`는 AI 코딩 CLI를 위한 **Agent Capability Router**입니다. Claude Code나
Codex CLI를 대체하는 도구가 아니라, 여러 코딩 Agent 위에서 하나의 안정적인 실행
인터페이스를 제공하는 오케스트레이션 레이어입니다.

```text
작업 입력
  -> 의도와 Capability 감지
  -> Agent와 모델 Tier 선택
  -> Gateway 인증 정보 주입
  -> 격리된 자식 프로세스에서 실행
  -> 텍스트 또는 JSON 결과
```

개발자, 자동화 스크립트, 상위 Agent 프레임워크가 여러 AI 코딩 CLI를 일관된 방식으로
호출할 수 있게 만드는 것이 목표입니다.

### Current Status / 현재 상태

`cli-switch@1.0.0` — 5개 로드맵 단계 모두 완료. 51 테스트 파일, 640 테스트 통과.

구현된 기능:

- `cli-switch run` 스마트 라우팅.
- `--agent`, `--tier`, `--execution` 플래그.
- 6개 실행 모드: `single`, `write_review`, `write_test_fix`,
  `patch_only`, `temp_copy`, `worktree`.
- 글로벌 + 프로젝트 설정 레이어, `config show/set/reset`.
- 출력 검증 + diff 자동 복구.
- 로컬 Skill 정의 + `skill list/show/run`.
- 자식 프로세스 환경 격리.

제한:

- `--strategy`는 옵션으로 받지만 실제 runtime cost strategy로는 아직 동작하지 않음.
- Gateway 주입은 현재 Claude Code와 Codex가 주요 대상.

### Roadmap / 로드맵 — 완료 ✅

1. **Runtime Contract Closure** — resolver 엄격화, preflight checks, error-code closure.
2. **Configuration Coverage** — 글로벌/프로젝트 설정, `config show/set/reset`.
3. **Output Validation and Repair** — capability schema, diff validation, bounded repair.
4. **Execution Isolation** — patch-only, temp copy, worktree 모드.
5. **Skill Workflow Foundation** — 로컬 Skill 정의, `skill run`.

---

## License

MIT
