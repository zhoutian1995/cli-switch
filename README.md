# CLI Switch

**AI CLI 工具切换器** - 在 Claude Code、Gemini CLI、Codex CLI 之间快速切换模型

## 功能特性

- 🚀 **快速切换** - 一键切换不同 AI CLI 工具的模型
- 📋 **交互式菜单** - 美观的终端 UI
- 🧪 **模型测试** - 健康检查，验证模型是否正常响应
- 🤖 **Agent 友好** - 支持命令行参数直接调用
- 📊 **JSON 输出** - 结构化输出，方便脚本集成

## 支持的 CLI 工具

| 工具 | 配置文件 | 模型数量 |
|------|----------|---------|
| **Claude Code** | `~/.claude/settings.json` | 15+ |
| **Gemini CLI** | `~/.gemini/config.json` | 2+ |
| **Codex CLI** | `~/.codex/config.toml` | 2+ |

## 快速开始

### 安装

```bash
cd ~/projects/cli-switch
pip install -e .
```

### 基本用法

```bash
# 切换到指定模型
cli-switch qwen

# 列出所有模型
cli-switch list

# 显示当前状态
cli-switch status

# 测试模型
cli-switch test

# 获取帮助
cli-switch --help
```

## 命令行接口

```bash
cli-switch <model>              # 切换到指定模型
cli-switch list                 # 列出所有模型
cli-switch status               # 显示当前状态
cli-switch test [model]         # 测试模型
cli-switch config show          # 显示配置
cli-switch --version            # 显示版本号
cli-switch --help               # 帮助
cli-switch --json               # JSON 格式输出
```

## 配置

配置文件位置:
- macOS: `~/Library/Application Support/cli-switch/config.yaml`
- Linux: `~/.config/cli-switch/config.yaml`

## 许可证

MIT License
