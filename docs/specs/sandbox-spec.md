# Sandbox Spec — 沙盒规格

> **定位**：本文档定义 cli-switch 的沙盒隔离机制，包括环境隔离、HOME 隔离、文件系统安全和配置作用域。
>
> **上游**：[PRD.md](../PRD.md)（三、关键设计原则 + 四、核心功能）
>
> **下游**：实现层的沙盒管理模块、进程启动模块、配置管理模块
>
> **关系**：本 spec 是 PRD 沙盒相关章节的结构化提取和细化，为沙盒隔离的实现提供精确规格定义。
>
> **状态说明**：v0.1 已实现子进程环境隔离、父进程 session 环境清理、gateway 环境 overlay 注入，以及 gateway 场景的可选 HOME 隔离。file policy、patch-only 输出、临时项目副本和 worktree 隔离仍是后续目标，当前实现不得描述为完整文件系统沙盒。

---

## 0. 当前安全基线（v0.1）

当前 `ProcessManager.spawnAgent()` 的真实行为：
- 使用真实工作目录或调用方传入的 `cwd`
- 子进程环境由 `createSandboxEnv(process.env, envOverlay)` 生成
- 清理父进程 session 环境变量，例如 `CLAUDECODE`、`CLAUDE_CODE_SESSION_ID`、`CODEX_SESSION_ID`
- `options.env` 与 `options.gatewayEnv` 合并为 overlay，`gatewayEnv` 优先级最高
- 默认不重写 `HOME`
- gateway enabled 时启用 `homeIsolation`，创建临时 HOME 并在任务结束后清理
- 临时 HOME 只 symlink `.gitconfig` 和 `.ssh/known_hosts`，不带入 `.claude/`、`.codex/`、`.config/`
- 不阻止 Agent 直接读写项目文件
- 不强制 patch-only 输出
- 支持 timeout 后 `SIGKILL`
- 支持最大并发队列
- stdout/stderr 有最大 10MB 缓冲裁剪

当前 GitGuard 安全模型：
- 可在 Agent 执行前创建 `agent/<task>-<timestamp>` 分支
- 可创建 checkpoint commit
- Agent 完成后可自动提交变更
- 可检查 diff 规模、二进制文件、受保护文件名和常见 secret pattern
- 可列出和清理旧 agent 分支

重要边界：
- GitGuard 是版本控制安全网，不是文件系统沙盒。
- 当前真实项目目录如果暴露给可写 Agent，Agent 仍可能直接修改文件。
- 临时项目副本、patch apply 校验或 worktree 隔离上线前，不应把当前实现描述为强文件沙盒。

---

## 1. 环境隔离

> v0.1 状态：已实现环境 overlay 注入和父进程 session 环境清理。`SWITCH_API_KEY` / `SWITCH_BASE_URL` 由 gateway resolver 映射为 Agent 原生环境变量，例如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 和对应 base URL。

### 1.1 核心约束

```
不能污染用户本机环境变量
不能影响用户已有的 Claude Code / Codex
```

### 1.2 独立环境变量

沙盒为每次执行提供独立的环境变量，只对当前任务生效，任务结束即销毁。

| 环境变量 | 说明 | 用途 |
|---------|------|------|
| `SWITCH_API_KEY` | 网关 API Key | 统一认证入口 |
| `SWITCH_BASE_URL` | 网关 Base URL | 统一模型入口 |

### 1.3 环境变量注入方式

通过环境变量 overlay 合并，注入 Agent 子进程。Agent 默认的 API 配置被覆盖：

```yaml
# cli-switch 内部执行
# 将 SWITCH_API_KEY / SWITCH_BASE_URL 映射为 Agent 期望的环境变量
claude-code:
  env_inject:
    ANTHROPIC_API_KEY: ${SWITCH_API_KEY}
    ANTHROPIC_BASE_URL: ${SWITCH_BASE_URL}

codex:
  env_inject:
    OPENAI_API_KEY: ${SWITCH_API_KEY}
    OPENAI_BASE_URL: ${SWITCH_BASE_URL}
```

