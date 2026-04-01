#!/usr/bin/env python3
"""单元测试 - 验证核心功能"""

import sys
import unittest
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cli_switch.models import ModelRegistry, ToolType, Model
from cli_switch.config import Config


class TestModelRegistry(unittest.TestCase):
    """测试模型注册表"""

    def setUp(self):
        self.registry = ModelRegistry()

    def test_total_models(self):
        """测试模型总数 (7 个智谱 + 7 个 Fucheers + 5 个 Google + 1 个 OpenAI = 20)"""
        self.assertEqual(self.registry.count(), 20)

    def test_claude_models(self):
        """测试 Claude 模型数量 (7 个智谱 + 7 个 Fucheers = 14)"""
        count = self.registry.count(ToolType.CLAUDE)
        self.assertEqual(count, 14)

    def test_gemini_models(self):
        """测试 Gemini 模型数量 (7 个智谱 + 5 个 Google = 12)"""
        count = self.registry.count(ToolType.GEMINI)
        self.assertEqual(count, 12)

    def test_codex_models(self):
        """测试 Codex 模型数量 (1 个 OpenAI = 1)"""
        count = self.registry.count(ToolType.CODEX)
        self.assertEqual(count, 1)

    def test_get_model(self):
        """测试获取模型"""
        model = self.registry.get("opus4.6")
        self.assertIsNotNone(model)
        self.assertEqual(model.name, "Opus 4.6")
        self.assertEqual(model.tool, ToolType.CLAUDE)

    def test_model_exists(self):
        """测试模型是否存在"""
        self.assertTrue(self.registry.exists("opus4.6"))
        self.assertFalse(self.registry.exists("nonexistent"))

    def test_list_models(self):
        """测试列出模型"""
        all_models = self.registry.list()
        self.assertEqual(len(all_models), 20)


class TestConfig(unittest.TestCase):
    """测试配置管理"""

    def setUp(self):
        self.config = Config()

    def test_default_config(self):
        """测试默认配置"""
        data = self.config.load()
        self.assertEqual(self.config.active_tool, "claude")
        self.assertEqual(self.config.active_model, "opus4.6")

    def test_get_set(self):
        """测试配置读写"""
        self.config.set("test.key", "value")
        self.assertEqual(self.config.get("test.key"), "value")

    def test_timeout_config(self):
        """测试超时配置"""
        self.assertGreater(self.config.connect_timeout, 0)
        self.assertGreater(self.config.response_timeout, 0)


class TestCustomModels(unittest.TestCase):
    """测试自定义模型管理"""

    def setUp(self):
        self.registry = ModelRegistry()
        self.test_key = "__test_custom__"
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        """清理测试模型"""
        ModelRegistry.remove_custom_model(self.test_key)

    def test_add_custom_model(self):
        """测试添加自定义模型"""
        data = {
            "name": "Test Custom Model",
            "tool": "claude",
            "model_id": "test-custom-id",
            "description": "For testing",
            "base_url": "http://localhost:8080/v1",
            "api_key_env": "TEST_KEY",
        }
        success = ModelRegistry.add_custom_model(self.test_key, data)
        self.assertTrue(success)

        # 验证可以加载
        config = ModelRegistry.load_custom_models()
        self.assertIn(self.test_key, config.get("models", {}))

    def test_remove_custom_model(self):
        """测试删除自定义模型"""
        # 先添加
        ModelRegistry.add_custom_model(
            self.test_key, {"name": "To Remove", "tool": "claude", "model_id": "remove-id"}
        )
        # 再删除
        success = ModelRegistry.remove_custom_model(self.test_key)
        self.assertTrue(success)

        # 验证已删除
        config = ModelRegistry.load_custom_models()
        self.assertNotIn(self.test_key, config.get("models", {}))

    def test_custom_model_override_builtin(self):
        """测试自定义模型覆盖内置模型"""
        # 使用内置模型的 key 添加自定义配置
        override_key = "opus4.6"
        original_model = self.registry.get(override_key)
        self.assertIsNotNone(original_model)

        # 添加覆盖配置
        ModelRegistry.add_custom_model(
            override_key,
            {
                "name": "Overridden Opus",
                "tool": "claude",
                "model_id": "overridden-opus",
                "description": "Custom override",
            },
        )

        # 重新创建 registry 加载自定义配置
        new_registry = ModelRegistry()
        model = new_registry.get(override_key)

        self.assertIsNotNone(model)
        self.assertEqual(model.name, "Overridden Opus")
        self.assertEqual(model.source, "custom")

        # 清理
        ModelRegistry.remove_custom_model(override_key)

    def test_custom_model_source_tag(self):
        """测试模型来源标记"""
        # 添加自定义模型
        ModelRegistry.add_custom_model(
            self.test_key, {"name": "Source Test", "tool": "claude", "model_id": "source-test"}
        )

        # 重新加载
        new_registry = ModelRegistry()
        model = new_registry.get(self.test_key)

        self.assertIsNotNone(model)
        self.assertEqual(model.source, "custom")

        # 内置模型检查
        builtin = new_registry.get("opus4.6")
        self.assertEqual(builtin.source, "builtin")


class TestModel(unittest.TestCase):
    """测试模型类"""

    def test_to_dict(self):
        """测试模型转字典"""
        model = Model(
            key="test",
            name="Test Model",
            tool=ToolType.CLAUDE,
            model_id="test-id",
            description="Test description",
        )
        d = model.to_dict()
        self.assertEqual(d["key"], "test")
        self.assertEqual(d["name"], "Test Model")
        self.assertEqual(d["tool"], "claude")
        self.assertEqual(d["model_id"], "test-id")


if __name__ == "__main__":
    unittest.main(verbosity=2)
