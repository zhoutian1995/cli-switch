# CLI Switch 使用指南

## 安装

### 从 PyPI 安装

```bash
pip install cli-switch
```

### 从源码安装

```bash
git clone https://github.com/anomalyco/cli-switch.git
cd cli-switch
pip install -e .
```

### 开发安装

```bash
pip install -e ".[dev]"
```

## 基本用法

### 切换模型

```bash
# 切换到指定模型
cli-switch qwen

# 使用 switch 子命令
cli-switch switch qwen

# JSON 格式输出
cli-switch --json qwen
```

### 列出模型

```bash
# 列出所有模型
cli-switch list

# 按工具分类列出
cli-switch list --json

# 显示当前工具
cli-switch status
```

### 测试模型

```bash
# 测试所有模型
cli-switch test

# 测试单个模型
cli-switch test qwen

# 指定超时时间
cli-switch test --timeout 60

# JSON 格式输出
cli-switch test --json
```

### 配置管理

```bash
# 显示当前配置
cli-switch config show

# 编辑配置文件
cli-switch config edit

# 选择目标工具
cli-switch tool claude
cli-switch tool gemini
cli-switch tool codex
```

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--version, -v` | 显示版本号 |
| `--help, -h` | 显示帮助信息 |
| `--json, -j` | JSON 格式输出 |
| `--config, -c` | 自定义配置文件路径 |
| `--timeout, -t` | 测试超时时间（秒） |

## 使用交互式菜单

```bash
# 启动交互式菜单
cli-menu

# 带参数直接切换
cli-menu qwen
```

## 配置文件

配置文件位置:
- macOS: `~/Library/Application Support/cli-switch/config.yaml`
- Linux: `~/.config/cli-switch/config.yaml`

### 配置文件示例

```yaml
active_tool: claude
active_model: qwen

test:
  connect_timeout: 5
  response_timeout: 30

log:
  level: INFO
  path: ~/.local/share/cli-switch/logs

models:
  qwen:
    name: "Qwen3.5+"
    tool: claude
    model_id: "qwen3.5-plus"
    base_url: "https://coding.dashscope.aliyuncs.com/apps/anthropic"
    description: "通义千问 3.5 增强版"
```

## 环境变量

配置 API 密钥的环境变量：

| 变量名 | 说明 |
|--------|------|
| `BAILIAN_API_KEY` | 阿里云百炼 API 密钥 |
| `ZHIPU_API_KEY` | 智谱 API 密钥 |
| `FUCHEERS_API_KEY` | Fucheers API 密钥 |
| `GEMINI_API_KEY` | Google Gemini API 密钥 |

## 退出代码

| 代码 | 说明 |
|------|------|
| 0 | 成功 |
| 1 | 切换失败或模型不存在 |
| 2 | 配置错误 |
