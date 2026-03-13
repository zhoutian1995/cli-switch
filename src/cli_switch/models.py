"""
模型定义和管理
"""

import sys
from dataclasses import dataclass, field
from importlib.resources import files
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum

import yaml


class ToolType(Enum):
    """支持的 CLI 工具类型"""

    CLAUDE = "claude"
    GEMINI = "gemini"
    CODEX = "codex"


@dataclass
class Model:
    """模型数据类

    Args:
        key: 模型唯一标识
        name: 模型显示名称
        tool: 主要支持的工具
        model_id: 实际使用的模型 ID
        description: 模型描述
        base_url: API 端点 URL
        api_key_env: API 密钥的环境变量名
        tags: 标签列表
        supported_tools: 支持的工具列表 (用于菜单展示)
        gemini_model_id: Gemini CLI 使用的模型 ID (可选)
        codex_model_id: Codex CLI 使用的模型 ID (可选)
        source: 模型来源 (builtin/custom)
    """

    key: str
    name: str
    tool: ToolType
    model_id: str
    description: str = ""
    base_url: Optional[str] = None
    api_key_env: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    supported_tools: List[ToolType] = field(default_factory=list)
    gemini_model_id: Optional[str] = None  # Gemini CLI 专用模型 ID
    codex_model_id: Optional[str] = None  # Codex CLI 专用模型 ID
    api_base_url: Optional[str] = None  # 自定义 API 端点（用于图片生成等）
    source: str = "builtin"  # builtin 或 custom

    def __post_init__(self):
        # 如果没有指定支持的工具列表，默认只支持主要工具
        if not self.supported_tools:
            self.supported_tools = [self.tool]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "key": self.key,
            "name": self.name,
            "tool": self.tool.value,
            "model_id": self.model_id,
            "description": self.description,
            "base_url": self.base_url,
            "api_key_env": self.api_key_env,
            "tags": self.tags,
            "supported_tools": [t.value for t in self.supported_tools],
            "gemini_model_id": self.gemini_model_id,
            "codex_model_id": self.codex_model_id,
            "api_base_url": self.api_base_url,
            "source": self.source,
        }


