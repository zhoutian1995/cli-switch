# CLI-Switch

🚀 **专业的 AI CLI 工具模型切换器** - 支持 Claude Code、Gemini CLI、Codex CLI 的多终端隔离切换

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests: 50 passed](https://img.shields.io/badge/tests-50%20passed-brightgreen)]()

## ✨ 核心特性

- 🔄 **智能切换** - 一键切换 AI 模型，支持 Claude Code、Gemini CLI、Codex CLI
- 🖥️ **多终端隔离** - 每个 TTY 独立状态，Tmux 友好
- 🔒 **并发安全** - 原子写入，防撕裂保护
- 👻 **幽灵防御** - PID 验证，防止状态泄露
- 🎯 **跨工具支持** - Codex 支持百炼 8 个模型，Gemini 支持智谱 2 个模型
- 🤖 **Agent 友好** - JSON 输出，便于 AI Agent 调用
- 🛡️ **防重入保护** - Hook 引擎防止死循环

## 📦 支持的工具和模型

### Claude Code (17 个模型)
| 提供商 | 模型 | 说明 |
|-------|------|------|
| 百炼 | `qwen`, `qwen-max`, `qwen-coder`, `qwen-next`, `glm`, `glm47`, `kimi`, `minimax` | 8 个模型 |
| 智谱 | `glm47-zhipu`, `glm5-zhipu` | 2 个模型 |
| Fucheers | `opus4.6`, `opus4.6-thinking`, `opus4.5-20251101`, `opus4.5-20251101-thinking`, `sonnet4.6`, `sonnet4.6-thinking`, `haiku4.5-20251001` | 7 个模型 |

### Gemini CLI (7 个模型)
| 提供商 | 模型 | 说明 |
|-------|------|------|
| 智谱 | `glm47-zhipu`, `glm5-zhipu` | 2 个模型 |
| Google | `gemini-3.1-pro`, `nanobanana`, `imagen-4-ultra`, `gemini-2.5-flash`, `gemini-2.5-pro` | 5 个模型 |

### Codex CLI (9 个模型)
| 提供商 | 模型 | 说明 |
|-------|------|------|
| 百炼 | `qwen`, `qwen-max`, `qwen-coder`, `qwen-next`, `glm`, `glm47`, `kimi`, `minimax` | 8 个模型 |
| OpenAI | `gpt-5.2-codex` | 1 个模型 |

## 🚀 快速开始

### 安装

```bash
# 从源码安装
cd ~/projects/cli-switch
pipx install -e .

# 或使用安装脚本
./install.sh
```

### 基本使用

```bash
# 切换模型
cli-switch qwen

# 查看状态
cli-switch status

# 列出所有模型
cli-switch list

# JSON 输出（供 Agent 使用）
cli-switch --json status
```

### 跨工具切换

```bash
# Claude Code (默认)
cli-switch qwen

# Gemini CLI
cli-switch --tool gemini glm5-zhipu

# Codex CLI
cli-switch --tool codex qwen-coder
```

## 🤖 OpenClaw Agent 集成

为您的三个 Agent 提供智能模型切换能力：

### 安装 Agent 配置

```bash
# 运行安装脚本
./install.sh

# 三个 Agent 自动配置完成：
# - Team Lead: ~/.claude/skills/openclaw-teamlead
# - Codex Reviewer: ~/.claude/skills/openclaw-codex-reviewer
# - Gemini Reviewer: ~/.claude/skills/openclaw-gemini-reviewer
```

### Agent 使用示例

#### Team Lead
```bash
# 任务开始
cli-switch qwen

# 分配任务...

# 审查阶段
cli-switch --tool codex qwen-coder
cli-switch --tool gemini gemini-3.1-pro

# 汇总结果
cli-switch status
```

#### Codex Reviewer
```bash
# 确保使用 Codex 工具
cli-switch --tool codex qwen-coder

# 执行代码审查
cat code.txt | codex exec "Review for bugs, security, performance"
```

#### Gemini Reviewer
```bash
# 切换到 Gemini 工具
cli-switch --tool gemini gemini-3.1-pro

# 执行架构审查
cat architecture.txt | gemini -p "Review architecture and design"
```

详见 [Agent 使用指南](docs/AGENT_GUIDE.md)

## 📚 详细文档

- [📖 文档索引](docs/README.md) - 完整文档导航
- [Agent 使用指南](docs/AGENT_GUIDE.md) - 三个 Agent 详细使用说明
- [OpenClaw 集成](docs/OPENCLAW_INTEGRATION.md) - OpenClaw 集成指南
- [API 文档](docs/API.md) - 完整 API 文档
- [配置说明](docs/CONFIG.md) - 配置文件说明
- [MCP 配置](docs/MCP.md) - MCP Server 配置

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
pytest tests/

# 运行完整测试套件
python3 -m pytest tests/ -v

# 测试覆盖
pytest tests/ --cov=cli_switch
```

### 测试结果

```
✅ 50 个测试全部通过
- 模型注册表与 YAML 外部化：5 个测试
- 终端隔离与并发防撕裂：3 个测试
- Shell 钩子性能：2 个测试
- Hook 引擎与防重入：2 个测试
- 其他核心功能：38 个测试
```

详见 [测试报告](tests/TEST_REPORT.md)

## 🔧 开发

### 环境设置

```bash
# 克隆仓库
git clone https://github.com/anomalyco/cli-switch.git
cd cli-switch

# 安装开发依赖
pip install -e ".[dev]"

# 运行代码质量检查
ruff check src/
mypy src/

# 格式化代码
black src/
```

### 项目结构

```
cli-switch/
├── src/cli_switch/          # 源代码
│   ├── models.py            # 模型注册表
│   ├── switcher.py          # 切换逻辑
│   ├── session.py           # TTY 状态管理
│   ├── hooks.py             # Hook 引擎
│   ├── main.py              # CLI 入口
│   └── default_models.yaml  # 内置模型配置
├── tests/                   # 测试文件
│   ├── test_core.py         # 核心测试
│   ├── test_comprehensive.py # 完整测试套件
│   └── test_terminal_isolation.py # 终端隔离测试
├── docs/                    # 文档
│   ├── README.md            # 文档索引
│   ├── AGENT_GUIDE.md       # Agent 使用指南
│   └── OPENCLAW_INTEGRATION.md # OpenClaw 集成
├── agent_skills/            # Agent Skills
│   └── openclaw/
│       └── skill.json       # OpenClaw Skill 定义
├── examples/                # 示例
│   └── integrations/
│       └── claude-code-hooks.json
├── SKILL.md                 # Claude Code Skill 定义
├── install.sh               # 安装脚本
├── README.md                # 本文件
└── pyproject.toml           # 项目配置
```

## 🎯 使用场景

### 场景 1: 多模型协作
```bash
# 开发代码
cli-switch qwen-coder
# 写代码...

# 代码审查
cli-switch --tool codex qwen-coder
# Codex 审查...

# 架构评审
cli-switch --tool gemini gemini-3.1-pro
# Gemini 评审...
```

### 场景 2: 多终端工作
```bash
# Terminal 1: Claude Code
cli-switch qwen
claude

# Terminal 2: Codex CLI
cli-switch --tool codex qwen-coder
codex

# Terminal 3: Gemini CLI
cli-switch --tool gemini gemini-3.1-pro
gemini
```

### 场景 3: Agent 自动化
```bash
# Agent 检测环境
STATUS=$(cli-switch --json status)

# Agent 解析状态
MODEL=$(echo $STATUS | jq -r '.active_model')

# Agent 智能切换
cli-switch $APPROPRIATE_MODEL
```

## 🛡️ 安全特性

### 终端隔离
- 每个 TTY 独立状态文件
- 不会互相干扰
- 支持 Tmux 多窗口

### 并发安全
- 原子写入（临时文件 + 重命名）
- 防止配置撕裂
- 支持多 Agent 并发调用

### 幽灵防御
- PID 绑定验证
- 检测进程存活
- 自动清理无效状态

### 防重入保护
- 环境变量标志
- 防止 Hook 死循环
- 静默退出机制

## 📊 性能

- **切换延迟**: < 100ms
- **TTY 检测**: < 10ms
- **状态读取**: < 5ms
- **并发支持**: 100+ 线程

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)

### 贡献方式
- 🐛 提交 Bug 报告
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复

## 📝 更新日志

### v1.1.0 (2026-03-13)
- ✨ 添加 7 个 Fucheers 模型
- ✨ 添加 MCP Server 管理功能
- ✨ 添加 Hook 引擎和防重入保护
- 🐛 修复幽灵 TTY 防御逻辑
- 📚 添加完整的 Agent 使用指南
- 🧪 添加完整测试套件（50 个测试）

详见 [更新日志](CHANGELOG.md)

### v1.0.0 (2026-03-10)
- 🎉 初始发布
- ✨ 支持 Claude Code、Gemini CLI、Codex CLI
- ✨ 多终端隔离
- ✨ 并发安全

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 👥 作者

**OpenClaw Team**

## 🙏 致谢

- [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview)
- [Codex CLI](https://github.com/openai/codex)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [AI-Pair](https://github.com/axtonliu/ai-pair) - 灵感来源

## 📮 联系方式

- GitHub Issues: [提交问题](https://github.com/anomalyco/cli-switch/issues)
- 企业微信：OpenClaw Team 群

---

**Made with ❤️ for OpenClaw Team**
