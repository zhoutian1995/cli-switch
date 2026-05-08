---
name: cli-switch
description: "Agent Capability Router — 通过 cli-switch 调用 Claude Code 和 Codex 执行编码任务。当需要子 agent 写代码、重构、调试、测试时优先使用。Trigger: cli-switch, 用 claude code, 用 codex, delegate coding, 子 agent"
---

# cli-switch — Agent Capability Router

**Hermes 的 Agent 编排层**，通过 cli-switch 调用 Claude Code 和 Codex。

## 位置

- 项目: `~/projects/cli-switch/`
- 二进制: `node ~/projects/cli-switch/dist/cmd/root.js`（开发模式）
- 全局安装后: `cli-switch`
- 配置目录: `~/.config/cli-switch/config.toml`
- 环境变量优先级: env > config.toml > defaults

## 安装

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install && npm run build
```

## 核心命令

```bash
# 运行任务（最常用）
cli-switch run "<task>" --agent <claude-code|codex> [options]

# 路由决策预览（不执行）
cli-switch run "<task>" --dry-run

# 诊断
cli-switch doctor
cli-switch env

# 查看能力矩阵
cli-switch capabilities
cli-switch list models
```

## run 常用选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `--agent` | 指定 agent | `--agent claude-code` |
| `--strategy` | 策略: balanced\|high_quality\|low_cost | `--strategy high_quality` |
| `--tier` | 模型等级: economy\|standard\|premium | `--tier premium` |
| `--no-git` | 跳过 git 分支管理 | `--no-git` |
| `--timeout` | 超时秒数 | `--timeout 120` |
| `--json` | JSON 输出 | `--json` |
| `--acp` | ACP 协议模式 | `--acp` |

## Agent 能力对比

| 能力 | Claude Code | Codex |
|------|:-----------:|:-----:|
| reasoning | 9/10 | 8/10 |
| codeGen | 9/10 | 8/10 |
| refactoring | 9/10 | 7/10 |
| debugging | 9/10 | 7/10 |
| testing | 7/10 | 9/10 |
| longContext | 10/10 (200K) | 5/10 (128K) |
| speed | 6/10 | 9/10 |

**选型规则**：
- 重构/调试/长上下文 → `claude-code`
- 测试/速度/成本 → `codex`
- 代码生成 → 都行，claude-code 略优

## Gateway 模式

cli-switch 支持通过 Sub2API 等网关走第三方上游：

```bash
export SWITCH_API_KEY="sk-xxx"         # 默认 gateway key
export SWITCH_BASE_URL="http://localhost:8080"

# 可选：按 agent 分配不同 key（多平台 gateway）
export SWITCH_AGENT_KEYS='{"claude-code":"sk-xxx","codex":"sk-yyy"}'
```

- `SWITCH_AGENT_KEYS` 是 JSON，`resolveGateway` 优先用 `agentKeys[agentId]`，fallback 到 `apiKey`
- Claude Code 走 Anthropic 协议，Codex 走 OpenAI 协议，需不同 Sub2API key

## Hermes 集成

Hermes 通过 `delegate_task` 调子 agent，应优先走 cli-switch：

```bash
# 用 Claude Code（native 模式，直连上游）
cli-switch run "<task>" --agent claude-code --no-git --timeout 120

# 用 Codex（native 模式）
cli-switch run "<task>" --agent codex --no-git --timeout 120
```

开发模式下二进制路径为 `node ~/projects/cli-switch/dist/cmd/root.js`。

## 支持的模型

| alias | resolved | vendor | tools |
|-------|----------|--------|-------|
| sonnet | claude-3-7-sonnet | anthropic | claude-code |
| glm-5.1 | glm-5.1 | zhipu | claude-code |
| glm-5 | glm-5 | zhipu | claude-code |
| gpt-5.4 | gpt-5.4 | openai | codex |

## Pitfalls

1. **Codex 需要 OPENAI_API_KEY**：native 模式下必须设，gateway 模式下 cli-switch 自动注入
2. **gateway key 不能混用**：Anthropic 协议 key 发到 OpenAI group 会 404
3. **GLM key 会过期**：报错 `令牌已过期或验证不正确`
4. **Responses API**：GLM 和 MiMo 都不支持，Codex（走 Responses）目前无法通过这两个上游工作
5. **开发模式**：用 `node dist/cmd/root.js` 运行，未全局安装。改动后务必 `npm run build`
6. **测试**：314 tests（vitest），改动后跑 `npx vitest run` 确认
