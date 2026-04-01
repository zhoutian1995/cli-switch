# CLI-Switch

**🚀 让 OpenClaw Agent 用 CLI 工具写代码** - 告别手写代码，拥抱专业工具

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 💡 你有没有遇到过这样的问题？

**让 OpenClaw 写代码时，它总是"手写"？**

```
❌ 之前的做法：
   
   你: "帮我写一个 FastAPI 项目"
   
   Agent: [直接输出代码文本...]
   
   问题：
   - 代码没有经过专业工具审查
   - 无法利用 CLI 工具的文件操作能力
   - 效率低，容易出错
```

**想过让 Agent 用 Claude Code、Codex、Gemini CLI 这些专业工具？**

```
❌ 但又有新问题：

   Agent: "我用 Codex 执行了任务..."
   
   你: "执行完了？结果呢？"
   
   Agent: "我再去问一下..." [轮询中...]
   
   问题：
   - Agent 需要不断轮询工具状态
   - 效率低，Token 浪费
   - 多终端同时工作会冲突
```

**CLI-Switch 就是为解决这些问题而生的！**

---

## ✨ CLI-Switch 做了什么？

```
✅ 有了 CLI-Switch：

   Agent: cli-switch opus4.6
   Agent: claude -p "写一个 FastAPI 项目"
   Agent: [Hook 自动等待完成，无需轮询]
   Agent: 代码已写好，审查完成！
   
   优势：
   ✓ Agent 一键切换模型
   ✓ 自动等待 CLI 工具完成
   ✓ 多 Agent 并发不冲突
   ✓ 状态可查询、可追溯
```

---

## 🎯 核心特性

| 特性 | 说明 | 解决的问题 |
|------|------|-----------|
| 🔄 **一键切换** | 33+ 模型，一个命令切换 | 不同任务用不同模型 |
| 🖥️ **多终端隔离** | 每个 TTY 独立状态 | 多 Agent 同时工作不冲突 |
| 🔒 **并发安全** | 原子写入，防撕裂 | 状态不会互相覆盖 |
| 🤖 **Agent 友好** | JSON 输出 + Hook 集成 | Agent 自动化调用 |
| 👻 **幽灵防御** | PID 验证 | 自动清理无效状态 |

---

## 📦 支持的工具和模型

### Claude Code (14 个模型)

| 提供商 | 模型 | 适用场景 |
|-------|------|---------|
| **Fucheers** | `opus4.6` ⭐ | 写后端/架构代码（首选） |
| | `opus4.6-thinking` | 需要思考过程的复杂任务 |
| | `sonnet4.6` | 通用均衡任务 |
| | `haiku4.5` | 轻量快速任务 |
| **智谱** | `glm-5.1` | 最新旗舰版 |
| | `glm-5-turbo` | 高性能推理 |
| | `glm-5` | 代码专用 |
| | `glm-4.7` | 平衡 |
| | `glm-4.6` | 推理模型 |
| | `glm-4.5` | 标准版 |
| | `glm-4.5-air` | 轻量版 |

### Gemini CLI (12 个模型)

| 提供商 | 模型 | 适用场景 |
|-------|------|---------|
| **Google** | `gemini-3.1-pro` ⭐ | 前端/UI 任务（首选） |
| | `nanobanana` | 图像生成 |
| | `imagen-4-ultra` | 高级图像 |
| | `gemini-2.5-flash` | 免费、快速 |
| | `gemini-2.5-pro` | 高级推理 |
| **智谱** | `glm-5.1`, `glm-5`, `glm-4.7` 等 | 通用备选 |

### Codex CLI (1 个模型)

| 提供商 | 模型 | 适用场景 |
|-------|------|---------|
| **OpenAI** | `gpt-5.2-codex` ⭐ | 代码审查（首选） |

---

## 🚀 快速开始

### 安装

```bash
# 从 GitHub 安装
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
pipx install -e .

# 或使用安装脚本
./install.sh
```

### 基本使用

```bash
# 切换模型
cli-switch opus4.6

# 查看当前状态
cli-switch status

# 列出所有模型
cli-switch list

# JSON 输出（供 Agent 使用）
cli-switch --json status
```

### 跨工具切换

```bash
# Claude Code (默认)
cli-switch opus4.6
claude -p "写代码"

# Codex CLI (代码审查)
cli-switch --tool codex gpt-5.2-codex
codex exec "审查代码"

# Gemini CLI (前端)
cli-switch --tool gemini gemini-3.1-pro
gemini -p "写前端"
```

