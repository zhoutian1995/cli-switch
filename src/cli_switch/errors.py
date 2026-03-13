"""错误诊断和分类模块"""

from enum import Enum
from typing import List, Optional
from dataclasses import dataclass


class ErrorType(Enum):
    """模型错误类型"""

    INVALID_API_KEY = "invalid_api_key"
    API_KEY_EXPIRED = "api_key_expired"
    MODEL_NOT_FOUND = "model_not_found"
    NETWORK_ERROR = "network_error"
    TIMEOUT = "timeout"
    CONFIG_ERROR = "config_error"
    RATE_LIMIT = "rate_limit"
    INSUFFICIENT_QUOTA = "insufficient_quota"
    UNKNOWN = "unknown"


@dataclass
class ErrorDiagnosis:
    """错误诊断结果"""

    error_type: ErrorType
    message: str
    solutions: List[str]
    status_code: Optional[int] = None
    raw_error: Optional[str] = None


ERROR_SOLUTIONS = {
    ErrorType.INVALID_API_KEY: [
        "检查环境变量是否正确设置",
        "运行 cli-switch model show <model> 查看所需环境变量",
        "更新环境变量：export API_KEY_NAME=your_key",
        "验证 API key 是否有效（未过期、未撤销）",
    ],
    ErrorType.API_KEY_EXPIRED: [
        "API key 已过期",
        "登录服务商后台续期或重新获取",
        "更新环境变量中的 API key",
    ],
    ErrorType.MODEL_NOT_FOUND: [
        "模型可能已下线或更名",
        "检查模型名称是否正确",
        "运行 cli-switch list 查看可用模型",
        "联系服务商确认模型状态",
    ],
    ErrorType.NETWORK_ERROR: [
        "检查网络连接是否正常",
        "检查代理设置（如需要）",
        "尝试切换网络环境",
        "稍后重试",
    ],
    ErrorType.TIMEOUT: [
        "网络响应超时",
        "检查网络稳定性",
        "增加超时设置：cli-switch test <model> --timeout 60",
        "稍后重试",
    ],
    ErrorType.CONFIG_ERROR: [
        "配置文件可能损坏",
        "运行 cli-switch config show 检查配置",
        "检查 ~/.cli-switch/ 目录权限",
        "重新安装：./install.sh",
    ],
    ErrorType.RATE_LIMIT: [
        "API 调用频率超限",
        "等待几分钟后重试",
        "检查是否有其他程序频繁调用",
        "升级 API 套餐",
    ],
    ErrorType.INSUFFICIENT_QUOTA: [
        "API 配额不足",
        "登录服务商后台充值",
        "检查账户余额",
        "等待配额重置（如按月）",
    ],
    ErrorType.UNKNOWN: [
        "未知错误",
        "运行 cli-switch health-check <model> 详细诊断",
        "使用 --verbose 参数查看详细信息",
        "联系技术支持",
    ],
}

ERROR_PATTERNS = [
    (["invalid_api_key", "invalid api key", "invalid authentication"], ErrorType.INVALID_API_KEY),
    (["expired", "key expired", "token expired"], ErrorType.API_KEY_EXPIRED),
    (["model_not_found", "model not found", "does not exist"], ErrorType.MODEL_NOT_FOUND),
    (["rate limit", "rate_limit", "too many requests"], ErrorType.RATE_LIMIT),
    (["insufficient_quota", "insufficient quota", "quota exceeded"], ErrorType.INSUFFICIENT_QUOTA),
    (["timeout", "timed out"], ErrorType.TIMEOUT),
    (["connection", "network", "dns", "socket"], ErrorType.NETWORK_ERROR),
    (["config", "permission denied", "access denied"], ErrorType.CONFIG_ERROR),
]


def _match_error_pattern(error_lower: str, status_code: Optional[int] = None) -> ErrorType:
    """根据错误消息匹配错误类型"""
    for patterns, error_type in ERROR_PATTERNS:
        for pattern in patterns:
            if pattern in error_lower:
                return error_type
    # 判断状态码
    if status_code:
        if status_code == 401:
            return ErrorType.INVALID_API_KEY
        elif status_code == 404:
            return ErrorType.MODEL_NOT_FOUND
        elif status_code == 429:
            return ErrorType.RATE_LIMIT
        elif status_code in (408, 504):
            return ErrorType.TIMEOUT
        elif status_code >= 500:
            return ErrorType.UNKNOWN
    return ErrorType.UNKNOWN


def diagnose_error(
    error_message: str, status_code: Optional[int] = None, verbose: bool = False
) -> ErrorDiagnosis:
    """
    诊断错误类型并提供解决方案

    Args:
        error_message: 错误消息
        status_code: HTTP 状态码
        verbose: 是否为详细模式

    Returns:
        ErrorDiagnosis: 错误诊断结果
    """
    error_lower = error_message.lower()

    error_type = _match_error_pattern(error_lower, status_code)

    solutions = ERROR_SOLUTIONS.get(error_type, ERROR_SOLUTIONS[ErrorType.UNKNOWN])

    return ErrorDiagnosis(
        error_type=error_type,
        message=_get_error_message(error_type),
        solutions=solutions,
        status_code=status_code,
        raw_error=error_message if verbose else None,
    )


def _get_error_message(error_type: ErrorType) -> str:
    """获取错误类型的友好消息"""
    messages = {
        ErrorType.INVALID_API_KEY: "API 认证失败",
        ErrorType.API_KEY_EXPIRED: "API key 已过期",
        ErrorType.MODEL_NOT_FOUND: "模型不存在",
        ErrorType.NETWORK_ERROR: "网络错误",
        ErrorType.TIMEOUT: "请求超时",
        ErrorType.CONFIG_ERROR: "配置错误",
        ErrorType.RATE_LIMIT: "请求频率超限",
        ErrorType.INSUFFICIENT_QUOTA: "配额不足",
        ErrorType.UNKNOWN: "未知错误",
    }
    return messages.get(error_type, "错误")


def format_error_report(diagnosis: ErrorDiagnosis, verbose: bool = False) -> str:
    """
    格式化错误报告

    Args:
        diagnosis: 错误诊断结果
        verbose: 是否为详细模式

    Returns:
        str: 格式化的错误报告
    """
    lines = [f"{diagnosis.error_type.value} - {diagnosis.message}", ""]

    for i, solution in enumerate(diagnosis.solutions, 1):
        lines.append(f"  {i}. {solution}")

    if verbose and diagnosis.raw_error:
        lines.extend(
            [
                "",
                "详情:",
                f"  状态码：{diagnosis.status_code or 'N/A'}",
                f"  原始错误：{diagnosis.raw_error}",
            ]
        )

    return "\n".join(lines)
