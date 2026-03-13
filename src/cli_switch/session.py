"""
Session 管理 - TTY 专属状态管理

功能：
- get_tty() - 获取当前 TTY 标识
- get_session_state(tty) - 读取 TTY 状态
- set_session_state(tty, tool, model, model_id, base_url) - 写入 TTY 状态
- cleanup_stale_sessions() - 清理无效 TTY 状态

状态文件：
- ~/.cli-switch/sessions/{tty_name}.json - 状态数据
- ~/.cli-switch/sessions/{tty_name}.env - 配套 env 文件 (快速 source)

注意：
- TTY 标识符可能复用，必须绑定 PID 防止幽灵状态
- 写入必须是原子操作，避免读取撕裂
"""

import os
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any


def get_tty() -> Optional[str]:
    """获取当前 TTY 标识符

    将 tty 命令输出的 / 替换为 _
    例如：/dev/ttys001 -> dev_ttys001
         /dev/pts/1 -> dev_pts_1

    非 TTY 环境（脚本、CI 等）返回基于 PID 的 fallback 标识符

    Returns:
        TTY 标识符，始终返回有效字符串
    """
    try:
        result = subprocess.run(["tty"], capture_output=True, text=True, timeout=1)
        if result.returncode == 0:
            tty_path = result.stdout.strip()
            if tty_path and tty_path != "not a tty":
                return tty_path.replace("/", "_")
    except Exception:
        pass

    # Fallback: 用 PID 生成标识符（非 TTY 环境）
    return f"pid_{os.getpid()}"


def get_pid() -> int:
    """获取当前进程 ID"""
    return os.getpid()


def is_process_alive(pid: int) -> bool:
    """检查进程是否存活

    Args:
        pid: 进程 ID

    Returns:
        True 如果进程存活，False 否则
    """
    try:
        result = subprocess.run(["kill", "-0", str(pid)], capture_output=True, timeout=1)
        return result.returncode == 0
    except Exception:
        return False


def get_sessions_dir() -> Path:
    """获取 sessions 目录

    Returns:
        sessions 目录路径
    """
    # 配置目录：~/.cli-switch/
    config_dir = Path.home() / ".cli-switch"
    config_dir.mkdir(parents=True, exist_ok=True)
    sessions_dir = config_dir / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    return sessions_dir


def get_session_file(tty: str) -> Path:
    """获取 TTY 状态文件路径

    Args:
        tty: TTY 标识符

    Returns:
        状态文件路径
    """
    return get_sessions_dir() / f"{tty}.json"


def get_session_env_file(tty: str) -> Path:
    """获取 TTY env 文件路径

    Args:
        tty: TTY 标识符

    Returns:
        env 文件路径
    """
    return get_sessions_dir() / f"{tty}.env"


def get_session_state(tty: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """读取 TTY 状态

    Args:
        tty: TTY 标识符，如果为 None 则自动获取当前 TTY

    Returns:
        状态字典，包含 tool, model, model_id, base_url 等信息
        如果状态无效或不存在返回 None
    """
    if tty is None:
        tty = get_tty()

    if tty is None:
        return None

    state_file = get_session_file(tty)

    if not state_file.exists():
        return None

    try:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)

        # 校验 PID，防止幽灵状态
        pid = state.get("pid")
        if pid is not None and not is_process_alive(pid):
            # 进程已死，状态无效
            return None

        return state
    except Exception:
        return None