**实现方式**：
- `createSandboxEnv(baseEnv, envOverlay)` — 环境变量 overlay 合并
- 清除父进程泄漏的环境变量（`CLAUDECODE`、`CLAUDE_CODE_ENTRYPOINT` 等）
- Agent 子进程启动时注入独立环境变量，**只在子进程内生效**
- 只在 cli-switch 沙盒内生效，不影响用户本机环境

---

## 2. HOME 隔离

> v0.1 状态：HOME 隔离已作为 `ProcessManager.spawnAgent()` 的可选 sandbox 配置实现，并在 `cli-switch run` 的 gateway enabled 路径启用。它的目标是避免 Claude Code / Codex 读取用户 HOME 下的全局配置覆盖 gateway 注入。

### 2.1 为什么需要 HOME 隔离

Agent（Claude Code / Codex）启动时会读取各自的全局配置文件。环境变量不一定能覆盖所有配置项。必须彻底隔离：

```
风险：Claude Code 读 ~/.claude/ 配置，Codex 读 ~/.codex/ 配置
      这些配置可能覆盖 cli-switch 注入的环境变量
```

### 2.2 home_isolation 方案

```yaml
sandbox:
  home_isolation: true                  # 启用 HOME 隔离
```

### 2.3 home_template 配置

沙盒 HOME 目录中需要准备的内容——通过 symlink 保留必要文件，block 掉 Agent 配置：

```yaml
sandbox:
  home_isolation: true
  home_template:                        # 沙盒 HOME 目录中需要准备的内容
    - source: ~/.gitconfig              # 保留 git 身份（否则 commit 没作者）
      target: .gitconfig
      type: symlink                     # symlink 只读引用
    - source: ~/.ssh/known_hosts        # 保留 SSH known_hosts（避免 git clone 确认）
      target: .ssh/known_hosts
      type: symlink
  block:                                # 以下目录不 symlink，确保 Agent 读不到用户配置
    - .claude/                          # Claude Code 全局配置
    - .codex/                           # Codex 全局配置
    - .config/                          # 通用配置目录
```

### 2.4 block 列表

| 路径 | 说明 | 理由 |
|------|------|------|
| `.claude/` | Claude Code 全局配置 | 防止用户配置覆盖注入的环境变量 |
| `.codex/` | Codex 全局配置 | 同上 |
| `.config/` | 通用配置目录 | 防止其他潜在配置干扰 |

> **注意**：block 列表中的目录在沙盒 HOME 中**不存在**（不是空目录，是完全不创建）。

### 2.5 执行流程

```
1. 创建 tmpdir: /tmp/cli-switch-{task_id}/
2. 创建 tmpdir 内的 HOME: /tmp/cli-switch-{task_id}/home/
3. 按 home_template symlink 必要文件（.gitconfig, .ssh/known_hosts）
4. 启动 Agent 子进程时设置 HOME=/tmp/cli-switch-{task_id}/home/
5. 任务结束 → 删除整个 tmpdir（不留痕迹）
```

**核心约束**：
- Agent 子进程的 `HOME` 指向沙盒目录，读不到用户本机的任何 Agent 配置
- git 身份通过 symlink 保留，不影响 git 操作
- 任务结束即销毁，不留痕迹
- tmpdir 路径格式：`/tmp/cli-switch-{task_id}/`

---

## 3. 文件系统安全

### 3.1 file_policy 完整配置

```yaml
file_policy:
  read_scope: project_dir              # 只能读项目目录内文件
  write_scope: target_files            # 只能改 task 中列出的文件
  create_allowed: true                 # 允许新建文件（项目目录内）
  delete_allowed: false                # 禁止删除文件
  protected_paths:                     # 绝对不能碰的路径
    - .git/
    - node_modules/
    - .env
    - "*.lock"
  output_mode: patch                   # 写操作产出 patch，不直接改文件
```

### 3.2 read_scope / write_scope

| scope | 值 | 说明 |
|-------|---|------|
| `read_scope` | `project_dir` | 允许读：项目目录内所有文件（递归） |
| `write_scope` | `target_files` | 允许写：仅限 target_files 白名单 + 新建文件（必须在 project 目录内） |

**禁止操作**：
- 删除文件
- 修改 `.git/`
- 修改 `node_modules/`
- 修改 `.env`
- 修改 `*.lock` 文件
- 修改配置文件（除非明确指定为 target_files）

### 3.3 protected_paths

