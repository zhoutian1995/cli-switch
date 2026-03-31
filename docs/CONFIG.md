# CLI Switch 配置说明

## 配置文件位置

配置文件使用 YAML 格式，位置如下：

| 系统 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/cli-switch/config.yaml` |
| Linux | `~/.config/cli-switch/config.yaml` |
| Windows | `%APPDATA%/cli-switch/config.yaml` |

## 配置项说明

### 全局配置

```yaml
# 当前激活的工具 (claude/gemini/codex)
active_tool: claude

# 当前激活的模型
active_model: qwen
```

### 测试配置

```yaml
test:
  # 连接超时时间（秒）
  connect_timeout: 5
  # 响应超时时间（秒）
  response_timeout: 30
```

### 日志配置

```yaml
log:
  # 日志级别 (DEBUG/INFO/WARNING/ERROR)
  level: INFO
  # 日志文件路径
  path: ~/.local/share/cli-switch/logs
```

### 模型配置

```yaml
models:
  glm5-zhipu:
    name: "GLM-5"
    tool: claude
    model_id: "glm-5"
    base_url: "https://open.bigmodel.cn/api/anthropic"
    api_key_env: "ZHIPU_AUTH_TOKEN"
    description: "智谱 GLM-5 大语言模型"
    tags: ["zhipu", "recommended"]
```

#### 模型配置字段

| 字段 | 说明 | 必填 |
|------|------|------|
| `name` | 模型显示名称 | 是 |
| `tool` | 目标工具 (claude/gemini/codex) | 是 |
| `model_id` | 实际使用的模型 ID | 是 |
| `base_url` | API 端点 URL | 否 |
| `api_key_env` | API 密钥的环境变量名 | 否 |
| `description` | 模型描述 | 否 |
| `tags` | 标签列表 | 否 |

## 自定义模型

在配置文件中添加自定义模型：

```yaml
models:
  my-custom-model:
    name: "My Custom Model"
    tool: claude
    model_id: "custom-model-id"
    base_url: "https://api.example.com/anthropic"
    api_key_env: "MY_API_KEY"
    description: "自定义模型"
    tags: ["custom"]
```

## 配置文件备份

每次修改配置文件时，系统会自动创建备份文件：
- `config.yaml.bak` - 上一次配置备份

## 配置验证

运行以下命令验证配置：

```bash
# 显示当前配置
cli-switch config show

# 列出所有模型（包括自定义）
cli-switch list
```
