# cli-switch 测试方案

> 文档版本: 1.0 | 更新日期: 2026-03-13

## 1. 测试目标

确保 cli-switch 在以下场景下的正确性和稳定性：

1. **模型切换**: 所有 33 个工具-模型组合正确切换
2. **配置持久化**: settings.json 写入不损坏、不丢失数据
3. **图片生成**: 双引擎（Imagen 4 Ultra + nanobanana）正常工作
4. **Bug 回归**: 已知 Bug 修复后不再复发
5. **错误处理**: API 错误、网络异常、配置缺失等场景优雅降级

## 2. 测试范围

### 2.1 模型矩阵（33 个工具-模型组合）

| 工具 | 模型数 | 模型 Keys |
|---|---|---|
| **Claude** | 17 | qwen, qwen-max, qwen-next, qwen-coder, minimax, glm, glm47, kimi, glm47-zhipu, glm5-zhipu, opus4.6, opus4.6-thinking, opus4.5-20251101, opus4.5-20251101-thinking, sonnet4.6, sonnet4.6-thinking, haiku4.5-20251001 |
| **Gemini** | 6 | gemini-3.1-pro, nanobanana, gemini-2.5-flash, gemini-2.5-pro, glm47-zhipu, glm5-zhipu |
| **Codex** | 9 | qwen, qwen-max, qwen-next, qwen-coder, minimax, glm, glm47, kimi, gpt-5.2-codex |
| **Image** | 2 | nanobanana, imagen-4-ultra |

> 注: glm47-zhipu 和 glm5-zhipu 同时支持 Claude 和 Gemini 工具

### 2.2 测试类型分布

| 测试类型 | 数量 | 目的 |
|---|---|---|
| 单元测试 | 50+ | 验证独立函数/类的行为 |
| 集成测试 | 20+ | 验证模块间交互 |
| 端到端测试 | 33 | 验证真实 API 调用 |
| 回归测试 | 4 | 验证已知 Bug 修复 |
| 边界测试 | 10+ | 验证异常输入处理 |

## 3. 测试用例

### 3.1 单元测试 (tests/test_core.py)

```
TestModelRegistry
├── test_total_models          # 模型总数 = 23
├── test_claude_models         # Claude 模型数 = 17
├── test_gemini_models         # Gemini 模型数 = 6
├── test_codex_models          # Codex 模型数 = 9
├── test_get_model             # 获取单个模型
├── test_model_exists          # 模型存在性检查
└── test_list_models           # 列出所有模型

TestConfig
├── test_default_config        # 默认配置加载
├── test_get_set               # 配置读写
└── test_timeout_config        # 超时配置

TestCustomModels
├── test_add_custom_model      # 添加自定义模型
├── test_remove_custom_model   # 删除自定义模型
├── test_custom_model_override_builtin  # 覆盖内置模型
└── test_custom_model_source_tag  # 模型来源标记

TestModel
└── test_to_dict               # 模型序列化
```

### 3.2 集成测试 (tests/test_comprehensive.py)

```
TestModelSwitching
├── test_switch_to_claude_model     # 切换到 Claude 模型
├── test_switch_to_gemini_model     # 切换到 Gemini 模型
├── test_switch_to_codex_model      # 切换到 Codex 模型
├── test_switch_invalid_model       # 切换到无效模型
└── test_switch_preserves_other_settings  # 切换不影响其他配置

TestConfigurationPersistence
├── test_settings_json_integrity    # settings.json 写入后可解析
├── test_concurrent_write_protection  # 并发写入保护
└── test_settings_rollback_on_error # 错误时回滚配置

TestImageGeneration
├── test_imagen_generation          # Imagen 4 Ultra 生成图片
├── test_nanobanana_generation      # nanobanana 生成图片
├── test_image_fallback             # Imagen 失败时降级到 nanobanana
└── test_image_error_handling       # API 错误处理
```

### 3.3 端到端测试 (tests/test_e2e.py)

**核心原则**: 必须真正发送请求并验证模型身份，而非仅测试网络连通性。