class ModelRegistry:
    """模型注册表 - 管理所有可用模型

    加载优先级：
    1. 内置 default_models.yaml（随包分发）
    2. 用户 ~/.cli-switch/custom_models.yaml（覆盖内置）
    """

    CUSTOM_MODELS_PATH = Path.home() / ".cli-switch" / "custom_models.yaml"

    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._load_default_models()

    def _load_default_models(self):
        """从 YAML 文件加载模型配置"""
        # 1. 加载内置模型
        builtin = self._load_builtin_yaml()
        for key, data in builtin.items():
            model = self._dict_to_model(key, data, source="builtin")
            if model:
                self.register(model)

        # 2. 加载用户自定义模型（覆盖内置）
        if self.CUSTOM_MODELS_PATH.exists():
            custom = self._load_yaml_file(self.CUSTOM_MODELS_PATH)
            for key, data in custom.items():
                model = self._dict_to_model(key, data, source="custom")
                if model:
                    self.register(model)

    def _load_builtin_yaml(self) -> Dict[str, Any]:
        """加载包内 default_models.yaml"""
        try:
            yaml_text = (
                files("cli_switch").joinpath("default_models.yaml").read_text(encoding="utf-8")
            )
            config = yaml.safe_load(yaml_text)
            return config.get("models", {}) if config else {}
        except Exception as e:
            print(f"警告：无法加载内置模型配置: {e}", file=sys.stderr)
            return {}

    def _load_yaml_file(self, path: Path) -> Dict[str, Any]:
        """加载外部 YAML 文件"""
        try:
            with open(path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f.read())
            return config.get("models", {}) if config else {}
        except yaml.YAMLError as e:
            print(f"警告：自定义模型配置 YAML 解析错误 ({path}): {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"警告：无法读取自定义模型配置 ({path}): {e}", file=sys.stderr)
            return {}

    def _dict_to_model(
        self, key: str, data: Dict[str, Any], source: str = "builtin"
    ) -> Optional[Model]:
        """将 YAML 字典转换为 Model 对象

        缺少必填字段时打印友好提示并跳过，不崩溃。
        同时会过滤掉MCP服务器配置等特殊条目

        Args:
            key: 模型键
            data: 模型数据字典
            source: 源标识
        Returns:
            Model 对象或 None
        """
        # 过滤MCP服务器配置等特殊条目
        if key.endswith("-mcp-server") or "mcp-server" in str(data.get("name", "")).lower():
            print(f"⚠️ 跳过非模型配置项: {key} (MCP服务器配置)", file=sys.stderr)
            return None
        if data.get("mcp_type") == "server":
            print(f"⚠️ 跳过非模型配置项: {key} (MCP服务器)", file=sys.stderr)
            return None

        # 检查是否包含必要的模型字段
        required_fields = ["tool", "model_id"]
        has_required_fields = any(field in data for field in required_fields)

        # 检查是否为服务器配置
        server_config_fields = [
            "mcp_type",
            "mcp_endpoints",
            "server_config",
            "binary",
            "port_range",
        ]
        is_server_config = any(field in data for field in server_config_fields)

        if not has_required_fields and is_server_config:
            print(f"⚠️ 跳过非模型配置项: {key} (服务器配置)", file=sys.stderr)
            return None

        # 统一必填字段检查
        for required in ("name", "tool", "model_id"):
            if required not in data:
                print(f"⚠️ 跳过模型 '{key}': 缺少必填字段 '{required}'", file=sys.stderr)
                return None

        # tool 字符串转 ToolType
        try:
            tool = ToolType(data["tool"])
        except ValueError:
            print(
                f"⚠️ 跳过模型 '{key}': 未知的工具类型 '{data['tool']}' (支持: claude, gemini, codex)",
                file=sys.stderr,
            )
            return None

        # supported_tools 转换
        supported_tools = []
        for t in data.get("supported_tools", []):
            try:
                supported_tools.append(ToolType(t))
            except ValueError:
                pass  # 忽略无效的工具类型

        return Model(
            key=key,
            name=data["name"],
            tool=tool,
            model_id=data["model_id"],
            description=data.get("description", ""),
            base_url=data.get("base_url"),
            api_key_env=data.get("api_key_env"),
            tags=data.get("tags", []),
            supported_tools=supported_tools,
            gemini_model_id=data.get("gemini_model_id"),
            codex_model_id=data.get("codex_model_id"),
            api_base_url=data.get("api_base_url"),
            source=source,
        )

    def register(self, model: Model):
        self._models[model.key] = model

    def get(self, key: str) -> Optional[Model]:
        return self._models.get(key)

    def list(self, tool: Optional[ToolType] = None) -> List[Model]:
        """列出模型

        Args:
            tool: 如果指定，只返回支持该工具的模型
        """
        if tool is None:
            return list(self._models.values())
        return [m for m in self._models.values() if tool in m.supported_tools]

    def list_for_tool(self, tool: ToolType) -> List[Model]:
        """列出支持指定工具的所有模型"""
        return self.list(tool)

    def exists(self, key: str) -> bool:
        return key in self._models

    def count(self, tool: Optional[ToolType] = None) -> int:
        if tool is None:
            return len(self._models)
        return len(self.list(tool))

    def to_dict(self) -> Dict[str, List[Dict[str, Any]]]:
        """将所有模型转换为字典格式，按工具分组"""
        result = {}
        for tool in ToolType:
            result[tool.value] = [m.to_dict() for m in self.list(tool)]
        return result

    # === 自定义模型管理 ===

    @classmethod
    def load_custom_models(cls) -> Dict[str, Any]:
        """读取用户自定义模型配置"""
        if not cls.CUSTOM_MODELS_PATH.exists():
            return {"models": {}}
        try:
            with open(cls.CUSTOM_MODELS_PATH, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f.read())
            return config if config else {"models": {}}
        except Exception:
            return {"models": {}}

    @classmethod
    def save_custom_models(cls, config: Dict[str, Any]) -> bool:
        """保存用户自定义模型配置（全量写入）"""
        try:
            cls.CUSTOM_MODELS_PATH.parent.mkdir(parents=True, exist_ok=True)
            temp_file = cls.CUSTOM_MODELS_PATH.with_suffix(".yaml.tmp")
            with open(temp_file, "w", encoding="utf-8") as f:
                yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
            temp_file.rename(cls.CUSTOM_MODELS_PATH)
            return True
        except Exception:
            return False

    @classmethod
    def add_custom_model(cls, key: str, data: Dict[str, Any]) -> bool:
        """添加自定义模型"""
        config = cls.load_custom_models()
        if "models" not in config:
            config["models"] = {}
        config["models"][key] = data
        return cls.save_custom_models(config)

    @classmethod
    def remove_custom_model(cls, key: str) -> bool:
        """移除自定义模型"""
        config = cls.load_custom_models()
        models = config.get("models", {})
        if key not in models:
            return False
        del models[key]
        return cls.save_custom_models(config)

    def is_custom(self, key: str) -> bool:
        """检查模型是否为自定义模型"""
        model = self.get(key)
        return model is not None and model.source == "custom"
