# cli-switch

面向 Agent 和高级 CLI 工作流的多 AI CLI 兼容与运行时编排层。

cli-switch 不是新的 AI CLI，也不是本地代理网关。它解决的是另一个问题：

> 当上层 Agent、脚本、CI 或自动化系统想调用 Claude Code、Codex CLI、Gemini CLI 这类工具时，如何用统一接口完成模型解析、profile 选择、认证检查、命令构建和结构化输出。

## 为什么做它

现在多 AI CLI 集成通常有几个老问题：

- 每个工具的命令格式不同
- 模型参数、认证方式、环境变量命名不统一
- 同一个工具有多种运行方式，但大多靠隐式环境变量拼出来
- 上层脚本很难稳定判断“现在到底能不能跑”
- 一旦接入多个 CLI，兼容代码很快变成一堆 if-else

cli-switch 的目标，是把这些零散、脆弱、难复用的运行时差异，压缩成一个可以被人和机器共同依赖的公共接口。

## 它是什么

cli-switch 是一个 CLI-first 的兼容层，核心能力包括：

- `resolve`: 解析用户意图，输出统一 runtime spec
- `env`: 输出环境、配置来源和可执行发现结果
- `auth status`: 输出统一认证状态与诊断信息
- `doctor`: 输出综合安装、配置、认证、能力检查结果
- `list models/providers/profiles`: 输出静态发现信息

## 它不是什么

cli-switch 不做这些事：

- 不做桌面 UI
- 不做本地代理网关
- 不做新的 AI CLI 交互壳
- 不做 50+ provider 大全集
- 不做自动登录或自动 OAuth 授权流程
- 不做复杂 round-robin、成本调度、配额平台

一句话说，cli-switch 不是“控制所有 AI 的总控台”，而是“给 Agent 和自动化系统用的多 CLI 运行时兼容层”。

## 目标用户

### 1. Agent 框架作者
需要统一接入多个 AI CLI，并希望拿到稳定 JSON 输出。

### 2. 高级 CLI 工作流维护者
需要在 shell、tmux、CI、Makefile、任务编排器里稳定调用多个 AI CLI。

### 3. AI CLI 工具集成开发者
需要一个独立、可维护、可扩展的兼容层，而不是把工具细节散落到业务代码里。

## 核心设计理念

### 1. JSON First
所有核心命令优先提供稳定 JSON 输出，先服务机器消费，再兼顾人类可读性。

### 2. Adapter First
所有工具差异都收敛到 adapter，不把工具细节写进 resolver 核心。

### 3. Profile First
同一工具的不同运行方式必须显式建模为 profile，而不是靠隐式环境变量拼接。

### 4. 统一接口，不统一底层实现
对 auth、skills、MCP、tool policy 提供统一抽象，但不强行抹平所有底层实现差异。

### 5. 少而稳优先于大而全
MVP 先支持少数主流工具，优先验证抽象质量，而不是快速堆广度。

## MVP 命令面

第一阶段围绕这 7 个命令族展开：

1. `resolve`
2. `env`
3. `auth status`
4. `doctor`
5. `list models`
6. `list providers`
7. `list profiles`

所有核心命令要求：

- 支持 `--json`
- 输出带 `schema_version`
- 失败时返回结构化错误对象

## 一个最核心的输出：runtime spec

cli-switch 的核心交付物不是一句“帮你切模型”，而是一个结构化的 runtime spec，大致像这样：

```json
{
  "schema_version": "v1alpha1",
  "ok": true,
  "data": {
    "request": {
      "tool": "claude-code",
      "profile": "default",
      "model": "sonnet"
    },
    "runtime": {
      "tool": "claude-code",
      "profile": "default",
      "adapter": "claude-code",
      "model": {
        "input": "sonnet",
        "resolved_name": "claude-3-7-sonnet",
        "vendor": "anthropic"
      },
      "provider": {
        "name": "anthropic",
        "transport": "native"
      },
      "auth": {
        "mode": "login",
        "status": "ready"
      },
      "command": {
        "program": "claude",
        "args": ["--model", "claude-3-7-sonnet"],
        "env": {}
      },
      "capabilities": {
        "mcp": true,
        "skills": false,
        "tool_policy": true,
        "structured_output": true
      }
    }
  },
  "warnings": [],
  "diagnostics": []
}
```

