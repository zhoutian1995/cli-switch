"""
CLI Switch - AI CLI 工具切换器

支持 Claude Code, Gemini CLI, Codex CLI 等多个 AI 命令行工具的模型切换。
"""

__version__ = "1.0.0"
__author__ = "OpenClaw Team"
__email__ = "willezhou2015@gmail.com"

from .models import Model, ModelRegistry
from .config import Config, ConfigError
from .switcher import Switcher, SwitchError

__all__ = [
    "Model",
    "ModelRegistry",
    "Config",
    "ConfigError",
    "Switcher",
    "SwitchError",
]
