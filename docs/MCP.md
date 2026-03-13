# CLI Switch MCP 配置指南

## 什么是 MCP

MCP (Model Context Protocol) 是一种标准化的协议，用于扩展 AI 模型的能力。通过 MCP，AI 模型可以访问外部工具和服务。

## 支持的 MCP Server

### 智谱视觉理解 MCP (`zai-mcp-server`)

提供 8 个视觉相关工具：

| 工具 | 说明 |
|------|------|
| `ui_to_artifact` | UI 截图转代码/提示词/设计规范 |
| `extract_text_from_screenshot` | OCR 文字提取 |
| `diagnose_error_screenshot` | 错误截图诊断 |
| `understand_technical_diagram` | 技术图表理解 |
| `analyze_data_visualization` | 数据可视化分析 |
| `ui_diff_check` | UI 差异对比 |
| `image_analysis` | 通用图像分析 |
| `video_analysis` | 视频分析 |

### 智谱 Web Search MCP

提供网页搜索能力。

### 智谱 Web Reader MCP

提供网页读取能力。

## 快速开始

### 安装智谱视觉 MCP

```bash
# 方法 1: 使用 CLI 命令（推荐）
cli-switch mcp install-zai

# 方法 2: 指定 API Key
cli-switch mcp install-zai your_api_key_here

# 方法 3: 使用环境变量
export Z_AI_API_KEY="your_api_key"
cli-switch mcp install-zai
```

### 启用 Web Search 权限

```bash
cli-switch mcp enable-web-search
```

### 启用 Web Reader 权限

```bash
cli-switch mcp enable-web-reader
```

## MCP 命令

### 列出已配置的 MCP Server

```bash
cli-switch mcp list
```

输出示例：
```
已配置的 MCP Server:
  - zai-mcp-server: npx -y @z_ai/mcp-server
```

### 显示 MCP Server 详情

```bash
cli-switch mcp show zai-mcp-server
```

输出示例：
```
MCP Server: zai-mcp-server
  类型：stdio
  命令：npx
  参数：-y @z_ai/mcp-server
  环境变量:
    Z_AI_API_KEY=******
    Z_AI_MODE=ZHIPU
  可用工具 (8 个):
    - ui_to_artifact: UI 截图转代码/提示词/设计规范
    - extract_text_from_screenshot: OCR 文字提取
    - diagnose_error_screenshot: 错误截图诊断
    - understand_technical_diagram: 技术图表理解
    - analyze_data_visualization: 数据可视化分析
    - ui_diff_check: UI 差异对比
    - image_analysis: 通用图像分析
    - video_analysis: 视频分析
```

### 添加 MCP Server

```bash
# 添加预设配置
cli-switch mcp add zai-mcp-server

# 或手动指定配置（需要修改源码）
```

### 移除 MCP Server

```bash
cli-switch mcp remove zai-mcp-server
```

## 配置文件位置

MCP Server 配置保存在：
- macOS: `~/.claude/settings.json`
- Linux: `~/.claude/settings.json`

Web Search/Web Reader 权限配置保存在：
- macOS: `~/.claude/settings.local.json`
- Linux: `~/.claude/settings.local.json`

## 配置示例

### settings.json

```json
{
  "mcpServers": {
    "zai-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@z_ai/mcp-server"],
      "env": {
        "Z_AI_API_KEY": "your_api_key",
        "Z_AI_MODE": "ZHIPU"
      }
    }
  }
}
```

### settings.local.json

```json
{
  "permissions": {
    "https://mcp.z.ai/web-search": {
      "enabled": true
    },
    "https://mcp.z.ai/web-reader": {
      "enabled": true
    }
  }
}
```

## Python API

```python
from cli_switch import MCPManager

# 创建管理器
manager = MCPManager()

# 列出已配置的 Server
servers = manager.list_servers()
for server in servers:
    print(f"{server.name}: {server.command}")

# 安装智谱 MCP
success, message = manager.install_zai_mcp("your_api_key")
if success:
    print(message)

# 启用 Web Search 权限
success, message = manager.enable_web_search()

# 获取 Server 详情
info = manager.show_server_info("zai-mcp-server")
print(info)

# 获取工具列表
tools = manager.get_tools("zai-mcp-server")
for tool_name, description in tools.items():
    print(f"{tool_name}: {description}")
```

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `Z_AI_API_KEY` | 智谱 API 密钥 |
| `Z_AI_MODE` | API 模式（ZHIPU 或其他） |

## 常见问题

### Q: 安装 MCP Server 后需要重启 Claude Code 吗？

A: 是的，需要重启 Claude Code 才能加载新的 MCP Server 配置。

### Q: 如何获取智谱 API Key？

A: 访问智谱 AI 开放平台 (https://open.bigmodel.cn) 注册并创建 API Key。

### Q: MCP Server 不工作怎么办？

A: 按以下步骤排查：
1. 检查 API Key 是否正确配置
2. 检查网络连接是否正常
3. 运行 `cli-switch mcp show zai-mcp-server` 查看配置
4. 尝试重启 Claude Code

### Q: 如何备份 MCP 配置？

A: 每次修改配置时，系统会自动创建备份文件：
- `settings.json.bak`
- `settings.local.json.bak`

可以手动复制这些文件进行备份。

## 相关资源

- [智谱 AI 开放平台](https://open.bigmodel.cn)
- [智谱 MCP Server NPM 包](https://www.npmjs.com/package/@z_ai/mcp-server)