| 路径 | 说明 |
|------|------|
| `.git/` | Git 仓库元数据 |
| `node_modules/` | 依赖目录 |
| `.env` | 环境变量文件（含敏感信息） |
| `*.lock` | 锁文件（npm lock / yarn lock 等） |

### 3.4 output_mode: patch

写操作产出 **patch（补丁）**，不直接修改文件：

```yaml
output_mode: patch
```

**两层安全**：
1. **Prompt 层**：在 system_prompt 中告知 Agent 限制（软约束）
2. **执行层**：禁用直接写入或在临时项目副本中执行，只接收 patch，再由 cli-switch 校验后 apply（硬约束）

**实现含义**：
- Agent 的写操作通过 diff / patch 产出，cli-switch 控制是否 apply
- 用户可在 apply 前审查所有变更
- cli-switch 可在 apply 时做二次校验（路径白名单、protected_paths 检查）

**MVP 硬约束边界**：
- `cwd` 限制只能约束默认工作目录，不能单独阻止 Agent 写入项目文件。
- 若 Agent 具备直接文件写入能力，必须在临时项目副本中运行，或通过 Agent 参数禁用写工具，仅允许输出 patch。
- patch apply 必须由 cli-switch 执行，并在 apply 前校验路径白名单、protected_paths 和 delete_allowed。
- Git worktree 隔离是后续增强项；在未实现前，不得把真实项目目录直接暴露给可写 Agent 并声称具备强文件隔离。

---

## 4. 配置作用域

### 4.1 三层优先级

```
任务级配置  >  项目配置  >  全局配置
```

### 4.2 各层级说明

| 层级 | 配置来源 | 优先级 | 适用范围 |
|------|---------|-------|---------|
| **全局** | `~/.cli-switch/config.yaml` | 低 | 所有项目、所有任务 |
| **项目级** | `./.cli-switch.yaml`（项目根目录） | 高 | 当前项目的所有任务 |
| **任务级** | CLI 命令行参数 | 最高 | 单次执行 |

### 4.3 合并规则

- 项目级配置与全局配置**深度合并**（deep merge）
- 项目级只声明需要覆盖的字段，未声明的字段继承全局配置
- CLI 命令行参数（`--agent` / `--model` / `--profile` / `--execution` 等）的优先级高于所有配置文件

### 4.4 沙盒内的配置隔离

沙盒的 HOME 隔离确保：
- Agent 子进程**读不到**用户本机的全局配置（`.claude/` / `.codex/` / `.config/`）
- Agent 子进程**只受** cli-switch 注入的环境变量和 prompt 约束控制
- 不同任务的沙盒之间完全隔离

### 4.5 配置文件路径汇总

| 路径 | 说明 |
|------|------|
| `~/.cli-switch/config.yaml` | 全局默认配置 |
| `~/.cli-switch/cost_profiles/balanced.yaml` | 内置默认成本档位 |
| `~/.cli-switch/cost_profiles/high_quality.yaml` | 内置高质量成本档位 |
| `~/.cli-switch/cost_profiles/low_cost.yaml` | 内置低成本成本档位 |
| `~/.cli-switch/execution_modes/single.yaml` | 内置单步执行模式 |
| `~/.cli-switch/execution_modes/write_review.yaml` | 内置写后审查模式 |
| `~/.cli-switch/execution_modes/write_test_fix.yaml` | 内置写测修循环模式 |
| `~/.cli-switch/execution_modes/custom.yaml` | 用户自定义执行模式 |
| `./.cli-switch.yaml` | 项目级覆盖（最高优先级配置文件） |

### 4.6 借鉴：Paseo 环境注入模式

cli-switch 的沙盒设计借鉴 Paseo 的环境注入模式：

| Paseo 模块 | 行数 | cli-switch 对应 |
|-----------|------|----------------|
| `provider-launch-config.ts` | 252 | 进程启动配置、环境变量管理 |
| `spawn.ts` | — | 跨平台进程管理 |

**关键模式**：
- `createProviderEnv()` → `createExternalProcessEnv(baseEnv, envOverlay)` 实现环境变量 overlay 合并
- `PARENT_SESSION_ENV_VARS` 清除父进程泄漏的环境变量
- Agent 子进程通过 stdio 双向通信，协议与进程生命周期解耦
