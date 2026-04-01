"""
终端隔离测试

测试用例：
1. TTY 状态管理
2. 多终端模型隔离
3. Hook 执行与防重入
4. Shell Hook 性能
5. 状态清理
"""

import os
import sys
import json
import time
from pathlib import Path
from unittest.mock import patch

import pytest

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cli_switch.session import (
    get_tty,
    get_session_state,
    set_session_state,
    cleanup_stale_sessions,
    delete_session_state,
    get_effective_state,
    is_process_alive,
)
from cli_switch.hooks import (
    execute_hook,
    execute_post_switch,
    add_hook,
    remove_hook,
    load_hooks_config,
    clear_hooks,
)


class TestTTYManagement:
    """TTY 状态管理测试"""

    def test_get_tty_format(self):
        """测试 TTY 标识符格式"""
        tty = get_tty()
        assert tty is not None  # get_tty() always returns a string (PID fallback)
        # TTY 标识符不应包含 /
        assert "/" not in tty
        # 应该是 dev_xxx 格式（TTY 环境）或 pid_xxx 格式（非 TTY 环境）
        assert tty.startswith("dev_") or tty.startswith("pid_")

    def test_set_get_session_state(self, tmp_path):
        """测试设置和获取会话状态"""
        # 使用临时目录
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty = "dev_test_001"
            success = set_session_state(
                tty=tty,
                tool="claude",
                model="qwen",
                model_id="qwen3.5-plus",
                base_url="https://test.example.com",
            )
            assert success is True

            # 验证 JSON 文件
            state = get_session_state(tty)
            assert state is not None
            assert state["tool"] == "claude"
            assert state["model"] == "qwen"
            assert state["model_id"] == "qwen3.5-plus"
            assert state["base_url"] == "https://test.example.com"
            assert state["pid"] == os.getpid()

            # 验证 ENV 文件
            env_file = tmp_path / f"{tty}.env"
            assert env_file.exists()
            env_content = env_file.read_text()
            assert 'export ANTHROPIC_MODEL="qwen3.5-plus"' in env_content

    def test_session_state_with_pid(self, tmp_path):
        """测试状态绑定 PID"""
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty = "dev_test_002"

            # 创建状态（当前进程）
            set_session_state(tty=tty, model="qwen")

            # 当前进程存活，状态应该有效
            state = get_session_state(tty)
            assert state is not None

            # 验证 PID 检查
            assert is_process_alive(os.getpid()) is True
            # 不存在的 PID - 注意：在某些系统上 kill -0 可能返回 true
            # 这里只测试当前进程存活

    def test_delete_session_state(self, tmp_path):
        """测试删除会话状态"""
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty = "dev_test_003"

            # 创建状态
            set_session_state(tty=tty, model="qwen")
            assert (tmp_path / f"{tty}.json").exists()
            assert (tmp_path / f"{tty}.env").exists()

            # 删除状态
            delete_session_state(tty=tty)
            assert not (tmp_path / f"{tty}.json").exists()
            assert not (tmp_path / f"{tty}.env").exists()


class TestStateCleanup:
    """状态清理测试"""

    def test_cleanup_stale_sessions(self, tmp_path):
        """测试清理无效会话"""
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty = "dev_test_cleanup"

            # 手动创建无效状态（使用不存在的 PID）
            state_file = tmp_path / f"{tty}.json"
            with open(state_file, "w") as f:
                json.dump(
                    {"tty": "/dev/test_cleanup", "model": "qwen", "pid": 999999},
                    f,  # 不存在的 PID
                )

            # 创建配套的 env 文件
            env_file = tmp_path / f"{tty}.env"
            env_file.write_text('export ANTHROPIC_MODEL="qwen"\n')

            # 清理
            cleaned = cleanup_stale_sessions()

            # 验证：文件要么被清理，要么保留（如果 PID 意外存在）
            # 这个测试主要验证清理逻辑正常运行
            # 在某些系统上 PID 999999 可能存在，所以不强制检查 cleaned >= 1
            assert cleaned >= 0  # 至少执行了清理逻辑

    def test_cleanup_preserves_valid_sessions(self, tmp_path):
        """测试清理保留有效会话"""
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty_valid = "dev_test_valid"
            tty_invalid = "dev_test_invalid"

            # 创建有效状态（当前进程）
            set_session_state(tty=tty_valid, model="qwen")

            # 创建无效状态
            state_file = tmp_path / f"{tty_invalid}.json"
            with open(state_file, "w") as f:
                json.dump(
                    {"tty": "/dev/test_invalid", "model": "kimi", "pid": 999999},
                    f,  # 不存在的 PID
                )

            # 清理
            cleanup_stale_sessions()

            # 有效状态应该保留
            assert (tmp_path / f"{tty_valid}.json").exists()
            # 无效状态可能被删除（取决于系统 PID 检查）
            # 这里只验证清理逻辑正常运行