这类输出才是上层 Agent、脚本和 CI 真正能依赖的东西。

## 关键抽象

### profile
同一工具的不同运行方式，例如：
- `default`
- `api`
- `router`
- `oauth`

### adapter
每个 AI CLI 一个 adapter，用于吸收具体工具差异，包括：
- 模型解析
- 认证检查
- 命令构建
- doctor 检查
- 能力补丁

### registry
统一承载静态定义：
- tools
- profiles
- models
- providers
- transports
- capabilities

### auth
统一抽象认证状态：
- `mode`: `login | api_key | oauth | none`
- `status`: `ready | missing | expired | conflict | unsupported | unknown`

### capabilities
MVP 至少覆盖：
- `mcp`
- `skills`
- `tool_policy`
- `structured_output`

## 架构概览

cli-switch 建议保持四层边界：

1. `CLI Layer`
2. `Core Resolver Layer`
3. `Registry + Adapter Layer`
4. `Platform / Runtime Layer`

职责划分：

- CLI 层负责参数解析与输出渲染
- Core 负责请求归一化、profile 选择、模型解析、runtime 组装
- Adapter 负责具体工具差异
- Registry 负责静态定义
- Platform 负责 XDG、PATH、文件系统、权限等平台差异

## 支持范围

### 平台
- macOS
- Linux

### MVP 首批工具建议
- Claude Code
- Codex CLI
- Gemini CLI

### 暂不支持
- Windows
- GUI
- 本地代理服务
- 海量 provider 市场

## 示例

### 1. 解析某个工具的运行时

```bash
cli-switch resolve --tool claude-code --model sonnet --json
```

### 2. 查看某个工具认证状态

```bash
cli-switch auth status --tool codex --json
```

### 3. 查看环境与配置来源

```bash
cli-switch env --tool gemini --json
```

### 4. 诊断某个工具是否可用

```bash
cli-switch doctor --tool claude-code --json
```

### 5. 查看某个工具的 profile

```bash
cli-switch list profiles --tool claude-code --json
```

## 错误模型

所有失败都应返回结构化错误，而不是模糊文本。

示例：

```json
{
  "schema_version": "v1alpha1",
  "ok": false,
  "error": {
    "code": "AUTH_MISSING",
    "message": "未找到所需认证信息",
    "hint": "请配置所需凭据"
  },
  "warnings": [],
  "diagnostics": []
}
```

常用错误码包括：
- `CONFIG_NOT_FOUND`
- `TOOL_NOT_SUPPORTED`
- `PROFILE_NOT_FOUND`
- `MODEL_NOT_FOUND`
- `AUTH_MISSING`
- `AUTH_EXPIRED`
- `BINARY_NOT_FOUND`
- `RESOLVE_CONFLICT`
- `PLATFORM_UNSUPPORTED`

## 文档结构

当前文档建议按这个顺序阅读：

1. `02-产品定义.md`
2. `03-MVP需求文档.md`
3. `04-概要设计.md`
4. `05-详细设计.md`
5. `07-开发前决策清单.md`
6. `06-测试方案.md`
7. `01-竞品分析.md`

## 当前开发建议

如果准备开始做 P0，建议先拍板这 5 件事：

1. 实现语言
2. 配置文件格式
3. 首批支持的 3 个工具
4. `v1alpha1` schema 核心字段
5. adapter contract 最小接口

建议默认：
- P0 先 TypeScript
- 配置格式先用 TOML
- 首批工具先做 Claude Code / Codex CLI / Gemini CLI

## 路线图

### P0
- 配置与 registry 加载
- 基础类型
- adapter 接口骨架
- `list`
- `resolve --json`
- `auth status --json`
- schema 与错误码
- 核心单测和 contract tests

### P1
- `doctor --json`
- `env --json`
- 文本 renderer 优化
- macOS / Linux E2E
- overlay merge
- capability patch

### P2
- 更多 adapter
- 更细的 capability 协商
- profile 继承/组合
- 用户自定义 registry 插件机制

## 一句话总结

cli-switch 的价值，不在于“帮用户切一下模型”，而在于：

**把多 AI CLI 复杂、零散、难维护的运行时差异，压缩成一个可依赖、可诊断、可扩展的公共接口。**
