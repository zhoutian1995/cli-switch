"""
CLI Switch - AI CLI 工具切换器

支持 Claude Code, Gemini CLI, Codex CLI 等多个 AI 命令行工具的模型切换。

特性:
- 终端隔离：每个 TTY 有独立的模型配置
- Hook 支持：切换后执行自定义命令
- 防重入：自动检测并防止 hook 循环触发
"""

__version__ = "1.1.0"
__author__ = "OpenClaw Team"
__email__ = "willezhou2015@gmail.com"

from .models import Model, ModelRegistry
from .config import Config, ConfigError
from .switcher import Switcher, SwitchError
from .mcp import MCPManager, MCPError, MCPServer
from .session import (
    get_tty,
    get_session_state,
    set_session_state,
    cleanup_stale_sessions,
    delete_session_state,
    get_global_state,
    get_effective_state,
)
from .hooks import (
    execute_hook,
    execute_hooks,
    execute_post_switch,
    execute_pre_tool_use,
    execute_post_tool_use,
    add_hook,
    remove_hook,
    list_hooks,
    is_hook_active,
)

__all__ = [
    # Core
    "Model",
    "ModelRegistry",
    "Config",
    "ConfigError",
    "Switcher",
    "SwitchError",
    "MCPManager",
    "MCPError",
    "MCPServer",
    # Session
    "get_tty",
    "get_session_state",
    "set_session_state",
    "cleanup_stale_sessions",
    "delete_session_state",
    "get_global_state",
    "get_effective_state",
    # Hooks
    "execute_hook",
    "execute_hooks",
    "execute_post_switch",
    "execute_pre_tool_use",
    "execute_post_tool_use",
    "add_hook",
    "remove_hook",
    "list_hooks",
    "is_hook_active",
]
