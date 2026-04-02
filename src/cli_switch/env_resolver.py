"""
环境变量解析器 - 生成模型所需的环境变量和命令行参数

Agent 模式核心：纯计算，无文件 I/O，无网络请求，零副作用。
解决多 Agent 并发调用 cli-switch 时的配置文件冲突问题。

用法：
  cli-switch env <model>              输出 shell export 格式
  cli-switch env --json <model>       输出 JSON 格式
  cli-switch env --tool gemini <model>  指定目标工具
"""

import os
from typing import Dict, Optional

from .models import Model, ToolType


class EnvResolveError(Exception):
    """环境变量解析错误"""

    pass


def resolve_env_vars(model: Model, target_tool: Optional[ToolType] = None) -> Dict[str, str]:
    """解析模型所需的环境变量

    纯计算，无文件 I/O。API key 从 os.getenv() 读取。

    Args:
        model: 模型定义
        target_tool: 覆盖工具类型（默认使用 model.tool）

    Returns:
        环境变量字典 {name: value}

    Raises:
        EnvResolveError: 必需的环境变量缺失
    """
    tool = target_tool or model.tool

    if tool == ToolType.CLAUDE:
        return _resolve_claude_env(model)
    elif tool == ToolType.GEMINI:
        return _resolve_gemini_env(model)
    elif tool == ToolType.CODEX:
        return _resolve_codex_env(model)
    else:
        raise EnvResolveError(f"不支持的工具类型：{tool}")


def get_model_arg(model: Model, target_tool: Optional[ToolType] = None) -> str:
    """获取 CLI 工具的 --model 参数值

    Args:
        model: 模型定义
        target_tool: 覆盖工具类型

    Returns:
        --model 参数应传入的值
    """
    tool = target_tool or model.tool

    if tool == ToolType.GEMINI and model.gemini_model_id:
        return model.gemini_model_id
    elif tool == ToolType.CODEX and model.codex_model_id:
        return model.codex_model_id
    else:
        return model.model_id


def get_tool_command(tool: ToolType) -> str:
    """获取 CLI 工具的命令名"""
    commands = {
        ToolType.CLAUDE: "claude",
        ToolType.GEMINI: "gemini",
        ToolType.CODEX: "codex",
    }
    return commands.get(tool, tool.value)


def _resolve_claude_env(model: Model) -> Dict[str, str]:
    """解析 Claude Code 所需的环境变量

    Claude Code 优先级：--model > ANTHTHROPIC_MODEL env > settings.json
    所以设置 env 可以覆盖 settings.json 中的配置。
    """
    env = {}

    # 模型 ID
    env["ANTHROPIC_MODEL"] = model.model_id

    # API 端点
    if model.base_url:
        env["ANTHROPIC_BASE_URL"] = model.base_url

    # API Key
    if model.api_key_env:
        api_key = os.getenv(model.api_key_env)
        if not api_key:
            raise EnvResolveError(f"API key 未找到：环境变量 '{model.api_key_env}' 未设置")
        env["ANTHROPIC_AUTH_TOKEN"] = api_key

    return env


def _resolve_gemini_env(model: Model) -> Dict[str, str]:
    """解析 Gemini CLI 所需的环境变量

    Gemini CLI 优先级：--model > GEMINI_MODEL env > settings.json
    """
    env = {}

    # Gemini CLI 支持 GEMINI_MODEL 环境变量指定模型
    model_id = model.gemini_model_id or model.model_id
    env["GEMINI_MODEL"] = model_id

    # API Key
    if model.api_key_env:
        api_key = os.getenv(model.api_key_env)
        if not api_key:
            raise EnvResolveError(f"API key 未找到：环境变量 '{model.api_key_env}' 未设置")
        # Gemini 原生模型用 GEMINI_API_KEY
        if model.api_key_env == "GEMINI_API_KEY":
            env["GEMINI_API_KEY"] = api_key
        # 智谱模型通过 OpenRouter 代理
        elif model.api_key_env == "ZHIPU_AUTH_TOKEN":
            env["OPENROUTER_API_KEY"] = api_key
        else:
            env[model.api_key_env] = api_key

    return env


def _resolve_codex_env(model: Model) -> Dict[str, str]:
    """解析 Codex CLI 所需的环境变量

    Codex CLI 不支持 env var 指定模型，只能通过 --model 参数。
    这里只输出 API Key 相关的环境变量。
    """
    env = {}

    if model.api_key_env:
        api_key = os.getenv(model.api_key_env)
        if not api_key:
            raise EnvResolveError(f"API key 未找到：环境变量 '{model.api_key_env}' 未设置")
        env[model.api_key_env] = api_key

    return env
