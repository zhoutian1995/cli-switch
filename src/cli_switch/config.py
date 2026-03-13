"""
配置管理 - 加载和保存 YAML 配置文件

[Phase 2.6] 备份改用 shutil.copy2() + 原子写入 (temp+rename)
"""

import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
import yaml


class ConfigError(Exception):
    """配置相关错误"""

    pass


class Config:
    """配置管理器"""

    DEFAULT_CONFIG_PATHS = {
        "darwin": Path.home() / "Library" / "Application Support" / "cli-switch" / "config.yaml",
        "linux": Path.home() / ".config" / "cli-switch" / "config.yaml",
        "windows": Path(os.getenv("APPDATA", "")) / "cli-switch" / "config.yaml",
    }

    def __init__(self, config_path: Optional[Path] = None):
        if config_path is None:
            import sys

            config_path = self.DEFAULT_CONFIG_PATHS.get(
                sys.platform, self.DEFAULT_CONFIG_PATHS["linux"]
            )
        self.config_path = config_path
        self._data: Dict[str, Any] = {}
        self._load_defaults()

    def _load_defaults(self):
        self._data = {
            "active_tool": "claude",
            "active_model": "qwen",
            "test": {"connect_timeout": 5, "response_timeout": 30},
            "log": {
                "level": "INFO",
                "path": str(Path.home() / ".local" / "share" / "cli-switch" / "logs"),
            },
        }

    def load(self) -> Dict[str, Any]:
        if not self.config_path.exists():
            return self._data
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                content = f.read()
            if content.strip():
                loaded = yaml.safe_load(content)
                if loaded:
                    self._data.update(loaded)
        except yaml.YAMLError as e:
            backup_path = self.config_path.with_suffix(".yaml.bak")
            self.config_path.rename(backup_path)
            raise ConfigError(f"配置文件解析错误，已备份到 {backup_path}: {e}")
        except Exception as e:
            raise ConfigError(f"读取配置文件失败：{e}")
        return self._data

    def save(self):
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            # [Phase 2.6] 备份改用 copy2，保留原文件（rename 会删除原文件）
            if self.config_path.exists():
                backup_path = self.config_path.with_suffix(".yaml.bak")
                shutil.copy2(self.config_path, backup_path)
            # [Phase 2.6] 原子写入：temp + rename
            temp_file = self.config_path.with_suffix(".yaml.tmp")
            with open(temp_file, "w", encoding="utf-8") as f:
                yaml.dump(self._data, f, allow_unicode=True, default_flow_style=False)
            temp_file.replace(self.config_path)
        except Exception as e:
            raise ConfigError(f"保存配置文件失败：{e}")

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self._data
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    def set(self, key: str, value: Any):
        keys = key.split(".")
        data = self._data
        for k in keys[:-1]:
            if k not in data:
                data[k] = {}
            data = data[k]
        data[keys[-1]] = value

    @property
    def active_tool(self) -> str:
        return self._data.get("active_tool", "claude")

    @active_tool.setter
    def active_tool(self, value: str):
        self._data["active_tool"] = value

    @property
    def active_model(self) -> str:
        return self._data.get("active_model", "qwen")

    @active_model.setter
    def active_model(self, value: str):
        self._data["active_model"] = value

    @property
    def connect_timeout(self) -> int:
        return self.get("test.connect_timeout", 5)

    @property
    def response_timeout(self) -> int:
        return self.get("test.response_timeout", 30)
