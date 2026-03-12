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
            "tags": self.tags,
        }


class ModelRegistry:
    """模型注册表 - 管理所有可用模型"""

    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._load_default_models()

    def _load_default_models(self):
        """加载默认模型配置 - 根据用户提供的完整模型列表"""
        models = [
            # === 百炼模型 (Claude Code / Codex CLI) ===
            Model("qwen", "Qwen3.5+", ToolType.CLAUDE, "qwen3.5-plus", "通义千问 3.5 增强版", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "recommended"]),
            Model("qwen-max", "Qwen3 Max", ToolType.CLAUDE, "qwen3-max-2026-01-23", "通义千问 3 Max 版", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian"]),
            Model("qwen-next", "Qwen Coder Next", ToolType.CLAUDE, "qwen3-coder-next", "通义千问 3 Coder 下一代", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "code"]),
            Model("qwen-coder", "Qwen Coder+", ToolType.CLAUDE, "qwen3-coder-plus", "通义千问 3 Coder 增强版", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "code"]),
            Model("minimax", "MiniMax M2.5", ToolType.CLAUDE, "MiniMax-M2.5", "一般", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian"]),
            Model("glm", "GLM-5 (百炼)", ToolType.CLAUDE, "glm-5", "代码专用", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "code"]),
            Model("glm47", "GLM-4.7 (百炼)", ToolType.CLAUDE, "glm-4.7", "代码模型", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian", "code"]),
            Model("kimi", "Kimi K2.5", ToolType.CLAUDE, "kimi-k2.5", "一般", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "BAILIAN_API_KEY", tags=["bailian"]),

            # === 智谱模型 (Claude Code / Gemini CLI) ===
            Model("glm47-zhipu", "GLM-4.7", ToolType.CLAUDE, "glm-4.7", "平衡", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu"]),
            Model("glm5-zhipu", "智谱 GLM-5", ToolType.CLAUDE, "glm-5", "最强", "https://open.bigmodel.cn/api/anthropic", "ZHIPU_API_KEY", tags=["zhipu"]),

            # === Fucheers 模型 (仅 Claude Code) ===
            Model("opus4.6", "Opus 4.6", ToolType.CLAUDE, "claude-opus-4-6", "写后端代码专用", "https://www.fucheers.top", "FUCHEERS_API_KEY", tags=["fucheers"]),

            # === Gemini CLI 模型 ===
            Model("gemini-31-pro", "Gemini 3.1 Pro", ToolType.GEMINI, "gemini-3.1-pro", "写前端代码 - 推理能力领先", api_key_env="GEMINI_API_KEY", tags=["google", "recommended"]),
            Model("nanobanana", "Gemini 3 Pro Image", ToolType.GEMINI, "gemini-3-pro-image", "画图专用", api_key_env="GEMINI_API_KEY", tags=["google", "image"]),

            # === Codex CLI 模型 ===
            Model("gpt-5.2-codex", "GPT-5.2 Codex", ToolType.CODEX, "gpt-5.2-codex", "深度搜索", tags=["openai"]),
            Model("gpt-5.4-codex", "GPT-5.4 Codex", ToolType.CODEX, "gpt-5-4-codex", "代码 review", tags=["openai"]),
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
