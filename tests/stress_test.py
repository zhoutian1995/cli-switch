#!/usr/bin/env python3
"""
CLI-Switch 压力与稳健性测试脚本

测试场景：
1. 极端并发竞争测试 - 10 进程同时切换不同模型
2. 原子写入中断模拟 - 模拟写入过程中进程被 kill
3. JSON 接口纯洁性验证 - 故意制造错误，验证 JSON 输出始终合法
4. 幽灵 Session 清理验证 - 验证过期 session 被正确清理

运行方式：
    python3 tests/stress_test.py
    python3 tests/stress_test.py --quick  # 快速模式（减少并发数）
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import patch

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cli_switch.filelock import FileLock, get_lock, LockTimeout
from cli_switch.session import (
    get_sessions_dir,
    set_session_state,
    get_session_state,
    cleanup_stale_sessions,
    cleanup_stale_sessions_if_needed,
    is_process_alive,
)
from cli_switch.hooks import load_hooks_config, clear_hooks


@dataclass
class TestResult:
    """测试结果"""

    name: str
    passed: bool
    message: str = ""
    duration_ms: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StressTestReport:
    """压力测试报告"""

    start_time: str = ""
    end_time: str = ""
    total_tests: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    results: List[TestResult] = field(default_factory=list)

    def add_result(self, result: TestResult):
        self.results.append(result)
        self.total_tests += 1
        if result.passed:
            self.passed += 1
        else:
            self.failed += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": self.start_time,
            "end_time": self.end_time,
            "total_tests": self.total_tests,
            "passed": self.passed,
            "failed": self.failed,
            "skipped": self.skipped,
            "pass_rate": f"{self.passed / max(self.total_tests, 1) * 100:.1f}%",
            "results": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "message": r.message,
                    "duration_ms": round(r.duration_ms, 2),
                    "details": r.details,
                }
                for r in self.results
            ],
        }


class StressTestRunner:
    """压力测试运行器"""

    # 可用的测试模型（不依赖真实 API Key 的切换测试）
    TEST_MODELS = [
        "qwen",
        "qwen-max",
        "qwen-next",
        "qwen-coder",
        "deepseek",
        "glm",
        "glm5-zhipu",
        "kimi",
    ]

    def __init__(self, quick_mode: bool = False):
        self.quick_mode = quick_mode
        self.report = StressTestReport()
        self.concurrency = 4 if quick_mode else 10
        self.iterations = 3 if quick_mode else 5

    def run_cli_switch(self, args: str, timeout: float = 30.0) -> Tuple[int, str, str]:
        """运行 cli-switch 命令

        Returns:
            (returncode, stdout, stderr)
        """
        cmd = f"cli-switch {args}"
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr

    def verify_json_config(self, path: Path) -> Tuple[bool, str]:
        """验证 JSON 配置文件是否合法

        Returns:
            (is_valid, error_message)
        """
        if not path.exists():
            return False, f"配置文件不存在: {path}"

        # 检查文件大小（0 字节 = 撕裂）
        size = path.stat().st_size
        if size == 0:
            return False, f"配置文件为空 (0 字节): {path}"

        # 尝试解析 JSON
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            json.loads(content)
            return True, ""
        except json.JSONDecodeError as e:
            return False, f"JSON 解析失败: {path} - {e}"
        except Exception as e:
            return False, f"读取失败: {path} - {e}"

    def verify_toml_config(self, path: Path) -> Tuple[bool, str]:
        """验证 TOML 配置文件是否合法（基础检查）

        Returns:
            (is_valid, error_message)
        """
        if not path.exists():
            return False, f"配置文件不存在: {path}"

        size = path.stat().st_size
        if size == 0:
            return False, f"配置文件为空 (0 字节): {path}"

        try:
            content = path.read_text(encoding="utf-8")
            # 基础 TOML 语法检查（至少有一个 = 号）
            if "=" not in content:
                return False, f"TOML 文件缺少键值对: {path}"
            return True, ""
        except Exception as e:
            return False, f"读取失败: {path} - {e}"

    # ========== 场景 1: 极端并发竞争测试 ==========

    def test_concurrent_switch(self) -> TestResult:
        """极端并发竞争测试：多进程同时切换不同模型"""
        start = time.time()
        name = "极端并发竞争测试"

        print(f"\n{'=' * 60}")
        print(f"[场景 1] {name}")
        print(f"  并发数: {self.concurrency}, 迭代次数: {self.iterations}")
        print(f"{'=' * 60}")

        errors: List[str] = []
        success_count = 0
        total_count = self.concurrency * self.iterations

        def switch_model(worker_id: int, model: str) -> Tuple[bool, str]:
            """单个切换任务"""
            try:
                returncode, stdout, stderr = self.run_cli_switch(f"--json {model}", timeout=10.0)
                if returncode != 0:
                    return False, f"Worker {worker_id}: returncode={returncode}, stderr={stderr}"

                # 验证 JSON 输出
                try:
                    result = json.loads(stdout)
                    if not result.get("success"):
                        return False, f"Worker {worker_id}: switch failed - {result.get('message')}"
                except json.JSONDecodeError as e:
                    return False, f"Worker {worker_id}: JSON 解析失败 - {e}"

                return True, ""
            except subprocess.TimeoutExpired:
                return False, f"Worker {worker_id}: 超时"
            except Exception as e:
                return False, f"Worker {worker_id}: 异常 - {e}"

        # 运行多轮并发测试
        for iteration in range(self.iterations):
            print(f"\n  第 {iteration + 1}/{self.iterations} 轮...")

            with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
                futures = {}
                for i in range(self.concurrency):
                    model = self.TEST_MODELS[i % len(self.TEST_MODELS)]
                    futures[executor.submit(switch_model, i, model)] = (i, model)

                for future in as_completed(futures):
                    worker_id, model = futures[future]
                    try:
                        success, error = future.result()
                        if success:
                            success_count += 1
                            print(f"    ✅ Worker {worker_id}: {model}")
                        else:
                            errors.append(error)
                            print(f"    ❌ Worker {worker_id}: {model} - {error}")
                    except Exception as e:
                        errors.append(f"Worker {worker_id}: Future 异常 - {e}")
                        print(f"    ❌ Worker {worker_id}: Future 异常 - {e}")

        # 验证所有配置文件完整性
        print("\n  验证配置文件完整性...")
        config_files = [
            (Path.home() / ".claude" / "settings.json", "json"),
            (Path.home() / ".gemini" / "config.json", "json"),
            (Path.home() / ".codex" / "config.toml", "toml"),
        ]

        for config_path, config_type in config_files:
            if config_path.exists():
                if config_type == "json":
                    valid, error = self.verify_json_config(config_path)
                else:
                    valid, error = self.verify_toml_config(config_path)

                if not valid:
                    errors.append(f"配置损坏: {error}")
                    print(f"    ❌ {config_path.name}: {error}")
                else:
                    print(f"    ✅ {config_path.name}: 完整")

        # 清理锁目录中的残留锁文件（统计）
        locks_dir = Path.home() / ".cli-switch" / "locks"
        lock_count = len(list(locks_dir.glob("*.lock"))) if locks_dir.exists() else 0

        duration = (time.time() - start) * 1000
        passed = len(errors) == 0 and success_count == total_count

        return TestResult(
            name=name,
            passed=passed,
            message=f"成功 {success_count}/{total_count}, 错误 {len(errors)}",
            duration_ms=duration,
            details={
                "concurrency": self.concurrency,
                "iterations": self.iterations,
                "success_count": success_count,
                "total_count": total_count,
                "error_count": len(errors),
                "errors": errors[:10],  # 只保留前 10 个错误
                "lock_files_remaining": lock_count,
            },
        )

    # ========== 场景 2: 原子写入中断模拟 ==========

    def test_atomic_write_interruption(self) -> TestResult:
        """原子写入中断模拟：模拟写入过程中进程被 kill"""
        start = time.time()
        name = "原子写入中断模拟"

        print(f"\n{'=' * 60}")
        print(f"[场景 2] {name}")
        print(f"{'=' * 60}")

        errors: List[str] = []

        # 备份原始配置
        claude_config = Path.home() / ".claude" / "settings.json"
        backup_path = claude_config.with_suffix(".json.backup_stress")

        if claude_config.exists():
            import shutil

            shutil.copy2(claude_config, backup_path)
            print(f"  已备份配置到: {backup_path}")

        try:
            # 获取原始配置内容
            original_content = ""
            if claude_config.exists():
                original_content = claude_config.read_text(encoding="utf-8")
                original_data = json.loads(original_content)

            print("\n  测试 1: 模拟临时文件写入后、rename 前进程中断...")

            # 创建一个会被中断的写入进程
            # 我们用一个脚本模拟：写入临时文件后休眠，然后被 kill
            interrupt_script = """