def set_session_state(
    tty: Optional[str] = None,
    tool: str = "claude",
    model: str = "qwen",
    model_id: str = "qwen3.5-plus",
    base_url: Optional[str] = None,
    api_key_env: Optional[str] = None,
) -> bool:
    """写入 TTY 状态（原子操作）

    写入两个文件：
    1. .json 文件：完整状态数据
    2. .env 文件：用于快速 source 的环境变量

    Args:
        tty: TTY 标识符，如果为 None 则自动获取
        tool: 工具名称
        model: 模型 key
        model_id: 实际模型 ID
        base_url: API 端点
        api_key_env: API 密钥环境变量名

    Returns:
        True 如果写入成功，False 否则
    """
    if tty is None:
        tty = get_tty()

    if tty is None:
        return False

    pid = get_pid()
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # 状态数据
    state = {
        "tty": tty.replace("_", "/"),  # 恢复原始 TTY 路径
        "tool": tool,
        "model": model,
        "model_id": model_id,
        "base_url": base_url,
        "api_key_env": api_key_env,
        "pid": pid,
        "updated_at": timestamp,
    }

    state_file = get_session_file(tty)
    env_file = get_session_env_file(tty)

    try:
        # 原子写入 JSON 文件
        temp_state_file = state_file.with_suffix(".json.tmp")
        with open(temp_state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        # 重命名实现原子操作
        temp_state_file.rename(state_file)

        # 原子写入 ENV 文件
        env_content = f'export ANTHROPIC_MODEL="{model_id}"\n'
        if base_url:
            env_content += f'export ANTHROPIC_BASE_URL="{base_url}"\n'
        if api_key_env:
            api_key = os.getenv(api_key_env)
            if api_key:
                env_content += f'export ANTHROPIC_AUTH_TOKEN="{api_key}"\n'

        temp_env_file = env_file.with_suffix(".env.tmp")
        with open(temp_env_file, "w", encoding="utf-8") as f:
            f.write(env_content)
        temp_env_file.rename(env_file)

        return True
    except Exception:
        return False


def cleanup_stale_sessions() -> int:
    """清理无效的 TTY 状态文件

    检查 sessions 目录中的所有状态文件，删除 PID 不再存活的状态

    Returns:
        清理的文件数量
    """
    sessions_dir = get_sessions_dir()
    if not sessions_dir.exists():
        return 0

    cleaned = 0

    for state_file in sessions_dir.glob("*.json"):
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)

            pid = state.get("pid")
            if pid is not None and not is_process_alive(pid):
                # PID 已死，删除状态文件
                tty = state.get("tty", "").replace("/", "_")
                env_file = sessions_dir / f"{tty}.env"

                state_file.unlink()
                if env_file.exists():
                    env_file.unlink()

                cleaned += 1
        except Exception:
            # 文件损坏，尝试删除
            try:
                state_file.unlink()
                cleaned += 1
            except Exception:
                pass

    return cleaned


def delete_session_state(tty: Optional[str] = None) -> bool:
    """删除 TTY 状态

    Args:
        tty: TTY 标识符，如果为 None 则自动获取

    Returns:
        True 如果删除成功，False 否则
    """
    if tty is None:
        tty = get_tty()

    if tty is None:
        return False

    state_file = get_session_file(tty)
    env_file = get_session_env_file(tty)

    deleted = False

    try:
        if state_file.exists():
            state_file.unlink()
            deleted = True
    except Exception:
        pass

    try:
        if env_file.exists():
            env_file.unlink()
            deleted = True
    except Exception:
        pass

    return deleted


def get_global_state() -> Optional[Dict[str, Any]]:
    """读取全局 fallback 状态

    Returns:
        全局状态字典，如果不存在返回 None
    """
    config_dir = Path.home() / ".cli-switch"
    current_file = config_dir / "current.txt"

    if not current_file.exists():
        return None

    try:
        with open(current_file, "r", encoding="utf-8") as f:
            model_key = f.read().strip()

        return {"model": model_key, "type": "global"}
    except Exception:
        return None


def get_effective_state() -> Optional[Dict[str, Any]]:
    """获取有效状态（优先级：TTY > Global）

    Returns:
        有效状态字典
    """
    # 优先读取 TTY 状态
    tty_state = get_session_state()
    if tty_state is not None:
        tty_state["source"] = "tty"
        return tty_state

    # Fallback 到全局状态
    global_state = get_global_state()
    if global_state is not None:
        return global_state

    return None
