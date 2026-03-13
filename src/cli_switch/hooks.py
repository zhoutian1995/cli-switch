"""
Hook 执行引擎 - 管理切换后的钩子命令

功能：
- 执行 post_switch 钩子（切换完成后）
- 执行 pre_tool_use 钩子（工具使用前）
- 防重入机制（CLI_SWITCH_HOOK_ACTIVE 环境变量）
- [Phase 2.3] 文件锁保护 hooks.yaml 的读-改-写
- [Phase 1.2] shlex.quote 防 shell 注入

配置文件：~/.cli-switch/hooks.yaml
"""

import os
import shlex
import subprocess
from pathlib import Path
from typing import Callable, List, Optional, Dict, Any
import yaml

from .filelock import get_lock


def get_hooks_config_path() -> Path:
    """获取 hooks 配置文件路径"""
    config_dir = Path.home() / ".cli-switch"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "hooks.yaml"


def _load_hooks_config_unlocked() -> Dict[str, Any]:
    """加载 hooks 配置（无锁版本，仅在已持有锁时调用）"""
    config_path = get_hooks_config_path()

    if not config_path.exists():
        return {"hooks": {}}

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()
        if content.strip():
            config = yaml.safe_load(content)
            if config:
                return config
    except Exception:
        pass

    return {"hooks": {}}


def _save_hooks_config_unlocked(config: Dict[str, Any]) -> bool:
    """保存 hooks 配置（无锁版本，仅在已持有锁时调用）"""
    config_path = get_hooks_config_path()

    temp_file = config_path.with_suffix(".yaml.tmp")
    try:
        # 原子写入：temp + rename
        with open(temp_file, "w", encoding="utf-8") as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
        temp_file.rename(config_path)
        return True
    except Exception:
        # 清理临时文件
        try:
            if temp_file.exists():
                temp_file.unlink()
        except Exception:
            pass
        return False


def _modify_hooks_config(modifier_fn: Callable[[Dict[str, Any]], Dict[str, Any]]) -> bool:
    """加锁的 load-modify-save 原子操作

    整个 load → modifier_fn → save 流程在同一把排他锁内完成，
    彻底避免 TOCTOU 竞争。

    Args:
        modifier_fn: 接收当前 config 字典，返回修改后的 config 字典

    Returns:
        True 如果操作成功
    """
    with get_lock("hooks"):
        config = _load_hooks_config_unlocked()
        config = modifier_fn(config)
        return _save_hooks_config_unlocked(config)


def load_hooks_config() -> Dict[str, Any]:
    """加载 hooks 配置（加锁版本，供外部读取使用）

    Returns:
        hooks 配置字典
    """
    with get_lock("hooks"):
        return _load_hooks_config_unlocked()


def save_hooks_config(config: Dict[str, Any]) -> bool:
    """保存 hooks 配置（加锁版本，供外部直接写入使用）

    Args:
        config: hooks 配置字典

    Returns:
        True 如果保存成功
    """
    with get_lock("hooks"):
        return _save_hooks_config_unlocked(config)


def is_hook_active() -> bool:
    """检查是否正在执行 hook（防重入检查）

    Returns:
        True 如果当前正在执行 hook
    """
    return os.environ.get("CLI_SWITCH_HOOK_ACTIVE") == "1"


def execute_hook(
    command: str, context: Optional[Dict[str, str]] = None, check_reentrancy: bool = True
) -> bool:
    """执行单个 hook 命令

    Args:
        command: hook 命令，支持 {model}, {tool}, {model_id} 等占位符
        context: 上下文变量，用于替换占位符
        check_reentrancy: 是否检查重入

    Returns:
        True 如果执行成功
    """
    # 防重入检查
    if check_reentrancy and is_hook_active():
        # 被阻止，返回 False 表示未执行
        return False

    # [P2-2 修复] 替换占位符时使用 shlex.quote 防止 shell 注入
    if context:
        for key, value in context.items():
            command = command.replace(f"{{{key}}}", shlex.quote(str(value)))

    # 设置环境变量
    env = os.environ.copy()
    env["CLI_SWITCH_HOOK_ACTIVE"] = "1"

    try:
        # 执行命令
        result = subprocess.run(
            command, shell=True, env=env, capture_output=True, text=True, timeout=30
        )
        return result.returncode == 0
    except Exception:
        return False


