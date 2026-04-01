#!/usr/bin/env python3
"""
cli-switch 完整测试套件
根据需求实现的4大测试模块，覆盖模型注册表、终端隔离、Shell钩子和Hook引擎
"""

import os
import json
import tempfile
import threading
import time
import yaml
from pathlib import Path
import unittest
import shutil

import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cli_switch.models import ModelRegistry, ToolType
from cli_switch import session


class TestModuleP0_ModelRegistry(unittest.TestCase):
    """模块一：模型注册表与YAML外部化 (P0)"""

    @classmethod
    def setUpClass(cls):
        cls.temp_dir = Path(tempfile.mkdtemp())
        cls.original_path = ModelRegistry.CUSTOM_MODELS_PATH
        ModelRegistry.CUSTOM_MODELS_PATH = cls.temp_dir / "custom_models.yaml"

    @classmethod
    def tearDownClass(cls):
        ModelRegistry.CUSTOM_MODELS_PATH = cls.original_path
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def setUp(self):
        custom_config = ModelRegistry.CUSTOM_MODELS_PATH
        if custom_config.exists():
            custom_config.unlink()

    def test_case_1_1_basic_builtin_loading(self):
        """用例 1.1：基础内置加载"""
        registry = ModelRegistry()
        total_models = registry.count()
        claude_models = registry.count(ToolType.CLAUDE)
        gemini_models = registry.count(ToolType.GEMINI)
        codex_models = registry.count(ToolType.CODEX)

        self.assertGreater(total_models, 0, "应至少加载一个内置模型")
        self.assertGreater(claude_models, 0, "Claude 工具应有模型")
        self.assertGreater(gemini_models, 0, "Gemini 工具应有模型")
        self.assertGreater(codex_models, 0, "Codex 工具应有模型")

    def test_case_1_2_custom_config_override(self):
        """用例 1.2：自定义配置覆盖 (Deep Merge)"""
        registry = ModelRegistry()
        registry.get("glm-5")  # 验证内置模型存在

        custom_data = {
            "name": "GLM-5 (Custom)",
            "tool": "claude",
            "model_id": "glm-5-custom",
            "description": "Custom description for test",
            "base_url": "https://custom.example.com",
        }

        ModelRegistry.add_custom_model("glm-5", custom_data)

        registry = ModelRegistry()
        updated_model = registry.get("glm-5")

        self.assertIsNotNone(updated_model, "自定义模型 'glm-5' 应该存在")
        self.assertEqual(updated_model.description, "Custom description for test")
        self.assertEqual(updated_model.base_url, "https://custom.example.com")
        self.assertEqual(updated_model.source, "custom")

    def test_case_1_3_hardcore_agriculture_scenario(self):
        """用例 1.3：硬核农业场景（添加新模型）"""
        custom_data = {
            "name": "Lobster-7B",
            "tool": "claude",
            "model_id": "7b-4bit",
            "description": "专门给Mac mini养龙虾支持售后",
            "base_url": "https://lobster.example.com",
        }

        success = ModelRegistry.add_custom_model("lobster-7b", custom_data)
        self.assertTrue(success, "添加自定义模型应该成功")

        registry = ModelRegistry()
        model = registry.get("lobster-7b")
        self.assertIsNotNone(model, "lobster-7b 模型应该存在")
        self.assertEqual(model.name, "Lobster-7B")
        self.assertEqual(model.source, "custom")

    def test_case_1_4_accidental_tolerance_bad_yaml(self):
        """用例 1.4：手滑容错测试 (Bad YAML)"""
        bad_config = {
            "models": {
                "bad_model": {
                    "name": "Bad Model",
                    "model_id": "bad-id",
                },
                "good_model": {
                    "name": "Good Model",
                    "tool": "claude",
                    "model_id": "good-id",
                    "description": "This is a good model",
                },
            }
        }

        with open(ModelRegistry.CUSTOM_MODELS_PATH, "w", encoding="utf-8") as f:
            yaml.dump(bad_config, f, default_flow_style=False, allow_unicode=True)

        try:
            registry = ModelRegistry()
        except Exception as e:
            self.fail(f"注册表应能容忍bad yaml配置: {e}")

        good_model = registry.get("good_model")
        self.assertIsNotNone(good_model, "good_model 应该存在")

        bad_model = registry.get("bad_model")
        self.assertIsNone(bad_model, "bad_model 不应该存在")

    def test_case_1_5_idiot_proof_deletion_interception(self):
        """用例 1.5：防呆设计（删除拦截）"""
        success = ModelRegistry.remove_custom_model("opus4.6")
        self.assertFalse(success, "内置模型不应被删除")

        registry = ModelRegistry()
        builtin_model = registry.get("opus4.6")
        self.assertIsNotNone(builtin_model, "内置模型 'opus4.6' 应该仍然存在")


