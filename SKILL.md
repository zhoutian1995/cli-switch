---
name: cli-switch
description: |
  AI CLI 工具模型切换器 - 一键切换 Claude Code、Gemini CLI、Codex CLI 的模型
  支持多终端隔离、智能模型选择、跨工具切换
  
  Trigger: /cli-switch, switch-model, model-switch, use-model, 切换模型
metadata:
  version: 1.2.0
  author: OpenClaw Team
  repository: https://github.com/zhoutian1995/cli-switch
  platforms: [claude-code, opencode]
---

# CLI-Switch - AI 模型切换器

让 Claude Code 和 OpenCode 智能切换 AI 模型，支持 Claude Code、Gemini CLI、Codex CLI 三大工具。

## 🚀 快速开始

```bash
# 切换到 Claude Code 首选模型
cli-switch opus4.6

# 切换到 Gemini CLI 前端模型
cli-switch --tool gemini gemini-3.1-pro

# 切换到 Codex CLI 审查模型
cli-switch --tool codex gpt-5.2-codex

# 查看当前状态
cli-switch status

# 列出所有模型
cli-switch list
```

## 📦 支持的工具和模型

### Claude Code (14 个模型)

| 提供商 | 模型 | 推荐场景 |
|-------|------|---------|
| **Fucheers** | `opus4.6` ⭐ | 写后端/架构代码（首选） |
| | `opus4.6-thinking` | 需要思考过程的复杂任务 |
| | `sonnet4.6` | 通用均衡任务 |
| | `haiku4.5` | 轻量快速任务 |
| **智谱** | `glm-5.1` | 最新旗舰版 |
| | `glm-5` | 代码专用 |
| | `glm-4.7` | 平衡 |

### Gemini CLI (12 个模型)

| 提供商 | 模型 | 推荐场景 |
|-------|------|---------|
| **Google** | `gemini-3.1-pro` ⭐ | 前端/UI 任务（首选） |
| | `nanobanana` | 图像生成 |
| | `gemini-2.5-pro` | 高级推理 |
| **智谱** | `glm-5.1`, `glm-5` 等 | 通用备选 |

### Codex CLI (1 个模型)

| 提供商 | 模型 | 推荐场景 |
|-------|------|---------|
| **OpenAI** | `gpt-5.2-codex` ⭐ | 代码审查（首选） |

## 🎯 智能模型选择策略

### 任务类型 → 模型推荐

| 任务 | 工具 | 首选模型 | 备选模型 |
|------|------|---------|---------|
| 写代码 | Claude | `opus4.6` | `glm-5.1`, `glm-5` |
| 前端/UI | Gemini | `gemini-3.1-pro` | `gemini-2.5-pro` |
| 代码审查 | Codex | `gpt-5.2-codex` | - |
| 架构评审 | Gemini | `gemini-3.1-pro` | `gemini-2.5-pro` |
| 图像生成 | Gemini | `nanobanana` | `imagen-4-ultra` |
| 快速任务 | Claude | `haiku4.5` | `sonnet4.6` |

## 🛡️ 防卡死机制

```bash
# 1. 设置超时
timeout 5s cli-switch opus4.6 || timeout 5s cli-switch glm-5.1

# 2. 降级方案
cli-switch opus4.6 || cli-switch glm-5.1 || cli-switch glm-4.7

# 3. 状态验证
cli-switch --json status
```

## 📋 工作流集成示例

### Claude Code 写代码
```bash
# 1. 切换到首选模型
cli-switch opus4.6

# 2. 验证状态
cli-switch status

# 3. 执行任务
claude -p "你的任务描述"
```

### Codex 代码审查
```bash
# 1. 切换到 Codex
cli-switch --tool codex gpt-5.2-codex

# 2. 执行审查
codex exec "审查代码"
```

### Gemini 前端开发
```bash
# 1. 切换到 Gemini
cli-switch --tool gemini gemini-3.1-pro

# 2. 执行任务
gemini -p "你的任务描述"
```

## 🔧 高级功能

### 自定义模型
```bash
# 添加自定义模型
cli-switch model add my-model \
  --model-id llama-3 \
  --tool claude \
  --base-url http://localhost:11434/v1

# 使用自定义模型
cli-switch my-model
```

### Hook 集成
```bash
# 安装 Shell Hook
cli-switch hook install

# 配置切换后 Hook
cli-switch hook config add post_switch "echo '已切换到 {model}'"
```

### MCP 集成
```bash
# 安装智谱视觉 MCP
cli-switch mcp install-zai

# 启用 web-search
cli-switch mcp enable-web-search
```

## 🔍 故障排查

### 模型切换失败
```bash
# 检查配置
cli-switch status

# 检查 API 密钥
echo $ZHIPU_AUTH_TOKEN
echo $GEMINI_API_KEY
```

### 状态不同步
```bash
# 清理状态文件
rm ~/.cli-switch/sessions/*.json

# 重新切换
cli-switch opus4.6
```

## 📊 最佳实践

1. **总是验证状态** - 切换后使用 `cli-switch status` 确认
2. **设置超时** - 使用 `timeout` 命令防止卡死
3. **有降级方案** - 准备备选模型
4. **使用 JSON 输出** - 便于脚本解析 `cli-switch --json status`

---

**仓库**: https://github.com/zhoutian1995/cli-switch
**版本**: 1.2.0
**许可证**: MIT
