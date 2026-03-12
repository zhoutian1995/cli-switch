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
        }


class ModelRegistry:
    """模型注册表 - 管理所有可用模型"""

    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._load_default_models()

    def _load_default_models(self):
        """加载默认模型配置

        根据用户提供的模型列表:
        - 百炼模型 (8 个): 支持 Claude Code / Codex CLI
        - 智谱模型 (2 个): 支持 Claude Code / Gemini CLI
        - Fucheers (1 个): 仅支持 Claude Code
        - Gemini 原生 (2 个): 仅支持 Gemini CLI
        - Codex 原生 (2 个): 仅支持 Codex CLI
        """
        models = [
            # === 百炼模型 (8 个) - 支持 Claude Code / Codex CLI ===
            Model(
                key="qwen", name="Qwen3.5+", tool=ToolType.CLAUDE, model_id="qwen3.5-plus",
                description="通义千问 3.5 增强版",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian", "recommended"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="qwen-max", name="Qwen3 Max", tool=ToolType.CLAUDE, model_id="qwen3-max-2026-01-23",
                description="通义千问 3 Max 版 (2026-01-23 版本)",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="qwen-next", name="Qwen Coder Next", tool=ToolType.CLAUDE, model_id="qwen3-coder-next",
                description="通义千问 3 Coder 下一代版",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian", "code"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="qwen-coder", name="Qwen Coder+", tool=ToolType.CLAUDE, model_id="qwen3-coder-plus",
                description="通义千问 3 Coder 增强版",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian", "code"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="minimax", name="MiniMax M2.5", tool=ToolType.CLAUDE, model_id="MiniMax-M2.5",
                description="一般",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="glm", name="GLM-5 (百炼)", tool=ToolType.CLAUDE, model_id="glm-5",
                description="代码专用",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian", "code"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="glm47", name="GLM-4.7 (百炼)", tool=ToolType.CLAUDE, model_id="glm-4.7",
                description="代码模型",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian", "code"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),
            Model(
                key="kimi", name="Kimi K2.5", tool=ToolType.CLAUDE, model_id="kimi-k2.5",
                description="一般",
                base_url="https://coding.dashscope.aliyuncs.com/apps/anthropic",
                api_key_env="BAILIAN_API_KEY",
                tags=["bailian"],
                supported_tools=[ToolType.CLAUDE, ToolType.CODEX]
            ),

            # === 智谱模型 (2 个) - 支持 Claude Code / Gemini CLI ===
            Model(
                key="glm47-zhipu", name="GLM-4.7", tool=ToolType.CLAUDE, model_id="glm-4.7",
                description="平衡",
                base_url="https://open.bigmodel.cn/api/anthropic",
                api_key_env="ZHIPU_API_KEY",
                tags=["zhipu"],
                supported_tools=[ToolType.CLAUDE, ToolType.GEMINI]
            ),
            Model(
                key="glm5-zhipu", name="智谱 GLM-5", tool=ToolType.CLAUDE, model_id="glm-5",
                description="最强",
                base_url="https://open.bigmodel.cn/api/anthropic",
                api_key_env="ZHIPU_API_KEY",
                tags=["zhipu"],
                supported_tools=[ToolType.CLAUDE, ToolType.GEMINI]
            ),

            # === Fucheers 模型 (1 个) - 仅支持 Claude Code ===
            Model(
                key="opus4.6", name="Opus 4.6", tool=ToolType.CLAUDE, model_id="claude-opus-4-6",
                description="写后端代码专用",
                base_url="https://www.fucheers.top",
                api_key_env="FUCHEERS_API_KEY",
                tags=["fucheers"],
                supported_tools=[ToolType.CLAUDE]
            ),

            # === Gemini CLI 原生模型 (2 个) - 仅支持 Gemini CLI ===
            Model(
                key="gemini-2.5-pro", name="Gemini 2.5 Pro", tool=ToolType.GEMINI, model_id="gemini-2.5-pro",
                description="写前端代码 - 推理能力领先",
                api_key_env="GEMINI_API_KEY",
                tags=["google", "recommended"],
                supported_tools=[ToolType.GEMINI]
            ),
            Model(
                key="nanobanana", name="Gemini 2.5 Flash", tool=ToolType.GEMINI, model_id="gemini-2.5-flash",
                description="画图专用",
                api_key_env="GEMINI_API_KEY",
                tags=["google", "image"],
                supported_tools=[ToolType.GEMINI]
            ),

            # === Codex CLI 原生模型 (2 个) - 仅支持 Codex CLI ===
            Model(
                key="gpt-5.2-codex", name="GPT-5.2 Codex", tool=ToolType.CODEX, model_id="gpt-5.2-codex",
                description="深度搜索",
                tags=["openai"],
                supported_tools=[ToolType.CODEX]
            ),
            Model(
                key="gpt-5.4-codex", name="GPT-5.4 Codex", tool=ToolType.CODEX, model_id="gpt-5-4-codex",
                description="代码 review",
                tags=["openai"],
                supported_tools=[ToolType.CODEX]
            ),
        ]
        for m in models:
            self.register(m)

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