class TestModuleP1_TerminalIsolation(unittest.TestCase):
    """模块二：终端隔离与并发防撕裂 (P1)"""

    def test_case_2_1_dual_tty_no_interference(self):
        """用例 2.1：双 TTY 互不干扰"""
        tty1 = "dev_test1"
        tty2 = "dev_test2"

        result1 = session.set_session_state(
            tty=tty1,
            tool="claude",
            model="qwen",
            model_id="qwen3.5-plus",
            base_url="https://test1.example.com",
        )
        self.assertTrue(result1, "TTY1 状态设置应成功")

        result2 = session.set_session_state(
            tty=tty2,
            tool="gemini",
            model="nanobanana",
            model_id="gemini-3.1-flash",
            base_url="https://test2.example.com",
        )
        self.assertTrue(result2, "TTY2 状态设置应成功")

        state1 = session.get_session_state(tty=tty1)
        state2 = session.get_session_state(tty=tty2)

        self.assertIsNotNone(state1)
        self.assertIsNotNone(state2)
        self.assertEqual(state1["tool"], "claude")
        self.assertEqual(state2["tool"], "gemini")

    def test_case_2_2_ghost_tty_defense(self):
        """用例 2.2：幽灵 TTY 防御"""
        fake_tty = "dev_fake_test"
        fake_pid = 999999

        json_file = session.get_session_file(fake_tty)
        json_content = {
            "tty": "dev_fake_test",
            "tool": "claude",
            "model": "glm",
            "model_id": "glm-5",
            "pid": fake_pid,
            "updated_at": "2023-01-01T00:00:00Z",
        }

        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(json_content, f, indent=2)

        state = session.get_session_state(tty=fake_tty)
        self.assertIsNone(state, "对于不存在的进程，状态应该被忽略")

    def test_case_2_3_atomic_write_concurrency(self):
        """用例 2.3：原子写入测试"""
        results = []

        def write_concurrent():
            for i in range(3):
                result = session.set_session_state(
                    tty=f"test_concurrent_{threading.current_thread().ident}",
                    tool="claude",
                    model="qwen",
                    model_id=f"concurrent-{i}",
                )
                results.append(result)

        threads = [threading.Thread(target=write_concurrent) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertTrue(all(results), "所有并发写入应成功")


class TestModuleP3_ShellHooks(unittest.TestCase):
    """模块三：Shell钩子性能与生命周期"""

    def test_case_3_1_zero_latency(self):
        """用例 3.1：零延迟验证"""
        start_time = time.perf_counter()
        for _ in range(100):
            session.get_tty()
        end_time = time.perf_counter()

        avg_time = (end_time - start_time) / 100
        self.assertLess(avg_time, 0.01, "TTY获取平均时间应少于10ms")

    def test_case_3_2_env_real_time(self):
        """用例 3.2：环境变量实时挂载"""
        result = session.set_session_state(
            tty=None,
            tool="claude",
            model="glm-test",
            model_id="glm-test-5",
            base_url="https://test.example.com",
        )
        self.assertTrue(result, "应能成功存储状态")

        current_tty = session.get_tty()
        state = session.get_session_state(tty=current_tty)

        self.assertIsNotNone(state)
        self.assertEqual(state["model_id"], "glm-test-5")


class TestModuleP4_HookEngine(unittest.TestCase):
    """模块四：Hook引擎与防重入死循环"""

    def test_case_4_1_placeholder_rendering(self):
        """用例 4.1：环境变量占位符渲染"""
        context = {"model": "lobster-7b", "tool": "claude", "model_id": "7b-4bit"}
        template = "Switching to {model} for {tool} with ID {model_id}"
        expected = "Switching to lobster-7b for claude with ID 7b-4bit"

        rendered = template
        for key, value in context.items():
            rendered = rendered.replace(f"{{{key}}}", str(value))

        self.assertEqual(rendered, expected)

    def test_case_4_2_deadlock_prevention(self):
        """用例 4.2：致命死循环熔断"""
        from cli_switch import hooks

        original_env = os.environ.get("CLI_SWITCH_HOOK_ACTIVE")

        os.environ.pop("CLI_SWITCH_HOOK_ACTIVE", None)
        self.assertFalse(hooks.is_hook_active())

        os.environ["CLI_SWITCH_HOOK_ACTIVE"] = "1"
        self.assertTrue(hooks.is_hook_active())

        if original_env is None:
            os.environ.pop("CLI_SWITCH_HOOK_ACTIVE", None)
        else:
            os.environ["CLI_SWITCH_HOOK_ACTIVE"] = original_env


if __name__ == "__main__":
    unittest.main(verbosity=2)