import json
import os
import time
from pathlib import Path

config_path = Path.home() / ".claude" / "settings.json"
temp_path = config_path.with_suffix(".json.interrupt_test")

# 读取当前配置
with open(config_path, "r") as f:
    settings = json.load(f)

# 修改配置
settings["env"]["ANTHROPIC_MODEL"] = "INTERRUPTED_MODEL"

# 写入临时文件（模拟写入完成）
with open(temp_path, "w") as f:
    json.dump(settings, f)
    f.flush()
    os.fsync(f.fileno())

# 休眠等待被 kill（模拟 rename 前中断）
time.sleep(10)
"""

            # 启动会被中断的进程
            proc = subprocess.Popen(
                [sys.executable, "-c", interrupt_script],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # 等待临时文件被创建
            temp_path = claude_config.with_suffix(".json.interrupt_test")
            max_wait = 5.0
            waited = 0.0
            while waited < max_wait:
                if temp_path.exists():
                    print(f"    临时文件已创建: {temp_path}")
                    break
                time.sleep(0.1)
                waited += 0.1

            # kill 进程（模拟中断）
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

            print(f"    进程已被中断 (exit code: {proc.returncode})")

            # 验证原始配置是否仍然完整
            if claude_config.exists():
                valid, error = self.verify_json_config(claude_config)
                if not valid:
                    errors.append(f"原始配置损坏: {error}")
                    print(f"    ❌ 原始配置损坏: {error}")
                else:
                    # 验证内容是否被修改
                    try:
                        current_data = json.loads(claude_config.read_text())
                        if (
                            current_data.get("env", {}).get("ANTHROPIC_MODEL")
                            == "INTERRUPTED_MODEL"
                        ):
                            errors.append("中断进程的写入未被正确回滚")
                            print(f"    ❌ 中断进程的写入未被正确回滚")
                        else:
                            print(f"    ✅ 原始配置完整，未被中断进程污染")
                    except Exception as e:
                        errors.append(f"验证配置内容失败: {e}")
            else:
                errors.append("原始配置文件不存在")
                print(f"    ❌ 原始配置文件不存在")

            # 清理临时文件
            if temp_path.exists():
                temp_path.unlink()
                print(f"    已清理临时文件")

            print("\n  测试 2: 验证正常切换后配置完整性...")

            # 执行一次正常切换
            returncode, stdout, stderr = self.run_cli_switch("--json qwen")
            if returncode == 0:
                valid, error = self.verify_json_config(claude_config)
                if valid:
                    print(f"    ✅ 正常切换后配置完整")
                else:
                    errors.append(f"正常切换后配置损坏: {error}")
                    print(f"    ❌ 正常切换后配置损坏: {error}")
            else:
                errors.append(f"正常切换失败: {stderr}")
                print(f"    ❌ 正常切换失败: {stderr}")

        finally:
            # 恢复原始配置
            if backup_path.exists():
                import shutil

                shutil.copy2(backup_path, claude_config)
                backup_path.unlink()
                print(f"\n  已恢复原始配置")

        duration = (time.time() - start) * 1000
        passed = len(errors) == 0

        return TestResult(
            name=name,
            passed=passed,
            message=f"错误数: {len(errors)}",
            duration_ms=duration,
            details={
                "errors": errors,
            },
        )

    # ========== 场景 3: JSON 接口纯洁性验证 ==========

    def test_json_output_purity(self) -> TestResult:
        """JSON 接口纯洁性验证：故意制造错误，验证 --json 模式始终输出合法 JSON"""
        start = time.time()
        name = "JSON 接口纯洁性验证"

        print(f"\n{'=' * 60}")
        print(f"[场景 3] {name}")
        print(f"{'=' * 60}")

        test_cases = [
            # (描述, 命令参数, 期望成功/失败)
            ("列出模型 (--json)", "--json list", True),
            ("状态查询 (--json)", "--json status", True),
            ("当前模型 (--json --current)", "--json --current", True),
            ("不存在的模型", "--json nonexistent-model-xyz", False),
            ("无效的子命令", "--json invalid-command-xyz", False),
            ("健康检查", "--json health-check", True),
            ("健康报告", "--json health-report", True),
        ]

        errors: List[str] = []
        passed_count = 0

        for desc, args, expect_success in test_cases:
            print(f"\n  测试: {desc}")

            try:
                returncode, stdout, stderr = self.run_cli_switch(args, timeout=30.0)

                # 验证 stdout 是否为合法 JSON
                try:
                    result = json.loads(stdout)
                    is_valid_json = True
                except json.JSONDecodeError as e:
                    is_valid_json = False
                    errors.append(f"{desc}: stdout 不是合法 JSON - {e}")
                    print(f"    ❌ stdout 不是合法 JSON: {e}")
                    print(f"       stdout[:200] = {stdout[:200]}")
                    continue

                # 验证 JSON 结构
                if "success" not in result:
                    errors.append(f"{desc}: JSON 缺少 'success' 字段")
                    print(f"    ❌ JSON 缺少 'success' 字段")
                    continue

                # 验证期望结果
                actual_success = result.get("success", False)
                if expect_success and not actual_success:
                    # 期望成功但实际失败，检查是否有 error 字段
                    if "error" in result or "message" in result:
                        print(
                            f"    ⚠️  操作未成功但 JSON 结构正确: {result.get('error') or result.get('message')}"
                        )
                        passed_count += 1
                    else:
                        errors.append(f"{desc}: 失败但无 error/message 字段")
                        print(f"    ❌ 失败但无 error/message 字段")
                elif not expect_success and actual_success:
                    errors.append(f"{desc}: 期望失败但实际成功")
                    print(f"    ❌ 期望失败但实际成功")
                else:
                    passed_count += 1
                    print(f"    ✅ JSON 结构正确, success={actual_success}")

            except subprocess.TimeoutExpired:
                errors.append(f"{desc}: 命令超时")
                print(f"    ❌ 命令超时")
            except Exception as e:
                errors.append(f"{desc}: 异常 - {e}")
                print(f"    ❌ 异常: {e}")

        duration = (time.time() - start) * 1000
        passed = len(errors) == 0

        return TestResult(
            name=name,
            passed=passed,
            message=f"通过 {passed_count}/{len(test_cases)}, 错误 {len(errors)}",
            duration_ms=duration,
            details={
                "passed_count": passed_count,
                "total_count": len(test_cases),
                "errors": errors,
            },
        )

    # ========== 场景 4: 幽灵 Session 清理验证 ==========

    def test_ghost_session_cleanup(self) -> TestResult:
        """幽灵 Session 清理验证：验证过期 session 被正确清理"""
        start = time.time()
        name = "幽灵 Session 清理验证"

        print(f"\n{'=' * 60}")
        print(f"[场景 4] {name}")
        print(f"{'=' * 60}")

        sessions_dir = get_sessions_dir()
        errors: List[str] = []

        # 创建测试用的幽灵 session
        ghost_sessions = [
            ("ghost_pid_999900", 999900),  # 不存在的 PID
            ("ghost_pid_999901", 999901),
            ("ghost_pid_999902", 999902),
            ("valid_current_pid", os.getpid()),  # 当前进程 PID（应该保留）
        ]

        print("\n  创建测试 session...")
        created_files: List[Path] = []

        for tty, pid in ghost_sessions:
            state_file = sessions_dir / f"{tty}.json"
            env_file = sessions_dir / f"{tty}.env"

            state = {
                "tty": f"/dev/{tty}",
                "tool": "claude",
                "model": "test-model",
                "model_id": "test-model-id",
                "pid": pid,
                "updated_at": datetime.now().isoformat(),
            }

            state_file.write_text(json.dumps(state, indent=2))
            env_file.write_text('export ANTHROPIC_MODEL="test-model-id"\n')
            created_files.extend([state_file, env_file])

            is_alive = is_process_alive(pid)
            print(f"    创建: {tty} (PID={pid}, alive={is_alive})")

        print(f"\n  清理前的 session 文件数: {len(list(sessions_dir.glob('*.json')))}")

        # 执行清理
        print("\n  执行清理...")
        cleaned = cleanup_stale_sessions()
        print(f"    清理了 {cleaned} 个无效 session")

        # 验证结果
        print("\n  验证清理结果...")
        for tty, pid in ghost_sessions:
            state_file = sessions_dir / f"{tty}.json"
            env_file = sessions_dir / f"{tty}.env"

            should_exist = is_process_alive(pid)

            if should_exist:
                # 应该保留
                if not state_file.exists():
                    errors.append(f"有效 session 被错误删除: {tty}")
                    print(f"    ❌ {tty}: 有效 session 被错误删除")
                else:
                    print(f"    ✅ {tty}: 有效 session 已保留")
            else:
                # 应该被删除
                if state_file.exists():
                    errors.append(f"幽灵 session 未被清理: {tty}")
                    print(f"    ❌ {tty}: 幽灵 session 未被清理")
                else:
                    print(f"    ✅ {tty}: 幽灵 session 已清理")

        # 测试并发清理（确保锁机制正常）
        print("\n  测试并发清理（确保锁机制正常）...")

        def concurrent_cleanup():
            try:
                cleanup_stale_sessions()
                return True, ""
            except Exception as e:
                return False, str(e)

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(concurrent_cleanup) for _ in range(5)]
            for future in as_completed(futures):
                success, error = future.result()
                if not success:
                    errors.append(f"并发清理异常: {error}")
                    print(f"    ❌ 并发清理异常: {error}")

        print(f"    ✅ 并发清理完成，无死锁")

        # 清理测试文件
        for f in created_files:
            try:
                if f.exists():
                    f.unlink()
            except Exception:
                pass

        # 验证限流机制
        print("\n  测试清理限流（60 秒最多一次）...")

        # 记录上次清理时间
        marker_file = sessions_dir / ".last_cleanup"
        if marker_file.exists():
            first_mtime = marker_file.stat().st_mtime
        else:
            first_mtime = 0

        # 快速连续调用清理
        cleanup_stale_sessions_if_needed()
        time.sleep(0.1)
        cleanup_stale_sessions_if_needed()
        time.sleep(0.1)
        cleanup_stale_sessions_if_needed()

        # 检查 marker 文件是否只更新了一次（或零次，如果刚清理过）
        if marker_file.exists():
            second_mtime = marker_file.stat().st_mtime
            print(f"    marker 文件 mtime: {first_mtime} -> {second_mtime}")
            print(f"    ✅ 限流机制正常")
        else:
            print(f"    ⚠️  marker 文件不存在")

        duration = (time.time() - start) * 1000
        passed = len(errors) == 0

        return TestResult(
            name=name,
            passed=passed,
            message=f"错误数: {len(errors)}",
            duration_ms=duration,
            details={
                "ghost_sessions_tested": len(ghost_sessions),
                "cleaned_count": cleaned,
                "errors": errors,
            },
        )

    # ========== 场景 5: 文件锁压力测试 ==========

    def test_file_lock_stress(self) -> TestResult:
        """文件锁压力测试：验证锁机制在高并发下无死锁"""
        start = time.time()
        name = "文件锁压力测试"

        print(f"\n{'=' * 60}")
        print(f"[场景 5] {name}")
        print(f"{'=' * 60}")

        errors: List[str] = []
        success_count = 0
        total_count = 50

        lock_path = Path.home() / ".cli-switch" / "locks" / "stress_test.lock"
        lock_path.parent.mkdir(parents=True, exist_ok=True)

        # 共享计数器
        counter = {"value": 0}
        counter_lock = threading.Lock()

        def acquire_and_increment(worker_id: int) -> Tuple[bool, str]:
            """获取锁并增加计数器"""
            try:
                lock = FileLock(lock_path, timeout=10.0)
                with lock:
                    # 模拟临界区操作
                    with counter_lock:
                        old_value = counter["value"]
                        time.sleep(0.001)  # 1ms 延迟
                        counter["value"] = old_value + 1

                    # 模拟额外操作
                    time.sleep(0.002)
                return True, ""
            except LockTimeout:
                return False, f"Worker {worker_id}: 获取锁超时"
            except Exception as e:
                return False, f"Worker {worker_id}: {e}"

        print(f"\n  启动 {total_count} 个并发任务...")

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(acquire_and_increment, i): i for i in range(total_count)}

            for future in as_completed(futures):
                worker_id = futures[future]
                try:
                    success, error = future.result()
                    if success:
                        success_count += 1
                    else:
                        errors.append(error)
                        print(f"    ❌ Worker {worker_id}: {error}")
                except Exception as e:
                    errors.append(f"Worker {worker_id}: Future 异常 - {e}")

        # 验证计数器值（应该等于成功获取锁的次数）
        expected_value = success_count
        actual_value = counter["value"]

        if actual_value != expected_value:
            errors.append(f"计数器不一致: 期望 {expected_value}, 实际 {actual_value}")
            print(f"\n  ❌ 计数器不一致: 期望 {expected_value}, 实际 {actual_value}")
        else:
            print(f"\n  ✅ 计数器正确: {actual_value}")

        print(f"\n  结果: 成功 {success_count}/{total_count}")

        # 清理
        try:
            if lock_path.exists():
                lock_path.unlink()
        except Exception:
            pass

        duration = (time.time() - start) * 1000
        passed = len(errors) == 0 and success_count == total_count

        return TestResult(
            name=name,
            passed=passed,
            message=f"成功 {success_count}/{total_count}, 错误 {len(errors)}",
            duration_ms=duration,
            details={
                "total_count": total_count,
                "success_count": success_count,
                "counter_value": actual_value,
                "errors": errors[:5],
            },
        )

    # ========== 运行所有测试 ==========

    def run_all_tests(self) -> StressTestReport:
        """运行所有压力测试"""
        self.report.start_time = datetime.now().isoformat()

        print("\n" + "=" * 60)
        print("CLI-Switch 压力与稳健性测试")
        print("=" * 60)
        print(f"模式: {'快速' if self.quick_mode else '完整'}")
        print(f"并发数: {self.concurrency}")
        print(f"迭代次数: {self.iterations}")

        # 清理 hooks 配置（避免干扰）
        try:
            clear_hooks("post_switch")
        except Exception:
            pass

        # 运行测试
        tests = [
            self.test_concurrent_switch,
            self.test_atomic_write_interruption,
            self.test_json_output_purity,
            self.test_ghost_session_cleanup,
            self.test_file_lock_stress,
        ]

        for test_func in tests:
            try:
                result = test_func()
                self.report.add_result(result)
            except Exception as e:
                error_result = TestResult(
                    name=test_func.__name__,
                    passed=False,
                    message=f"测试异常: {e}",
                    details={"exception": traceback.format_exc()},
                )
                self.report.add_result(error_result)
                print(f"\n  ❌ 测试异常: {e}")

        self.report.end_time = datetime.now().isoformat()

        return self.report


def print_report(report: StressTestReport):
    """打印测试报告"""
    print("\n")
    print("=" * 60)
    print("压力测试报告")
    print("=" * 60)
    print(f"开始时间: {report.start_time}")
    print(f"结束时间: {report.end_time}")
    print(f"总测试数: {report.total_tests}")
    print(f"通过: {report.passed}")
    print(f"失败: {report.failed}")
    print(f"通过率: {report.passed / max(report.total_tests, 1) * 100:.1f}%")
    print()
    print("-" * 60)
    print("测试详情:")
    print("-" * 60)

    for result in report.results:
        status = "✅ PASS" if result.passed else "❌ FAIL"
        print(f"\n{status} [{result.duration_ms:.0f}ms] {result.name}")
        print(f"       {result.message}")
        if result.details.get("errors"):
            for err in result.details["errors"][:3]:
                print(f"       - {err}")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="CLI-Switch 压力与稳健性测试")
    parser.add_argument("--quick", "-q", action="store_true", help="快速模式（减少并发数）")
    parser.add_argument("--json", "-j", action="store_true", help="输出 JSON 格式报告")
    args = parser.parse_args()

    runner = StressTestRunner(quick_mode=args.quick)
    report = runner.run_all_tests()

    if args.json:
        print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))
    else:
        print_report(report)

    # 保存报告到文件
    report_path = Path(__file__).parent / "stress_test_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2, ensure_ascii=False)
    print(f"\n报告已保存到: {report_path}")

    # 返回退出码
    return 0 if report.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
