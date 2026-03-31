# CLI-Switch OpenClaw 集成指南

## 概述
CLI-Switch 是一个强大的AI CLI工具切换器，支持多终端隔离、并发安全和模型管理。

## 安装

```bash
# 从源码安装
cd ~/projects/cli-switch
pipx install -e .

# 验证安装
cli-switch --version
cli-switch list
```

## 核心功能

### 1. 模型切换
```bash
# 切换到百炼GLM-5
cli-switch glm

# 切换到智谱GLM-5
cli-switch glm5-zhipu

# 切换到Qwen
cli-switch qwen
```

### 2. 跨工具支持
```bash
# Claude Code (默认)
cli-switch qwen

# Gemini CLI
cli-switch --tool gemini glm5-zhipu

# Codex CLI
cli-switch --tool codex qwen
```

### 3. 模型管理
```bash
# 列出所有模型
cli-switch list

# 查看状态
cli-switch status

# 添加自定义模型
cli-switch model add my-model --model-id custom-7b --tool claude --base-url https://api.example.com

# 删除自定义模型
cli-switch model remove my-model
```

### 4. JSON输出 (供Agent使用)
```bash
# JSON格式输出
cli-switch --json list
cli-switch --json status
cli-switch --json model show qwen
```

## Agent使用场景

### 场景1: 环境检测
Agent可以检测当前使用的模型：
```bash
cli-switch --json status
```
返回：
```json
{
  "active_tool": "claude",
  "active_model": "glm",
  "model_name": "GLM-5 (百炼)"
}
```

### 场景2: 智能切换
Agent可以根据任务需求切换模型：
```bash
# 代码任务 -> 切换到代码专用模型
cli-switch qwen-coder

# 通用任务 -> 切换到推荐模型
cli-switch qwen

# 推理任务 -> 切换到最强模型
cli-switch qwen-max
```

### 场景3: 多终端协作
不同终端可以使用不同模型，互不干扰：
```bash
# 终端1: 使用Claude Code + Qwen
cli-switch qwen
claude

# 终端2: 使用Gemini CLI + 智谱GLM
cli-switch --tool gemini glm5-zhipu
gemini
```

## 注意事项

### 1. 认证配置
确保已配置API密钥：
- `ZHIPU_AUTH_TOKEN` - 智谱模型
- `ANTHROPIC_API_KEY` - Fucheers模型

### 2. 终端隔离
- 每个TTY终端独立维护状态
- 不会互相干扰
- 支持Tmux多窗口

### 3. 并发安全
- 原子写入保护
- 防止配置撕裂
- 支持多Agent并发调用

### 4. Hook机制
- 支持PreToolUse/PostToolUse钩子
- 防重入保护
- 环境变量占位符渲染