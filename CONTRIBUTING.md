# Contributing to cli-switch

感谢你对 cli-switch 项目感兴趣！我们欢迎所有形式的贡献。

## 如何贡献

### 报告 Bug

1. 在 [GitHub Issues](https://github.com/anomalyco/cli-switch/issues) 中搜索是否已有相同问题
2. 如果没有，创建一个新 issue，包含：
   - 清晰的标题和描述
   - 复现步骤
   - 期望行为 vs 实际行为
   - 环境信息（OS、Python 版本、cli-switch 版本）

### 提交功能建议

- 在 Issues 中使用 `feature` 标签提交你的想法
- 描述使用场景和预期效果

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 编写代码并添加测试
4. 确保所有测试通过：

```bash
pip install -e ".[dev]"
pytest tests/ -v
ruff check src/ tests/
```

5. 提交变更：`git commit -m "feat: your feature description"`
6. 推送分支：`git push origin feature/your-feature`
7. 创建 Pull Request

### Commit 规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

### 开发环境设置

```bash
git clone https://github.com/anomalyco/cli-switch.git
cd cli-switch
pip install -e ".[dev]"
pytest tests/ -v
```

### 代码风格

- 使用 `black` 格式化代码（行宽 100）
- 使用 `ruff` 进行 lint 检查
- 目标 Python 版本：3.8+

### 添加新模型

如果要添加新的模型支持：

1. 在 `src/cli_switch/default_models.yaml` 中添加模型定义
2. 确保 `supported_tools` 字段正确
3. 更新 `tests/test_core.py` 中的模型计数
4. 运行完整测试：`pytest tests/ -v`

## 行为准则

参与本项目即表示你同意遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。

## 许可证

贡献的代码将遵循 [MIT License](LICENSE)。
