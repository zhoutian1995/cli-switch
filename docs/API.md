# CLI Switch API 文档

## Python API

### 导入模块

```python
from cli_switch import Model, ModelRegistry, Config, Switcher
```

### ModelRegistry - 模型注册表

```python
from cli_switch import ModelRegistry, ToolType

# 创建注册表
registry = ModelRegistry()

# 获取模型
model = registry.get("qwen")

# 列出所有模型
all_models = registry.list()

# 按工具类型列出模型
claude_models = registry.list(ToolType.CLAUDE)
gemini_models = registry.list(ToolType.GEMINI)
codex_models = registry.list(ToolType.CODEX)

# 检查模型是否存在
exists = registry.exists("qwen")

# 获取模型数量
count = registry.count()
claude_count = registry.count(ToolType.CLAUDE)
```

### Model - 模型类

```python
from cli_switch import Model, ToolType

# 创建模型
model = Model(
    key="glm5-zhipu",
    name="GLM-5",
    tool=ToolType.CLAUDE,
    model_id="glm-5",
    description="智谱 GLM-5 大语言模型",
    base_url="https://open.bigmodel.cn/api/anthropic",
    api_key_env="ZHIPU_AUTH_TOKEN",
    tags=["zhipu", "recommended"]
)

# 转换为字典
model_dict = model.to_dict()
```

### Config - 配置管理

```python
from cli_switch import Config
from pathlib import Path

# 使用默认配置路径
config = Config()

# 使用自定义配置路径
config = Config(Path("/path/to/config.yaml"))

# 加载配置
config_data = config.load()

# 保存配置
config.save()

# 获取配置值
active_tool = config.active_tool
active_model = config.active_model
timeout = config.connect_timeout

# 设置配置值
config.active_tool = "gemini"
config.active_model = "gemini-2.5-pro"
config.set("custom.key", "value")
```

### Switcher - 切换器

```python
from cli_switch import Config, ModelRegistry, Switcher

# 初始化
config = Config()
config.load()
registry = ModelRegistry()
switcher = Switcher(config)

# 切换模型
model = registry.get("qwen")
success, message = switcher.switch(model)

if success:
    print(f"切换成功：{message}")
else:
    print(f"切换失败：{message}")

# 获取当前模型
current = switcher.get_current()
```

## 命令行调用

### 在脚本中调用

```python
from cli_switch.main import main

# 切换到指定模型
main(["qwen"])

# 列出所有模型
main(["list"])

# 测试模型
main(["test"])
main(["test", "qwen"])

# JSON 格式输出
main(["--json", "list"])
```

### 使用 subprocess

```python
import subprocess
import json

# 列出模型
result = subprocess.run(
    ["cli-switch", "list", "--json"],
    capture_output=True,
    text=True
)
models = json.loads(result.stdout)

# 切换模型
result = subprocess.run(
    ["cli-switch", "qwen"],
    capture_output=True,
    text=True
)
print(result.stdout)
```

## ToolType 枚举

```python
from cli_switch import ToolType

print(ToolType.CLAUDE.value)    # "claude"
print(ToolType.GEMINI.value)    # "gemini"
print(ToolType.CODEX.value)     # "codex"
```

## 异常处理

```python
from cli_switch import ConfigError, SwitchError

try:
    config = Config()
    config.load()
except ConfigError as e:
    print(f"配置错误：{e}")

try:
    switcher = Switcher(config)
    success, message = switcher.switch(model)
    if not success:
        raise SwitchError(message)
except SwitchError as e:
    print(f"切换错误：{e}")
```
