"""
切换逻辑 - 实现三种 CLI 工具的模型切换

支持：
- TTY 专属状态（终端隔离）
- 全局 fallback 状态
- Hook 执行（防重入）
- [Phase 2.2] 文件锁保护 + 原子写入（temp+rename）
"""

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

from .models import Model, ToolType
from .config import Config
from .filelock import get_lock


class SwitchError(Exception):
    """切换相关错误"""

    pass


class Switcher:
    """模型切换器"""

    def __init__(self, config: Config):
        self.config = config
        # 延迟导入，避免循环依赖
        from . import session
        from . import hooks

        self.session = session
        self.hooks = hooks

    def switch(self, model: Model, target_tool: Optional[str] = None) -> Tuple[bool, str]:
        try:
            # 如果指定了目标工具，使用目标工具；否则使用模型的 tool 属性
            if target_tool:
                tool = ToolType(target_tool.lower())
            elif model.tool == ToolType.CLAUDE and model.supported_tools:
                # 如果模型支持多个工具，优先使用 supported_tools 中的第一个
                tool = model.supported_tools[0]
            else:
                tool = model.tool

            if tool == ToolType.CLAUDE:
                return self._switch_claude(model)
            elif tool == ToolType.GEMINI:
                return self._switch_gemini(model)
            elif tool == ToolType.CODEX:
                return self._switch_codex(model)
            else:
                return False, f"不支持的工具类型：{tool}"
        except Exception as e:
            return False, f"切换失败：{e}"

    def _switch_claude(self, model: Model) -> Tuple[bool, str]:
        config_path = Path.home() / ".claude" / "settings.json"
        if not config_path.exists():
            return False, f"Claude 配置文件不存在：{config_path}"
        try:
            # [Phase 2.2] 排他锁保护整个读-改-写流程
            with get_lock("claude"):
                with open(config_path, "r", encoding="utf-8") as f:
                    settings = json.load(f)
                if "env" not in settings:
                    settings["env"] = {}
                env = settings["env"]
                env["ANTHROPIC_MODEL"] = model.model_id
                env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = model.model_id
                env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = model.model_id
                env["ANTHROPIC_DEFAULT_OPUS_MODEL"] = model.model_id
                if model.base_url:
                    env["ANTHROPIC_BASE_URL"] = model.base_url
                if model.api_key_env:
                    api_key = os.getenv(model.api_key_env)
                    if api_key:
                        env["ANTHROPIC_AUTH_TOKEN"] = api_key

                # [Phase 2.2] 原子写入：temp + os.replace
                fd, temp_path = tempfile.mkstemp(suffix=".json", dir=str(config_path.parent))
                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as f:
                        json.dump(settings, f, indent=2, ensure_ascii=False)
                    os.replace(temp_path, str(config_path))
                except BaseException:
                    # 写入失败，清理临时文件
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass
                    raise
            # 锁已释放，保存 session 状态（有独立的隔离机制）
            self._save_current_model(model.key, model=model, tool="claude")
            return True, f"已切换到 Claude: {model.name} ({model.model_id})"
        except json.JSONDecodeError as e:
            return False, f"配置文件解析错误：{e}"
        except Exception as e:
            return False, f"切换 Claude 失败：{e}"

    def _switch_gemini(self, model: Model) -> Tuple[bool, str]:
        config_path = Path.home() / ".gemini" / "config.json"
        if not config_path.exists():
            return False, f"Gemini 配置文件不存在：{config_path}"
        try:
            # [Phase 2.2] 排他锁保护整个读-改-写流程
            with get_lock("gemini"):
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)

                model_id = getattr(model, "gemini_model_id", None) or model.model_id
                config["model"] = model_id

                # 检查是否为智谱模型（需要配置OPENROUTER环境变量）
                is_zhipu = model.api_key_env == "ZHIPU_AUTH_TOKEN" or (
                    model.base_url and "open.bigmodel.cn" in model.base_url
                )

                if is_zhipu:
                    # 智谱模型使用 OPENROUTER 配置
                    if "env" not in config:
                        config["env"] = {}
                    config["env"]["OPENROUTER_BASE_URL"] = (
                        "https://open.bigmodel.cn/api/coding/paas/v4"
                    )
                    if model.api_key_env:
                        api_key = os.getenv(model.api_key_env)
                        if api_key:
                            config["env"]["OPENROUTER_API_KEY"] = api_key

                # [Phase 2.2] 原子写入：temp + os.replace
                fd, temp_path = tempfile.mkstemp(suffix=".json", dir=str(config_path.parent))
                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as f:
                        json.dump(config, f, indent=2, ensure_ascii=False)
                    os.replace(temp_path, str(config_path))
                except BaseException:
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass
                    raise
            # 锁已释放
            self._save_current_model(model.key, model=model, tool="gemini")
            return True, f"已切换到 Gemini: {model.name} ({model_id})"
        except json.JSONDecodeError as e:
            return False, f"配置文件解析错误：{e}"
        except Exception as e:
            return False, f"切换 Gemini 失败：{e}"

    def _switch_codex(self, model: Model) -> Tuple[bool, str]:
        """切换 Codex CLI 模型

        Codex 0.80.0+ 使用 Chat/Completions API 配置方式：
        - 需要配置 model_provider 指向自定义 provider
        - 需要配置 [model_providers.xxx] 部分
        """
        config_path = Path.home() / ".codex" / "config.toml"
        if not config_path.exists():
            return False, f"Codex 配置文件不存在：{config_path}"
        try:
            # [Phase 2.2] 排他锁保护整个读-改-写流程
            with get_lock("codex"):
                with open(config_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # 获取模型 ID
                model_id = getattr(model, "codex_model_id", None) or model.model_id

                # 判断是 Coding Plan 模型还是 OpenAI 原生模型
                is_coding_plan = model.base_url and "dashscope.aliyuncs.com" in model.base_url

                if is_coding_plan:
                    # Coding Plan 模型配置
                    provider_name = "Model_Studio_Coding_Plan"
                    base_url = "https://coding.dashscope.aliyuncs.com/v1"
                    env_key = "BAILIAN_API_KEY"  # Coding Plan 使用 BAILIAN_API_KEY 环境变量

                    # 检查是否已有 model_providers 配置
                    if f"[model_providers.{provider_name}]" not in content:
                        # 添加 model_providers 配置
                        provider_config = f'''

[model_providers.{provider_name}]
name = "{provider_name}"
base_url = "{base_url}"
env_key = "{env_key}"
wire_api = "chat"
'''
                        content = content.rstrip() + provider_config + "\n"
                    else:
                        # 更新现有的 provider 配置
                        content = re.sub(
                            r"\[model_providers\." + provider_name + r"\].*?(?=\n\[|\Z)",
                            f'''[model_providers.{provider_name}]
name = "{provider_name}"
base_url = "{base_url}"
env_key = "{env_key}"
wire_api = "chat"
''',
                            content,
                            flags=re.DOTALL,
                        )

                    # 更新 model_provider 和 model
                    if re.search(r"^model_provider\s*=", content, flags=re.MULTILINE):
                        content = re.sub(
                            r"^model_provider\s*=.*",
                            f'model_provider = "{provider_name}"',
                            content,
                            flags=re.MULTILINE,
                        )
                    else:
                        content = f'model_provider = "{provider_name}"\n' + content

                    if re.search(r'^model\s*=\s*"', content, flags=re.MULTILINE):
                        content = re.sub(
                            r'^model\s*=\s*".*"',
                            f'model = "{model_id}"',
                            content,
                            flags=re.MULTILINE,
                        )
                    else:
                        content = f'model = "{model_id}"\n' + content

                else:
                    # GPT 模型通过代理（aiclaude.xyz）
                    provider_name = "aiclaude_proxy"
                    base_url = model.base_url or "https://api.aiclaude.xyz/v1"
                    env_key = model.api_key_env or "OPENAI_API_KEY"

                    if f"[model_providers.{provider_name}]" not in content:
                        provider_config = f'''

[model_providers.{provider_name}]
name = "{provider_name}"
base_url = "{base_url}"
env_key = "{env_key}"
wire_api = "chat"
'''
                        content = content.rstrip() + provider_config + "\n"
                    else:
                        content = re.sub(
                            r"\[model_providers\." + provider_name + r"\].*?(?=\n\[|\Z)",
                            f'''[model_providers.{provider_name}]
name = "{provider_name}"
base_url = "{base_url}"
env_key = "{env_key}"
wire_api = "chat"
''',
                            content,
                            flags=re.DOTALL,
                        )

                    if re.search(r"^model_provider\s*=", content, flags=re.MULTILINE):
                        content = re.sub(
                            r"^model_provider\s*=.*",
                            f'model_provider = "{provider_name}"',
                            content,
                            flags=re.MULTILINE,
                        )
                    else:
                        content = f'model_provider = "{provider_name}"\n' + content

                    if re.search(r'^model\s*=\s*"', content, flags=re.MULTILINE):
                        content = re.sub(
                            r'^model\s*=\s*".*"',
                            f'model = "{model_id}"',
                            content,
                            flags=re.MULTILINE,
                        )
                    else:
                        content = f'model = "{model_id}"\n' + content

                # [Phase 2.2] 原子写入：temp + os.replace
                fd, temp_path = tempfile.mkstemp(suffix=".toml", dir=str(config_path.parent))
                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as f:
                        f.write(content)
                    os.replace(temp_path, str(config_path))
                except BaseException:
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass
                    raise
            # 锁已释放
            self._save_current_model(model.key, model=model, tool="codex")
            return True, f"已切换到 Codex: {model.name} ({model_id})"
        except Exception as e:
            return False, f"切换 Codex 失败：{e}"

    def _save_current_model(
        self,
        model_key: str,
        model: Optional[Model] = None,
        tool: Optional[str] = None,
        execute_hooks_flag: bool = True,
    ):
        """保存当前模型状态

        同时写入：
        1. TTY 专属状态（.json + .env）
        2. 全局 fallback 状态（current.txt）

        Args:
            model_key: 模型 key
            model: 模型对象（可选）
            tool: 工具名称（可选）
            execute_hooks_flag: 是否执行 hooks
        """
        # [Phase 2.4] 带频率限制的清理（每 60 秒最多一次）
        self.session.cleanup_stale_sessions_if_needed()

        # 获取模型详细信息
        model_id = model.model_id if model else model_key
        base_url = model.base_url if model else None
        api_key_env = model.api_key_env if model else None
        tool_name = tool if tool else (model.tool.value if model else "claude")

        # 1. 写入 TTY 专属状态
        self.session.set_session_state(
            tool=tool_name,
            model=model_key,
            model_id=model_id,
            base_url=base_url,
            api_key_env=api_key_env,
        )

        # 2. 写入全局 fallback 状态
        try:
            if self.config.config_path:
                config_dir = self.config.config_path.parent
                config_dir.mkdir(parents=True, exist_ok=True)
                current_file = config_dir / "current.txt"
                with open(current_file, "w", encoding="utf-8") as f:
                    f.write(model_key)
        except Exception:
            pass

        # 3. 执行 post_switch hooks
        if execute_hooks_flag:
            self.hooks.execute_post_switch(model_key, tool_name, model_id, check_reentrancy=True)

    def get_current(self) -> Optional[str]:
        """获取当前模型

        优先级：TTY 专属状态 > 全局 fallback 状态 > 默认模型

        Returns:
            当前模型 key，如果未知返回 None
        """
        # 1. 优先读取 TTY 状态
        tty_state = self.session.get_session_state()
        if tty_state is not None:
            return tty_state.get("model")

        # 2. Fallback 到全局状态
        try:
            if self.config.config_path:
                config_dir = self.config.config_path.parent
                current_file = config_dir / "current.txt"
                if current_file.exists():
                    with open(current_file, "r", encoding="utf-8") as f:
                        return f.read().strip()
        except Exception:
            pass

        return None

    def get_current_state(self) -> Optional[Dict[str, Any]]:
        """获取当前完整状态

        Returns:
            状态字典，包含 model, tool, model_id, source 等
        """
        # 1. 优先读取 TTY 状态
        tty_state = self.session.get_session_state()
        if tty_state is not None:
            tty_state["source"] = "tty"
            return tty_state

        # 2. Fallback 到全局状态
        global_state = self.session.get_global_state()
        if global_state is not None:
            return global_state

        return None