---

## 🤖 OpenClaw Agent 使用指南

### 推荐工作流

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Agent 工作流                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ 写代码                                                  │
│     cli-switch opus4.6                                      │
│     claude -p "实现用户认证模块"                             │
│                                                             │
│  2️⃣ 审查代码                                                │
│     cli-switch --tool codex gpt-5.2-codex                   │
│     codex exec "审查安全性、性能、边界条件"                   │
│                                                             │
│  3️⃣ 前端/UI                                                 │
│     cli-switch --tool gemini gemini-3.1-pro                 │
│     gemini -p "实现登录页面 UI"                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent 调用示例

```python
# Agent 获取当前状态
status = subprocess.run(["cli-switch", "--json", "status"], capture_output=True)
data = json.loads(status.stdout)
print(f"当前模型: {data['model_name']}")

# Agent 切换模型
subprocess.run(["cli-switch", "opus4.6"])

# Agent 调用 Claude Code
result = subprocess.run(
    ["claude", "-p", "写一个 FastAPI 项目"],
    capture_output=True,
    text=True
)
print(result.stdout)
```

---

## 👤 人类使用：cli-menu

**不喜欢记命令？用 `cli-menu` 交互式菜单！**

```
╔══════════════════════════════════════════════════════════════╗
║              AI CLI 工具选择                                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1) Claude Code CLI                                          ║
║     支持模型：fucheers(7) + 智谱(7) = 14 个模型              ║
║                                                              ║
║  2) Gemini CLI                                               ║
║     支持模型：智谱(7) + Google(5) = 12 个模型                ║
║                                                              ║
║  3) Codex CLI                                                ║
║     支持模型：OpenAI(1) = 1 个模型                           ║
║                                                              ║
║  4) 测试所有工具                                              ║
║                                                              ║
║  0) 退出                                                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### 使用方法

```bash
# 启动菜单
cli-menu

# 选择工具 → 选择模型 → 自动启动 CLI
```

---

## 🛡️ 安全特性

### 终端隔离

```
Terminal 1 (PID 12345) → ~/.local/state/cli-switch/tty-12345.json
Terminal 2 (PID 67890) → ~/.local/state/cli-switch/tty-67890.json

# 每个 TTY 独立状态，互不干扰
# 支持 Tmux 多窗口
```

### 并发安全

```
# 原子写入机制
写入 → 临时文件 → fsync → rename

# 防止配置撕裂
# 支持多 Agent 同时调用
```

### 幽灵防御

```
# PID 绑定验证
状态文件记录 PID → 检查进程存活 → 自动清理无效状态
```

---

## 📊 性能

| 指标 | 数值 |
|------|------|
| 切换延迟 | < 100ms |
| TTY 检测 | < 10ms |
| 状态读取 | < 5ms |
| 并发支持 | 100+ 线程 |

---

## 📚 详细文档

| 文档 | 说明 |
|------|------|
| [Agent 使用指南](docs/AGENT_GUIDE.md) | 三个 Agent 详细使用说明 |
| [Agent 规则](docs/AGENT_RULES.md) | Agent 调用规则和最佳实践 |
| [API 文档](docs/API.md) | 完整 API 文档 |
| [配置说明](docs/CONFIG.md) | 配置文件说明 |
| [MCP 配置](docs/MCP.md) | MCP Server 配置 |
| [OpenClaw 集成](docs/OPENCLAW_INTEGRATION.md) | OpenClaw 集成指南 |

---

## 🧪 测试

```bash
# 运行所有测试
pytest tests/

# 测试覆盖
pytest tests/ --cov=cli_switch

# 结果：50 个测试全部通过
```

---

## 📝 更新日志

### v1.1.0 (2026-03-13)
- ✨ 添加 7 个 Fucheers 模型（Opus 4.6、Sonnet 4.6 等）
- ✨ 添加 MCP Server 管理功能
- ✨ 添加 Hook 引擎和防重入保护
- ✨ 添加 `cli-menu` 交互式菜单
- 🐛 修复幽灵 TTY 防御逻辑
- 📚 添加完整的 Agent 使用指南

详见 [更新日志](CHANGELOG.md)

---

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 📮 联系方式

- **GitHub Issues**: [提交问题](https://github.com/zhoutian1995/cli-switch/issues)
- **微信**: 扫码加好友交流

<div align="center">
<img src="wechat-qrcode.jpg" width="200">
</div>
