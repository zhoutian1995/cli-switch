"""
模型定义和管理
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class ToolType(Enum):
    """支持的 CLI 工具类型"""
    CLAUDE = "claude"
    GEMINI = "gemini"
    CODEX = "codex"


@dataclass
class Model:
    """模型数据类"""
    key: str
    name: str
    tool: ToolType
    model_id: str
    description: str = ""
    base_url: Optional[str] = None
    api_key_env: Optional[str] = None
    config_field: Optional[str] = None
    tags: List[str] = field(default_factory=list)

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
            "config_field": self.config_field,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Model":
        """从字典创建"""
        return cls(
            key=data["key"],
            name=data["name"],
            tool=ToolType(data["tool"]),
            model_id=data["model_id"],
            description=data.get("description", ""),
            base_url=data.get("base_url"),
            api_key_env=data.get("api_key_env"),
            config_field=data.get("config_field"),
            tags=data.get("tags", []),
        )


class ModelRegistry:
    """模型注册表 - 管理所有可用模型"""

    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._load_default_models()

    def _load_default_models(self):
        """加载默认模型配置"""
        models = [
            # fucheers Claude 原生
            Model("opus", "Claude Opus 4.6", ToolType.CLAUDE, "claude-opus-4-6", "最强写作模型", tags=["fucheers"]),
            Model("opus45", "Claude Opus 4.5", ToolType.CLAUDE, "claude-opus-4.5-20251101", "强", tags=["fucheers"]),
            Model("sonnet", "Claude Sonnet 4.5", ToolType.CLAUDE, "claude-sonnet-4.5-20250929", "中等", tags=["fucheers"]),
            Model("haiku", "Claude Haiku 4.5", ToolType.CLAUDE, "claude-haiku-4.5-20251001", "轻量", tags=["fucheers"]),
            # 智谱 Zhipu
            Model("zhipu", "智谱 GLM", ToolType.CLAUDE, "glm-4.5-air", "多模型选择", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu"]),
            Model("glm45", "GLM-4.5", ToolType.CLAUDE, "glm-4.5", "基础模型", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu"]),
            Model("glm47", "GLM-4.7", ToolType.CLAUDE, "glm-4.7", "平衡性能", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu"]),
            Model("glm5", "GLM-5", ToolType.CLAUDE, "glm-5", "最强性能", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu"]),
            Model("glm-flash", "GLM-4-Flash", ToolType.CLAUDE, "glm-4-flash", "免费快速", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu", "free"]),
            # 阿里云百炼
            Model("qwen", "Qwen3.5+", ToolType.CLAUDE, "qwen3.5-plus", "⭐推荐", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "recommended"]),
            Model("kimi", "Kimi K2.5", ToolType.CLAUDE, "kimi-k2.5", "⭐推荐", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "recommended"]),
            Model("glm", "GLM-5 (百炼)", ToolType.CLAUDE, "glm-5", "⭐推荐 代码专用", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "code"]),
            Model("minimax", "MiniMax M2.5", ToolType.CLAUDE, "MiniMax-M2.5", "⭐推荐", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian"]),
            # Gemini CLI
            Model("gemini-2.5-pro", "Gemini 2.5 Pro", ToolType.GEMINI, "gemini-2.5-pro", "写前端代码", api_key_env="GEMINI_API_KEY", tags=["google", "recommended"]),
            Model("nanobanana", "Nano Banana 2", ToolType.GEMINI, "gemini-2.5-flash", "画图专用", api_key_env="GEMINI_API_KEY", tags=["google", "image"]),
            # Codex CLI
            Model("gpt-5.2-codex", "GPT-5.2 Codex", ToolType.CODEX, "gpt-5.2-codex", "深度搜索", api_key_env="OPENAI_API_KEY", tags=["openai"]),
            Model("gpt-5.4-codex", "GPT-5.4 Codex", ToolType.CODEX, "gpt-5-4-codex", "代码 review", api_key_env="OPENAI_API_KEY", tags=["openai"]),
        ]
        for m in models:
            self.register(m)

    def register(self, model: Model):
        self._models[model.key] = model

    def get(self, key: str) -> Optional[Model]:
        return self._models.get(key)

    def list(self, tool: Optional[ToolType] = None) -> List[Model]:
        if tool is None:
            return list(self._models.values())
        return [m for m in self._models.values() if m.tool == tool]

    def exists(self, key: str) -> bool:
        return key in self._models

    def count(self, tool: Optional[ToolType] = None) -> int:
        if tool is None:
            return len(self._models)
        return len(self.list(tool))
