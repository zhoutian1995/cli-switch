"""
MCP 配置管理 - 管理 MCP Server 配置

支持智谱视觉理解 MCP、web-search MCP、web-reader MCP 等服务器的配置和管理。
"""

import json
import os
import shutil
import copy
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple


class MCPError(Exception):
    """MCP 相关错误"""

    pass


class MCPServer:
    """MCP Server 数据类"""

    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config

    @property
    def type(self) -> str:
        return self.config.get("type", "stdio")

    @property
    def command(self) -> str:
        return self.config.get("command", "")

    @property
    def args(self) -> List[str]:
        return self.config.get("args", [])

    @property
    def env(self) -> Dict[str, str]:
        return self.config.get("env", {})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type,
            "command": self.command,
            "args": self.args,
            "env": self.env,
        }


class MCPManager:
    """MCP 配置管理器"""

    # Claude Code 配置文件路径
    CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"
    CLAUDE_SETTINGS_LOCAL = Path.home() / ".claude" / "settings.local.json"

    # 智谱 MCP Server 配置
    ZAI_MCP_SERVER = {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@z_ai/mcp-server"],
        "env": {"Z_AI_API_KEY": "your_api_key", "Z_AI_MODE": "ZHIPU"},
    }

    # MCP 工具描述
    MCP_TOOLS = {
        "zai-mcp-server": {
            "ui_to_artifact": "UI 截图转代码/提示词/设计规范",
            "extract_text_from_screenshot": "OCR 文字提取",
            "diagnose_error_screenshot": "错误截图诊断",
            "understand_technical_diagram": "技术图表理解",
            "analyze_data_visualization": "数据可视化分析",
            "ui_diff_check": "UI 差异对比",
            "image_analysis": "通用图像分析",
            "video_analysis": "视频分析",
        },
        "web-search": {
            "search": "网页搜索",
        },
        "web-reader": {
            "read": "网页读取",
        },
    }

    def __init__(self):
        self.settings_path = self.CLAUDE_SETTINGS
        self.settings_local_path = self.CLAUDE_SETTINGS_LOCAL

    def _load_json(self, path: Path) -> Dict[str, Any]:
        """加载 JSON 文件"""
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise MCPError(f"配置文件解析错误：{path}: {e}")

    def _save_json(self, path: Path, data: Dict[str, Any]):
        """保存 JSON 文件"""
        path.parent.mkdir(parents=True, exist_ok=True)

        # 备份现有文件
        if path.exists():
            backup_path = path.with_suffix(".json.bak")
            shutil.copy2(path, backup_path)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def list_servers(self) -> List[MCPServer]:
        """列出所有已配置的 MCP Server"""
        settings = self._load_json(self.settings_path)
        mcp_servers = settings.get("mcpServers", {})

        servers = []
        for name, config in mcp_servers.items():
            servers.append(MCPServer(name, config))
        return servers

    def get_server(self, name: str) -> Optional[MCPServer]:
        """获取指定 MCP Server 配置"""
        settings = self._load_json(self.settings_path)
        mcp_servers = settings.get("mcpServers", {})

        if name in mcp_servers:
            return MCPServer(name, mcp_servers[name])
        return None

    def add_server(self, name: str, config: Dict[str, Any]) -> Tuple[bool, str]:
        """添加 MCP Server 配置"""
        try:
            settings = self._load_json(self.settings_path)

            if "mcpServers" not in settings:
                settings["mcpServers"] = {}

            if name in settings["mcpServers"]:
                return False, f"MCP Server 已存在：{name}"

            settings["mcpServers"][name] = config
            self._save_json(self.settings_path, settings)
            return True, f"已添加 MCP Server: {name}"

        except Exception as e:
            return False, f"添加失败：{e}"

    def remove_server(self, name: str) -> Tuple[bool, str]:
        """移除 MCP Server 配置"""
        try:
            settings = self._load_json(self.settings_path)

            if "mcpServers" not in settings:
                return False, "未配置任何 MCP Server"

            if name not in settings["mcpServers"]:
                return False, f"MCP Server 不存在：{name}"

            del settings["mcpServers"][name]
            self._save_json(self.settings_path, settings)
            return True, f"已移除 MCP Server: {name}"

        except Exception as e:
            return False, f"移除失败：{e}"

    def install_zai_mcp(self, api_key: Optional[str] = None) -> Tuple[bool, str]:
        """安装智谱视觉理解 MCP Server"""
        config = copy.deepcopy(self.ZAI_MCP_SERVER)

        # 如果提供了 API Key，更新配置
        if api_key:
            config["env"]["Z_AI_API_KEY"] = api_key
        elif os.getenv("Z_AI_API_KEY"):
            config["env"]["Z_AI_API_KEY"] = os.getenv("Z_AI_API_KEY")

        return self.add_server("zai-mcp-server", config)

    def enable_web_search(self) -> Tuple[bool, str]:
        """启用 web-search MCP 权限"""
        try:
            settings = self._load_json(self.settings_local_path)

            if "permissions" not in settings:
                settings["permissions"] = {}

            # 添加 web-search 权限
            settings["permissions"]["https://mcp.z.ai/web-search"] = {"enabled": True}

            self._save_json(self.settings_local_path, settings)
            return True, "已启用 web-search MCP 权限"

        except Exception as e:
            return False, f"启用失败：{e}"

    def enable_web_reader(self) -> Tuple[bool, str]:
        """启用 web-reader MCP 权限"""
        try:
            settings = self._load_json(self.settings_local_path)

            if "permissions" not in settings:
                settings["permissions"] = {}

            # 添加 web-reader 权限
            settings["permissions"]["https://mcp.z.ai/web-reader"] = {"enabled": True}

            self._save_json(self.settings_local_path, settings)
            return True, "已启用 web-reader MCP 权限"

        except Exception as e:
            return False, f"启用失败：{e}"

    def get_tools(self, server_name: str) -> Dict[str, str]:
        """获取 MCP Server 提供的工具列表"""
        return self.MCP_TOOLS.get(server_name, {})

    def show_server_info(self, name: str) -> str:
        """显示 MCP Server 详细信息"""
        server = self.get_server(name)
        if not server:
            return f"MCP Server 不存在：{name}"

        lines = [
            f"MCP Server: {name}",
            f"  类型：{server.type}",
            f"  命令：{server.command}",
            f"  参数：{' '.join(server.args)}",
            "  环境变量:",
        ]
        for key, value in server.env.items():
            masked_value = "******" if "KEY" in key or "TOKEN" in key else value
            lines.append(f"    {key}={masked_value}")

        # 显示工具列表
        tools = self.get_tools(name)
        if tools:
            lines.append(f"  可用工具 ({len(tools)} 个):")
            for tool_name, description in tools.items():
                lines.append(f"    - {tool_name}: {description}")

        return "\n".join(lines)
