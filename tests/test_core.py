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
        """测试模型总数"""
        self.assertEqual(self.registry.count(), 15)

    def test_claude_models(self):
        """测试 Claude 模型数量"""
        count = self.registry.count(ToolType.CLAUDE)
        self.assertGreater(count, 0)

    def test_gemini_models(self):
        """测试 Gemini 模型数量"""
        count = self.registry.count(ToolType.GEMINI)
        self.assertEqual(count, 2)

    def test_codex_models(self):
        """测试 Codex 模型数量"""
        count = self.registry.count(ToolType.CODEX)
        self.assertEqual(count, 2)

    def test_get_model(self):
        """测试获取模型"""
        model = self.registry.get("qwen")
        self.assertIsNotNone(model)
        self.assertEqual(model.name, "Qwen3.5+")
        self.assertEqual(model.tool, ToolType.CLAUDE)

    def test_model_exists(self):
        """测试模型是否存在"""
        self.assertTrue(self.registry.exists("qwen"))
        self.assertFalse(self.registry.exists("nonexistent"))

    def test_list_models(self):
        """测试列出模型"""
        all_models = self.registry.list()
        self.assertEqual(len(all_models), 15)


class TestConfig(unittest.TestCase):
    """测试配置管理"""

    def setUp(self):
        self.config = Config()

    def test_default_config(self):
        """测试默认配置"""
        data = self.config.load()
        self.assertEqual(self.config.active_tool, "claude")
        self.assertEqual(self.config.active_model, "qwen")

    def test_get_set(self):
        """测试配置读写"""
        self.config.set("test.key", "value")
        self.assertEqual(self.config.get("test.key"), "value")

    def test_timeout_config(self):
        """测试超时配置"""
        self.assertGreater(self.config.connect_timeout, 0)
        self.assertGreater(self.config.response_timeout, 0)


class TestModel(unittest.TestCase):
    """测试模型类"""

    def test_to_dict(self):
        """测试模型转字典"""
        model = Model(
            key="test",
            name="Test Model",
            tool=ToolType.CLAUDE,
            model_id="test-id",
            description="Test description"
        )
        d = model.to_dict()
        self.assertEqual(d["key"], "test")
        self.assertEqual(d["name"], "Test Model")
        self.assertEqual(d["tool"], "claude")
        self.assertEqual(d["model_id"], "test-id")


if __name__ == "__main__":
    unittest.main(verbosity=2)