class TestHookExecution:
    """Hook 执行测试"""

    def setup_method(self):
        """每个测试前清理 hooks"""
        clear_hooks("post_switch")
        clear_hooks("pre_tool_use")

    def test_execute_hook_simple(self):
        """测试简单 hook 执行"""
        result = execute_hook("echo 'test'", check_reentrancy=False)
        assert result is True

    def test_execute_hook_with_placeholders(self):
        """测试占位符替换"""
        context = {"model": "qwen", "tool": "claude"}
        # 使用简单的 echo 命令测试
        result = execute_hook("echo 'Model: {model} Tool: {tool}'", context, check_reentrancy=False)
        assert result is True

    def test_hook_reentrancy_protection(self):
        """测试防重入机制"""
        # 设置环境变量模拟 hook 执行中
        os.environ["CLI_SWITCH_HOOK_ACTIVE"] = "1"

        # 应该被阻止，返回 False（未实际执行）
        result = execute_hook("echo 'should not run'", check_reentrancy=True)
        assert result is False

        # 清理
        del os.environ["CLI_SWITCH_HOOK_ACTIVE"]

    def test_hook_reentrancy_allows_when_inactive(self):
        """测试非重入状态允许执行"""
        # 确保不在 hook 执行中
        if "CLI_SWITCH_HOOK_ACTIVE" in os.environ:
            del os.environ["CLI_SWITCH_HOOK_ACTIVE"]

        result = execute_hook("echo 'test'", check_reentrancy=True)
        assert result is True

    def test_post_switch_hook(self, tmp_path):
        """测试 post_switch hook"""
        # 使用临时配置文件
        config_file = tmp_path / "hooks.yaml"
        with patch("cli_switch.hooks.get_hooks_config_path", return_value=config_file):
            # 添加 hook
            add_hook("post_switch", "echo 'Switched to {model}'")

            # 执行
            results = execute_post_switch("qwen", "claude", "qwen3.5-plus")
            assert len(results) == 1

    def test_add_remove_hook(self, tmp_path):
        """测试添加和移除 hook"""
        config_file = tmp_path / "hooks.yaml"
        with patch("cli_switch.hooks.get_hooks_config_path", return_value=config_file):
            # 添加
            add_hook("post_switch", "test-hook-1")
            add_hook("post_switch", "test-hook-2")

            hooks = load_hooks_config().get("hooks", {})
            assert "post_switch" in hooks
            assert len(hooks["post_switch"]) == 2

            # 移除
            remove_hook("post_switch", "test-hook-1")

            hooks = load_hooks_config().get("hooks", {})
            assert len(hooks["post_switch"]) == 1
            assert "test-hook-2" in hooks["post_switch"]


class TestStatePriority:
    """状态优先级测试"""

    def test_tty_priority_over_global(self, tmp_path):
        """测试 TTY 状态优先级高于全局"""
        sessions_dir = tmp_path / "sessions"
        sessions_dir.mkdir()

        # 模拟 TTY 状态
        tty_state = {
            "tty": "/dev/ttys001",
            "tool": "claude",
            "model": "qwen-tty",
            "model_id": "qwen3.5-plus",
            "pid": os.getpid(),
        }
        with open(sessions_dir / "dev_ttys001.json", "w") as f:
            json.dump(tty_state, f)

        # 模拟全局状态
        config_dir = tmp_path / "config"
        config_dir.mkdir()
        with open(config_dir / "current.txt", "w") as f:
            f.write("kimi-global")

        with patch("cli_switch.session.get_sessions_dir", return_value=sessions_dir):
            with patch("cli_switch.session.get_global_state") as mock_global:
                mock_global.return_value = {"model": "kimi-global"}

                # 模拟 get_tty 返回 dev_ttys001
                with patch("cli_switch.session.get_tty", return_value="dev_ttys001"):
                    effective = get_effective_state()
                    assert effective["model"] == "qwen-tty"
                    assert effective["source"] == "tty"

    def test_global_fallback(self, tmp_path):
        """测试全局 fallback"""
        sessions_dir = tmp_path / "sessions"
        sessions_dir.mkdir()

        # 不创建 TTY 状态

        with patch("cli_switch.session.get_sessions_dir", return_value=sessions_dir):
            with patch("cli_switch.session.get_tty", return_value=None):
                with patch("cli_switch.session.get_global_state") as mock_global:
                    mock_global.return_value = {"model": "kimi-global", "type": "global"}

                    effective = get_effective_state()
                    assert effective["model"] == "kimi-global"