```
TestClaudeE2E
├── test_claude_qwen_identity       # "你是什么模型？" → 包含 "qwen" 或 "Qwen"
├── test_claude_opus46_identity     # → 包含 "opus" 或 "Claude"
├── test_claude_sonnet46_identity   # → 包含 "sonnet" 或 "Claude"
└── ... (17 个 Claude 模型)

TestGeminiE2E
├── test_gemini_native_identity     # → 包含 "Gemini" 或 "gemini"
├── test_gemini_zhipu_identity      # → 包含 "GLM" 或 "智谱"
└── ... (6 个 Gemini 模型)

TestCodexE2E
├── test_codex_qwen_identity        # → 包含 "qwen" 或 "Qwen"
├── test_codex_gpt52_identity       # → 包含 "GPT" 或 "gpt"
└── ... (9 个 Codex 模型)

TestImageE2E
├── test_imagen_generate_image      # 生成图片并保存
├── test_nanobanana_generate_image  # 生成图片并保存
└── test_image_contains_expected_content  # 验证图片内容
```

**端到端测试模板**:
```python
def test_claude_model_identity(self):
    """验证模型身份：发送 '你是什么模型？' 并检查响应"""
    result = switcher.switch("claude", "qwen")
    self.assertTrue(result[0])
    
    # 发送真实请求
    response = send_chat_message("你是什么模型？")
    
    # 验证响应包含预期关键词
    self.assertIn_any(["qwen", "Qwen", "千问", "通义"], response.lower())
```

### 3.4 回归测试 (tests/test_regression.py)

```
Bug #1: hooks.py clear_hooks 返回值
├── test_clear_hooks_empty_config     # hooks 不存在时返回 True
├── test_clear_hooks_existing_type    # 清空已存在的 hooks
└── test_clear_hooks_preserves_others # 清空不影响其他 hook 类型

Bug #2: mcp.py 浅拷贝污染类变量
├── test_mcp_no_class_variable_pollution  # install_zai_mcp 不污染类变量
├── test_mcp_multiple_install             # 多次安装使用不同 API key
└── test_mcp_env_isolation                # 每次调用使用独立的 env 副本

Bug #3: switcher.py TOML regex 静默失败
├── test_toml_add_model_when_missing   # model 行不存在时自动添加
├── test_toml_update_model_when_exists # model 行存在时更新
└── test_toml_roundtrip                # 写入后再读取保持一致

Bug #4: test_core.py 硬编码模型计数
├── test_model_count_matches_yaml      # 计数与 YAML 定义一致
└── test_model_count_after_add_imagen  # 添加 imagen 后计数正确
```

### 3.5 边界测试 (tests/test_edge_cases.py)

```
TestEdgeCases
├── test_empty_prompt                 # 空 prompt 处理
├── test_very_long_prompt             # 超长 prompt 处理
├── test_special_characters_in_prompt # 特殊字符处理
├── test_unicode_prompt               # Unicode/中文 prompt
├── test_missing_api_key              # API key 缺失
├── test_invalid_api_key              # API key 无效
├── test_rate_limit                   # API 限流
├── test_network_timeout              # 网络超时
├── test_malformed_response           # 响应格式异常
└── test_concurrent_requests          # 并发请求
```

## 4. 测试执行

### 4.1 本地执行

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_core.py -v
pytest tests/test_e2e.py -v

# 运行特定测试类
pytest tests/test_core.py::TestModelRegistry -v

# 运行特定测试用例
pytest tests/test_core.py::TestModelRegistry::test_total_models -v

# 生成覆盖率报告
pytest tests/ --cov=cli_switch --cov-report=html
```

### 4.2 CI/CD 执行 (GitHub Actions)

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -e ".[dev]"
      - run: pytest tests/ -v --tb=short
```

### 4.3 测试环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Python | >= 3.12 | 运行时 |
| pytest | >= 8.0 | 测试框架 |
| pytest-cov | >= 5.0 | 覆盖率 |
| requests | >= 2.31 | HTTP 请求 |
| PyYAML | >= 6.0 | YAML 解析 |

### 4.4 环境变量配置

端到端测试需要以下环境变量：

