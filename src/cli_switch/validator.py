"""
配置验证模块 - 启动时检查配置完整性

验证规则:
  P0 (error):  命令在PATH中、key唯一、provider非空
  P1 (warning): cli-switch可用、key格式规范

支持两种输入格式:
  1. cli-menu 的 TOOLS dict 格式
  2. cli-switch 的 ModelRegistry (Dict[str, Model])
"""

import shutil
from dataclasses import dataclass
from typing import List, Dict, Any, Union


@dataclass
class ValidationIssue:
    """验证问题"""
    level: str        # "error" | "warning"
    rule: str         # 规则名
    message: str      # 人类可读的错误信息
    suggestion: str   # 修复建议

    def __str__(self):
        icon = "❌" if self.level == "error" else "⚠️"
        lines = [f"  {icon} [{self.rule}] {self.message}"]
        if self.suggestion:
            lines.append(f"     建议: {self.suggestion}")
        return "\n".join(lines)


def validate_config(tools: Union[Dict[str, Any], Any]) -> List[ValidationIssue]:
    """验证工具配置，返回问题列表

    Args:
        tools: cli-menu 的 TOOLS dict, 或 cli-switch 的 ModelRegistry._models
    """
    issues = []

    # 检测输入格式
    if _is_registry_format(tools):
        issues.extend(_check_registry_command_exists(tools))
        issues.extend(_check_registry_key_unique(tools))
        issues.extend(_check_registry_key_format(tools))
    else:
        issues.extend(_check_command_exists(tools))
        issues.extend(_check_key_unique(tools))
        issues.extend(_check_provider_non_empty(tools))
        issues.extend(_check_key_format(tools))

    issues.extend(_check_cli_switch_available())
    return issues


def _is_registry_format(tools) -> bool:
    """检测是否为 ModelRegistry 格式"""
    if not tools:
        return False
    first = next(iter(tools.values()), None)
    return hasattr(first, 'model_id')  # Model 对象有 model_id 属性


# ========== Registry 格式验证 ==========

def _check_registry_command_exists(models: Dict) -> List[ValidationIssue]:
    """Registry 格式：检查工具命令是否存在"""
    # Registry 中没有 command 字段，跳过此项检查（由 cli-switch 自身处理）
    return []


def _check_registry_key_unique(models: Dict) -> List[ValidationIssue]:
    """Registry 格式：检查 key 唯一性"""
    issues = []
    seen = {}
    for key, model in models.items():
        if key in seen:
            issues.append(ValidationIssue(
                level="error",
                rule="key_unique",
                message=f"模型 key '{key}' 重复",
                suggestion="修改其中一个 key，确保唯一性"
            ))
        seen[key] = True
    return issues


def _check_registry_key_format(models: Dict) -> List[ValidationIssue]:
    """Registry 格式：检查 key 格式"""
    import re
    issues = []
    pattern = re.compile(r'^[a-z0-9][a-z0-9._-]*[a-z0-9]$|^[a-z0-9]$')
    for key, model in models.items():
        if key and not pattern.match(key):
            issues.append(ValidationIssue(
                level="warning",
                rule="key_format",
                message=f"模型 key '{key}' 不符合推荐格式（小写+连字符）",
                suggestion=f"建议改为类似 'glm-4.7' 的格式"
            ))
    return issues


# ========== CLI-Menu TOOLS dict 格式验证 ==========


def _check_command_exists(tools: Dict[str, Any]) -> List[ValidationIssue]:
    """检查每个工具的 command 是否在 PATH 中"""
    issues = []
    for tool_key, tool in tools.items():
        cmd = tool.get("command", "").split()[0]
        if cmd and not shutil.which(cmd):
            issues.append(ValidationIssue(
                level="error",
                rule="command_exists",
                message=f"工具 '{tool_key}' 的命令 '{cmd}' 不在 PATH 中",
                suggestion=f"检查 {cmd} 是否已安装，或将其路径加入 PATH"
            ))
    return issues


def _check_key_unique(tools: Dict[str, Any]) -> List[ValidationIssue]:
    """检查每个工具下所有模型 key 是否唯一"""
    issues = []
    for tool_key, tool in tools.items():
        models = tool.get("models", {})
        all_keys = []
        seen = set()
        for provider_key, provider in models.items():
            for model in provider.get("models", []):
                key = model.get("key", "")
                if key in seen:
                    issues.append(ValidationIssue(
                        level="error",
                        rule="key_unique",
                        message=f"工具 '{tool_key}' 中模型 key '{key}' 重复",
                        suggestion=f"修改其中一个 key，确保唯一性"
                    ))
                seen.add(key)
                all_keys.append(key)
    return issues


def _check_provider_non_empty(tools: Dict[str, Any]) -> List[ValidationIssue]:
    """检查每个 provider 至少有一个模型"""
    issues = []
    for tool_key, tool in tools.items():
        models = tool.get("models", {})
        for provider_key, provider in models.items():
            model_list = provider.get("models", [])
            if not model_list:
                issues.append(ValidationIssue(
                    level="error",
                    rule="provider_exists",
                    message=f"工具 '{tool_key}' 的 provider '{provider_key}' 没有模型",
                    suggestion="添加至少一个模型，或删除空的 provider"
                ))
    return issues


def _check_cli_switch_available() -> List[ValidationIssue]:
    """检查 cli-switch 命令是否可用"""
    if not shutil.which("cli-switch"):
        return [ValidationIssue(
            level="warning",
            rule="cli_switch_available",
            message="cli-switch 不在 PATH 中，切换功能不可用",
            suggestion="运行 pip install cli-switch 或检查 PATH"
        )]
    return []


def _check_key_format(tools: Dict[str, Any]) -> List[ValidationIssue]:
    """检查模型 key 格式是否规范（小写+连字符）"""
    import re
    issues = []
    pattern = re.compile(r'^[a-z0-9][a-z0-9._-]*[a-z0-9]$|^[a-z0-9]$')
    for tool_key, tool in tools.items():
        models = tool.get("models", {})
        for provider_key, provider in models.items():
            for model in provider.get("models", []):
                key = model.get("key", "")
                if key and not pattern.match(key):
                    issues.append(ValidationIssue(
                        level="warning",
                        rule="key_format",
                        message=f"模型 key '{key}' 不符合推荐格式（小写+连字符）",
                        suggestion=f"建议改为类似 'glm-4.7' 的格式"
                    ))
    return issues


def format_report(issues: List[ValidationIssue]) -> str:
    """格式化验证报告"""
    if not issues:
        return "✅ 配置验证通过"

    errors = [i for i in issues if i.level == "error"]
    warnings = [i for i in issues if i.level == "warning"]

    lines = [f"⚠️  配置验证发现 {len(issues)} 个问题："]

    if errors:
        lines.append("")
        lines.append("❌ 错误:")
        for issue in errors:
            lines.append(str(issue))

    if warnings:
        lines.append("")
        lines.append("⚠️ 警告:")
        for issue in warnings:
            lines.append(str(issue))

    return "\n".join(lines)
