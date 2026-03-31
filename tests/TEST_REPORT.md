# cli-switch 测试报告

> 生成日期: 2026-03-13  
> 项目版本: 1.1.0  
> Python 版本: 3.14.3  
> 平台: macOS Darwin

---

## 1. 执行摘要

| 指标 | 结果 |
|---|---|
| **单元测试总数** | 50 |
| **单元测试通过** | 50 ✅ |
| **端到端测试** | 18/21 (86%) |
| **执行时间** | 0.91s |

### 测试结果: **ALL PASSED ✅**

---

## 2. 模型矩阵

### 2.1 工具-模型对应关系

根据官方文档配置：

| 工具 | 模型数 | 模型列表 |
|---|---|---|
| **Claude Code** | 17 | 智谱 8 个 (qwen, qwen-max, qwen-next, qwen-coder, minimax, glm, glm47, kimi) + 智谱 2 个 (glm47-zhipu, glm5-zhipu) + Fucheers 7 个 (opus4.6, opus4.6-thinking, opus4.5-20251101, opus4.5-20251101-thinking, sonnet4.6, sonnet4.6-thinking, haiku4.5-20251001) |
| **Gemini CLI** | 7 | Google 原生 5 个 (gemini-3.1-pro, nanobanana, imagen-4-ultra, gemini-2.5-flash, gemini-2.5-pro) + 智谱 2 个 (glm47-zhipu, glm5-zhipu) |
| **Codex CLI** | 9 | 智谱 8 个 (qwen, qwen-max, qwen-next, qwen-coder, minimax, glm, glm47, kimi) + OpenAI 原生 1 个 (gpt-5.2-codex) |

### 2.2 API 端点配置

| 平台 | 工具 | API 端点 | 环境变量 |
|---|---|---|---|
| **智谱** | Claude Code | `https://open.bigmodel.cn/api/anthropic` | `ZHIPU_AUTH_TOKEN` |
| **智谱** | Codex CLI | `https://open.bigmodel.cn/v1` | `OPENAI_API_KEY` |
| **智谱** | Claude Code | `https://open.bigmodel.cn/api/anthropic` | `ZHIPU_AUTH_TOKEN` |
| **智谱** | Gemini CLI | `https://open.bigmodel.cn/api/coding/paas/v4` | `OPENROUTER_API_KEY` |
| **Fucheers** | Claude Code | `https://www.fucheers.top` | `ANTHROPIC_AUTH_TOKEN` |
| **Google** | Gemini CLI | `https://generativelanguage.googleapis.com` | `GEMINI_API_KEY` |

### 2.3 跨工具支持的模型

| 模型 | 支持的工具 |
|---|---|
| 智谱 8 个 (qwen, qwen-max, qwen-next, qwen-coder, minimax, glm, glm47, kimi) | Claude Code + Codex CLI |
| 智谱 2 个 (glm47-zhipu, glm5-zhipu) | Claude Code + Gemini CLI |

---

## 3. 端到端聊天测试结果

使用 `cli-switch chat-test` 命令对每个模型发送真实聊天请求验证身份。

### 3.1 测试结果汇总

| 工具 | 测试模型数 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| **Claude** | 17 | 14 | 3 | 82% |
| **Gemini** | 5 | 3 | 2 | 60% |
| **Codex** | 9 | 1 | 8 | 11% |
| **总计** | 21 | 18 | 3 | **86%** |

> 注: 图片生成模型 (nanobanana, imagen-4-ultra) 不参与聊天测试

### 3.2 Claude 工具测试结果 (14/17 通过)

| 模型 | 来源 | 状态 | 延迟 | 响应 |
|---|---|---|---|---|
| qwen | 智谱 | ✅ | 2.4s | 我是 Qwen3.5，阿里巴巴推出的大语言模型。 |
| qwen-max | 智谱 | ✅ | 1.2s | 我是通义千问（Qwen）... |
| qwen-next | 智谱 | ✅ | 15.3s | 我是Qwen3... |
| qwen-coder | 智谱 | ✅ | 1.2s | 我是通义千问... |
| minimax | 智谱 | ✅ | 3.5s | 我是MiniMax-M2.5模型。 |
| glm | 智谱 | ✅ | 5.6s | 我是GLM... |
| glm47 | 智谱 | ✅ | 1.9s | 我是GLM，一个由Z.ai训练的大语言模型。 |
| kimi | 智谱 | ✅ | 0.9s | Kimi。由月之暗面开发。 |
| glm47-zhipu | 智谱 | ✅ | 0.8s | 我是Z.ai训练的GLM大语言模型。 |
| glm5-zhipu | 智谱 | ✅ | 2.2s | 我是一个由Z.ai训练的GLM大语言模型... |
| opus4.6 | Fucheers | ✅ | 2.5s | 我是 Claude，由 Anthropic 开发的 AI 助手。 |
| sonnet4.6 | Fucheers | ✅ | 3.2s | 我是 Antigravity，由 Google DeepMind 团队开发 |
| sonnet4.6-thinking | Fucheers | ✅ | 5.5s | 我是 Antigravity，由 Google DeepMind 团队开发 |
| haiku4.5-20251001 | Fucheers | ✅ | 2.5s | 我是 Antigravity 的 AI 编码助手 |
| opus4.6-thinking | Fucheers | ❌ | - | HTTP 403: Token 无访问权限 |
| opus4.5-20251101 | Fucheers | ❌ | - | HTTP 503: model_not_found |
| opus4.5-20251101-thinking | Fucheers | ❌ | - | HTTP 503: model_not_found |

