# CLI Switch

专业的命令行 AI 工具切换器 - 支持 Claude Code、Gemini CLI、Codex CLI

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 快速开始

### 安装

```bash
# 从源码安装
cd ~/projects/cli-switch
pip install -e .
```

### 基本用法

```bash
# 切换到指定模型
cli-switch qwen

# 列出所有可用模型
cli-switch list

# 查看当前状态
cli-switch status

# 测试模型是否正常响应
cli-switch test qwen

# 交互式菜单
cli-menu
```

## 支持的工具

| 工具 | 配置文件 | 说明 |
|------|----------|------|
| **Claude Code** | `~/.claude/settings.json` | 修改 ANTHROPIC_MODEL 等环境变量 |
| **Gemini CLI** | `~/.gemini/config.json` | 修改 model 字段 |
| **Codex CLI** | `~/.codex/config.toml` | 修改 model 字段 |

## 可用模型

### 阿里云百炼 (Claude Code / Codex CLI)
| 模型 | 说明 |
|------|------|
| `qwen` | Qwen3.5+ ⭐推荐 |
| `kimi` | Kimi K2.5 ⭐推荐 |
| `glm` | GLM-5 (代码专用) ⭐推荐 |
| `minimax` | MiniMax M2.5 ⭐推荐 |
| `qwen-max` | Qwen3 Max |
| `qwen-coder` | Qwen Coder+ |
| `qwen-coder-next` | Qwen Coder Next |
| `glm47` | GLM-4.7 |

### 智谱 (Claude Code / Gemini CLI)
| 模型 | 说明 |
|------|------|
| `glm47-zhipu` | GLM-4.7 平衡 |
| `glm5-zhipu` | GLM-5 最强 |

### Fucheers (Claude Code)
| 模型 | 说明 |
|------|------|
| `opus4.6` | Claude Opus 4.6 写后端专用 |

### Gemini CLI 原生
| 模型 | 说明 |
|------|------|
| `gemini-2.5-pro` | Gemini 2.5 Pro 前端/推理 |
| `nanobanana` | Nano Banana 2 画图专用 |

### Codex CLI
| 模型 | 说明 |
|------|------|
| `gpt-5.2-codex` | GPT-5.2 Codex 深度搜索 |
| `gpt-5.4-codex` | GPT-5.4 Codex 代码 review |

## 命令行接口

### cli-switch 命令

```bash
cli-switch <model>           # 切换到指定模型
cli-switch list              # 列出所有模型
cli-switch status            # 显示当前状态
cli-switch test [model]      # 测试模型 (不传参数测试所有)
cli-switch tool <tool>       # 选择目标工具 (claude/gemini/codex)
cli-switch config show       # 显示配置
cli-switch --help            # 帮助信息
```

### cli-menu 命令

```bash
cli-menu                     # 交互式菜单
cli-menu <model>             # 直接切换模型
```

## 配置

配置文件位于 `~/Library/Application Support/cli-switch/config.yaml` (macOS)

示例配置:

```yaml
active_tool: claude
active_model: qwen

models:
  qwen:
    name: "Qwen3.5+"
    tool: claude
    model_id: "qwen3.5-plus"
    base_url: "https://coding.dashscope.aliyuncs.com/apps/anthropic"
    description: "通义千问 3.5 增强版"
```

## 模型测试

`cli-switch test` 命令执行以下健康检查:

1. 检查配置文件是否存在
2. 检查 API 密钥是否配置
3. 发送 HEAD 请求检查端点可达性
4. 发送测试消息验证响应
5. 输出结果和延迟统计

## 开发

```bash
# 克隆仓库
git clone https://github.com/opencode/cli-switch.git
cd cli-switch

# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 代码格式化
black src/
ruff check src/
```

## 文档

- [使用指南](docs/USAGE.md)
- [配置说明](docs/CONFIG.md)
- [API 文档](docs/API.md)

## License

MIT License - see [LICENSE](LICENSE) for details.
