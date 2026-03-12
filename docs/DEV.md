# CLI Switch 开发笔记

## 项目结构

```
~/projects/cli-switch/
├── README.md                 # 项目说明
├── LICENSE                   # MIT 许可证
├── pyproject.toml            # Python 项目配置
├── requirements.txt          # 依赖列表
├── .gitignore               # Git 忽略文件
│
├── src/cli_switch/           # Python 包
│   ├── __init__.py          # 包入口，版本号
│   ├── __main__.py          # 命令行入口
│   ├── main.py              # 主入口，命令行解析
│   ├── config.py            # 配置管理
│   ├── models.py            # 模型定义
│   └── switcher.py          # 切换逻辑
│
├── scripts/cli-menu          # Bash 菜单前端
├── config/default_models.yaml # 默认模型配置
├── tests/                    # 单元测试
│   ├── test_core.py         # 核心功能测试
│   ├── test_models.py       # 模型切换测试
│   └── test_all_models.py   # 完整测试
└── docs/                     # 文档
    ├── USAGE.md             # 使用指南
    ├── CONFIG.md            # 配置说明
    └── API.md               # API 文档
```

## 安装与开发

### 安装依赖

```bash
cd ~/projects/cli-switch
pip install -e .
```

### 开发模式

```bash
pip install -e ".[dev]"
```

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_core.py -v

# 查看覆盖率
pytest --cov=cli_switch --cov-report=html
```

### 代码格式化

```bash
# 格式化代码
black src/ tests/

# 检查代码质量
ruff check src/ tests/
```

## 模型配置

### 已配置的 15 个模型

#### 百炼模型 (8 个)
- qwen, kimi, glm, minimax
- qwen-max, qwen-coder, qwen-coder-next, glm47

#### 智谱模型 (2 个)
- glm47-zhipu, glm5-zhipu

#### Fucheers 模型 (1 个)
- opus4.6

#### Gemini 模型 (2 个)
- gemini-2.5-pro, nanobanana

#### Codex 模型 (2 个)
- gpt-5.2-codex, gpt-5.4-codex

## 命令行用法

```bash
# 切换模型
cli-switch qwen

# 列出模型
cli-switch list

# 查看状态
cli-switch status

# 测试模型
cli-switch test
cli-switch test qwen

# 配置管理
cli-switch config show
cli-switch tool claude

# 交互式菜单
cli-menu
```

## 发布流程

### 发布到 PyPI

1. 更新版本号 (`pyproject.toml` 和 `__init__.py`)
2. 构建包: `pip install build && python -m build`
3. 上传：`pip install twine && twine upload dist/*`

### 创建 GitHub Release

1. 打标签：`git tag v1.0.0 && git push origin v1.0.0`
2. 在 GitHub 创建 Release

## 已知问题

1. 测试脚本需要 cli-switch 已安装
2. Gemini 和 Codex 模型切换需要对应 CLI 工具已安装

## 下一步计划

- [ ] 添加更多单元测试
- [ ] 完善错误处理
- [ ] 添加日志功能
- [ ] 支持更多模型提供商
- [ ] 创建 Homebrew 配方