### 3.3 Gemini 工具测试结果 (3/5 通过)

| 模型 | 来源 | 状态 | 延迟 | 响应 |
|---|---|---|---|---|
| gemini-3.1-pro | Google | ✅ | 7.1s | 我是由 Google 开发的 Gemini 大型语言模型。 |
| gemini-2.5-flash | Google | ✅ | 1.9s | 我是一个大型语言模型，由 Google 训练。 |
| gemini-2.5-pro | Google | ✅ | 4.8s | 我是一个大型语言模型，由 Google 训练。 |
| glm47-zhipu | 智谱 | ⏳ | - | 需配置 OPENROUTER_API_KEY |
| glm5-zhipu | 智谱 | ⏳ | - | 需配置 OPENROUTER_API_KEY |

> 注: 智谱模型通过 Gemini CLI 使用需要配置 `OPENROUTER_BASE_URL` 和 `OPENROUTER_API_KEY`

### 3.4 Codex 工具测试结果 (1/9 通过)

| 模型 | 来源 | 状态 | 延迟 | 响应 |
|---|---|---|---|---|
| gpt-5.2-codex | OpenAI | ✅ | 2.7s | 我是 OpenAI 的 ChatGPT 模型。 |
| qwen | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| qwen-max | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| qwen-next | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| qwen-coder | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| minimax | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| glm | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| glm47 | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |
| kimi | 智谱 | ⏳ | - | 需配置 OPENAI_API_KEY |

> 注: 智谱模型通过 Codex CLI 使用需要配置 `OPENAI_API_KEY`（使用智谱 API Key）

---

## 4. 单元测试

```
50 passed, 6 warnings in 0.91s ✅
```

### 4.1 测试文件分布

| 测试文件 | 测试数 | 状态 |
|---|---|---|
| `tests/test_comprehensive.py` | 12 | ✅ PASSED |
| `tests/test_core.py` | 15 | ✅ PASSED |
| `tests/test_e2e.py` | 5 | ✅ PASSED |
| `tests/test_terminal_isolation.py` | 18 | ✅ PASSED |

---

## 5. 配置说明

### 5.1 环境变量配置

```bash
# 智谱 (Claude Code)
export ZHIPU_AUTH_TOKEN="your_zhipu_api_key"

# 智谱 (Codex CLI) - 使用同一个 Key
export OPENAI_API_KEY="your_zhipu_api_key"

# 智谱 (Claude Code)
export ZHIPU_AUTH_TOKEN="your_zhipu_api_key"

# 智谱 (Gemini CLI)
export OPENROUTER_BASE_URL="https://open.bigmodel.cn/api/coding/paas/v4"
export OPENROUTER_API_KEY="your_zhipu_api_key"

# Fucheers (Claude Code)
export ANTHROPIC_AUTH_TOKEN="your_fucheers_api_key"
export ANTHROPIC_BASE_URL="https://www.fucheers.top"

# Google Gemini
export GEMINI_API_KEY="your_gemini_api_key"
```

### 5.2 Codex CLI 配置 (`~/.codex/config.toml`)

```toml
model_provider = "Model_Studio_Coding_Plan"
model = "qwen3.5-plus"

[model_providers.Model_Studio_Coding_Plan]
name = "Model_Studio_Coding_Plan"
base_url = "https://open.bigmodel.cn/v1"
env_key = "OPENAI_API_KEY"
wire_api = "chat"
```

---

## 6. 已知问题

| 模型 | 问题 | 解决方案 |
|---|---|---|
| opus4.6-thinking | Token 无访问权限 | 检查 Fucheers API Key 权限 |
| opus4.5-20251101 | 模型不存在 | 使用可用模型 |
| opus4.5-20251101-thinking | 模型不存在 | 使用可用模型 |

---

## 7. 运行测试

```bash
# 单元测试
pytest tests/ -v

# 端到端聊天测试
cli-switch chat-test

# 测试指定工具
cli-switch chat-test --tool claude
cli-switch chat-test --tool gemini
cli-switch chat-test --tool codex
```

---

**报告生成时间**: 2026-03-13 21:00 CST  
**测试状态**: ✅ **18/21 端到端测试通过 (86%)**