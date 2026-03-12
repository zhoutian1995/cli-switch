"""
切换逻辑 - 实现三种 CLI 工具的模型切换
"""

import json
import os
import re
from pathlib import Path
from typing import Tuple, Optional

from .models import Model, ToolType
from .config import Config


class SwitchError(Exception):
    """切换相关错误"""
    pass


class Switcher:
    """模型切换器"""

    def __init__(self, config: Config):
        self.config = config

    def switch(self, model: Model) -> Tuple[bool, str]:
        try:
            if model.tool == ToolType.CLAUDE:
                return self._switch_claude(model)
            elif model.tool == ToolType.GEMINI:
                return self._switch_gemini(model)
            elif model.tool == ToolType.CODEX:
                return self._switch_codex(model)
            else:
                return False, f"不支持的工具类型：{model.tool}"
        except Exception as e:
            return False, f"切换失败：{e}"

    def _switch_claude(self, model: Model) -> Tuple[bool, str]:
        config_path = Path.home() / ".claude" / "settings.json"
        if not config_path.exists():
            return False, f"Claude 配置文件不存在：{config_path}"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
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
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
            self._save_current_model(model.key)
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
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            config["model"] = model.model_id
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            self._save_current_model(model.key)
            return True, f"已切换到 Gemini: {model.name} ({model.model_id})"
        except json.JSONDecodeError as e:
            return False, f"配置文件解析错误：{e}"
        except Exception as e:
            return False, f"切换 Gemini 失败：{e}"

    def _switch_codex(self, model: Model) -> Tuple[bool, str]:
        config_path = Path.home() / ".codex" / "config.toml"
        if not config_path.exists():
            return False, f"Codex 配置文件不存在：{config_path}"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = re.sub(r'^model\s*=\s*".*"', f'model = "{model.model_id}"', content, flags=re.MULTILINE)
            with open(config_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            self._save_current_model(model.key)
            return True, f"已切换到 Codex: {model.name} ({model.model_id})"
        except Exception as e:
            return False, f"切换 Codex 失败：{e}"

    def _save_current_model(self, model_key: str):
        try:
            if self.config.config_path:
                config_dir = self.config.config_path.parent
                config_dir.mkdir(parents=True, exist_ok=True)
                current_file = config_dir / "current.txt"
                with open(current_file, 'w', encoding='utf-8') as f:
                    f.write(model_key)
        except Exception:
            pass

    def get_current(self) -> Optional[str]:
        try:
            if self.config.config_path:
                config_dir = self.config.config_path.parent
                current_file = config_dir / "current.txt"
                if current_file.exists():
                    with open(current_file, 'r', encoding='utf-8') as f:
                        return f.read().strip()
        except Exception:
            pass
        return None