def execute_hooks(
    hook_type: str, context: Optional[Dict[str, str]] = None, check_reentrancy: bool = True
) -> List[bool]:
    """执行指定类型的所有 hooks

    Args:
        hook_type: hook 类型 (post_switch, pre_tool_use, etc.)
        context: 上下文变量
        check_reentrancy: 是否检查重入

    Returns:
        执行结果列表
    """
    config = load_hooks_config()
    hooks = config.get("hooks", {}).get(hook_type, [])

    results = []
    for hook in hooks:
        result = execute_hook(hook, context, check_reentrancy)
        results.append(result)

    return results


def execute_post_switch(
    model: str, tool: str, model_id: Optional[str] = None, check_reentrancy: bool = True
) -> List[bool]:
    """执行 post_switch hooks

    Args:
        model: 模型 key
        tool: 工具名称
        model_id: 模型 ID
        check_reentrancy: 是否检查重入

    Returns:
        执行结果列表
    """
    context = {"model": model, "tool": tool, "model_id": model_id or model}
    return execute_hooks("post_switch", context, check_reentrancy)


def execute_pre_tool_use(tool: str, model: Optional[str] = None) -> List[bool]:
    """执行 pre_tool_use hooks

    Args:
        tool: 工具名称
        model: 当前模型

    Returns:
        执行结果列表
    """
    context = {"tool": tool, "model": model or "unknown"}
    return execute_hooks("pre_tool_use", context, check_reentrancy=True)


def execute_post_tool_use(tool: str, model: Optional[str] = None) -> List[bool]:
    """执行 post_tool_use hooks

    Args:
        tool: 工具名称
        model: 当前模型

    Returns:
        执行结果列表
    """
    context = {"tool": tool, "model": model or "unknown"}
    return execute_hooks("post_tool_use", context, check_reentrancy=True)


def add_hook(hook_type: str, command: str) -> bool:
    """添加 hook 命令（加锁的原子 load-modify-save）

    Args:
        hook_type: hook 类型
        command: hook 命令

    Returns:
        True 如果添加成功
    """

    def _add(config: Dict[str, Any]) -> Dict[str, Any]:
        if "hooks" not in config:
            config["hooks"] = {}
        if hook_type not in config["hooks"]:
            config["hooks"][hook_type] = []
        config["hooks"][hook_type].append(command)
        return config

    return _modify_hooks_config(_add)


def remove_hook(hook_type: str, command: str) -> bool:
    """移除 hook 命令（加锁的原子 load-modify-save）

    Args:
        hook_type: hook 类型
        command: hook 命令

    Returns:
        True 如果移除成功
    """

    def _remove(config: Dict[str, Any]) -> Dict[str, Any]:
        if "hooks" not in config:
            return config
        if hook_type not in config["hooks"]:
            return config
        hooks = config["hooks"][hook_type]
        if command in hooks:
            hooks.remove(command)
        return config

    return _modify_hooks_config(_remove)


def list_hooks(hook_type: Optional[str] = None) -> Dict[str, List[str]]:
    """列出 hooks

    Args:
        hook_type: 如果指定，只列出该类型的 hooks

    Returns:
        hooks 字典
    """
    config = load_hooks_config()
    hooks = config.get("hooks", {})

    if hook_type:
        return {hook_type: hooks.get(hook_type, [])}

    return hooks


def clear_hooks(hook_type: str) -> bool:
    """清空指定类型的 hooks（加锁的原子 load-modify-save）

    Args:
        hook_type: hook 类型

    Returns:
        True 如果清空成功
    """

    def _clear(config: Dict[str, Any]) -> Dict[str, Any]:
        if "hooks" not in config:
            return config
        config["hooks"][hook_type] = []
        return config

    return _modify_hooks_config(_clear)