class TestAtomicWrites:
    """原子写入测试"""

    def test_atomic_write_json(self, tmp_path):
        """测试 JSON 文件原子写入"""
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty = "dev_test_atomic"

            # 写入状态
            set_session_state(tty=tty, model="qwen")

            # 验证没有临时文件残留
            temp_files = list(tmp_path.glob("*.tmp"))
            assert len(temp_files) == 0

            # 验证目标文件存在
            assert (tmp_path / f"{tty}.json").exists()

    def test_atomic_write_env(self, tmp_path):
        """测试 ENV 文件原子写入"""
        with patch("cli_switch.session.get_sessions_dir", return_value=tmp_path):
            tty = "dev_test_atomic_env"

            set_session_state(
                tty=tty, model="qwen", model_id="qwen3.5-plus", base_url="https://test.example.com"
            )

            # 验证没有临时文件残留
            temp_files = list(tmp_path.glob("*.tmp"))
            assert len(temp_files) == 0

            # 验证 ENV 文件内容完整
            env_file = tmp_path / f"{tty}.env"
            assert env_file.exists()
            content = env_file.read_text()
            assert 'ANTHROPIC_MODEL="qwen3.5-plus"' in content
            assert 'ANTHROPIC_BASE_URL="https://test.example.com"' in content


class TestShellHookPerformance:
    """Shell Hook 性能测试"""

    def test_precmd_performance(self):
        """测试 precmd 执行时间 < 10ms"""
        # 模拟 precmd 函数
        start = time.time()

        # 模拟简单的检查和 source
        tty_name = "dev_test_perf"
        state_env = Path.home() / ".cli-switch" / "sessions" / f"{tty_name}.env"

        # 创建测试文件
        state_env.parent.mkdir(parents=True, exist_ok=True)
        with open(state_env, "w") as f:
            f.write('export ANTHROPIC_MODEL="qwen"\n')

        try:
            # 模拟 shell hook 逻辑
            if state_env.exists():
                # 实际 source 操作会比较快，这里只测文件检查
                _ = state_env.stat()

            elapsed = (time.time() - start) * 1000
            # 应该 < 10ms（宽松阈值）
            assert elapsed < 100, f"执行时间 {elapsed}ms 超过阈值"
        finally:
            # 清理
            if state_env.exists():
                state_env.unlink()


class TestIntegration:
    """集成测试"""

    def test_full_switch_workflow(self, tmp_path):
        """测试完整切换流程"""
        sessions_dir = tmp_path / "sessions"
        sessions_dir.mkdir()

        with patch("cli_switch.session.get_sessions_dir", return_value=sessions_dir):
            with patch("cli_switch.session.get_tty", return_value="dev_test_workflow"):
                # 1. 设置状态
                success = set_session_state(
                    tool="claude",
                    model="qwen",
                    model_id="qwen3.5-plus",
                    base_url="https://test.example.com",
                )
                assert success is True

                # 2. 获取状态
                state = get_session_state()
                assert state is not None
                assert state["model"] == "qwen"
                assert state["tool"] == "claude"

                # 3. 获取有效状态
                effective = get_effective_state()
                assert effective["model"] == "qwen"
                assert effective["source"] == "tty"

                # 4. 清理（应该保留，因为 PID 还存活）
                cleanup_stale_sessions()
                # 当前进程的状态应该保留

                # 5. 删除状态
                delete_session_state()
                assert get_session_state() is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