```bash
# 必需
export ZHIPU_AUTH_TOKEN="your_key"
export GEMINI_API_KEY="your_key"
export OPENAI_API_KEY="your_key"
export ANTHROPIC_API_KEY="your_key"

# 可选（用于 Imagen）
export GOOGLE_CLOUD_PROJECT="your_project"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

## 5. 测试数据

### 5.1 测试 Fixtures (tests/conftest.py)

```python
@pytest.fixture
def registry():
    """提供干净的模型注册表"""
    return ModelRegistry()

@pytest.fixture
def temp_settings(tmp_path):
    """提供临时 settings.json"""
    settings_file = tmp_path / "settings.json"
    settings_file.write_text('{"active_tool": "claude"}')
    return settings_file

@pytest.fixture
def mock_api_response():
    """模拟 API 响应"""
    return {
        "candidates": [{
            "content": {
                "parts": [{"text": "我是 Qwen 模型"}]
            }
        }]
    }
```

### 5.2 测试模型

使用专用测试模型或 API 的 sandbox 环境避免产生费用：

- 智谱: 使用测试 API key（配额受限）
- 智谱: 使用 sandbox endpoint
- Gemini: 使用免费层级
- OpenAI: 使用测试项目

## 6. 已知问题与限制

### 6.1 已修复 Bug

| Bug ID | 文件 | 问题描述 | 修复版本 |
|---|---|---|---|
| BUG-001 | hooks.py:295 | clear_hooks 返回 False 当 hooks 不存在 | 1.1.0 |
| BUG-002 | mcp.py:173 | 浅拷贝污染类变量 ZAI_MCP_SERVER["env"] | 1.1.0 |
| BUG-003 | switcher.py:189 | TOML regex 静默失败不添加 model 行 | 1.1.0 |
| BUG-004 | test_core.py:23 | 硬编码模型计数 22 | 1.1.0 |

### 6.2 当前限制

1. **API 费用**: 端到端测试会产生实际 API 调用费用
2. **并发限制**: 部分模型有 rate limit，需控制并发数
3. **网络依赖**: 端到端测试需要稳定网络连接
4. **凭证管理**: 测试凭证不应提交到代码库

## 7. 测试报告

### 7.1 期望结果

| 测试类型 | 期望通过率 | 备注 |
|---|---|---|
| 单元测试 | 100% | 无外部依赖 |
| 集成测试 | 100% | Mock 外部服务 |
| 端到端测试 | 95%+ | 允许偶发网络问题 |
| 回归测试 | 100% | Bug 修复验证 |

### 7.2 报告输出

```bash
# 生成 JUnit XML 报告
pytest tests/ --junitxml=report.xml

# 生成 HTML 报告
pytest tests/ --html=report.html --self-contained-html

# 生成覆盖率报告
pytest tests/ --cov=cli_switch --cov-report=xml --cov-report=html
```

## 8. 维护指南

### 8.1 新增模型时

1. 在 `default_models.yaml` 添加模型定义
2. 更新 `test_core.py` 中的模型计数
3. 添加对应的端到端测试用例
4. 运行完整测试套件验证

### 8.2 新增功能时

1. 添加对应的单元测试
2. 添加集成测试验证与其他模块的交互
3. 更新本文档

### 8.3 Bug 修复时

1. 先添加失败测试用例（复现 Bug）
2. 修复 Bug
3. 确认测试通过
4. 在本文档"已修复 Bug"表格中记录

---

## 附录

### A. 测试命令速查

```bash
# 快速验证
pytest tests/test_core.py -v

# 完整测试
pytest tests/ -v

# 覆盖率
pytest tests/ --cov=cli_switch --cov-report=term-missing

# 仅运行 E2E
pytest tests/test_e2e.py -v -m e2e

# 跳过慢速测试
pytest tests/ -v -m "not slow"
```

### B. 相关文档

- [README.md](../README.md) - 项目介绍
- [CONTRIBUTING.md](../CONTRIBUTING.md) - 贡献指南
- [docs/USAGE.md](../docs/USAGE.md) - 使用文档