"""
健康检查模块 - 检查模型可用性、标记过期模型、提供健康报告
"""

from datetime import datetime
from enum import Enum
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Any
import json
import requests
import os


class HealthStatus(Enum):
    """模型健康状态"""

    HEALTHY = "healthy"  # 正常
    DEGRADED = "degraded"  # 性能下降
    MAYBE_EXPIRED = "maybe_expired"  # 可能过期
    ERROR = "error"  # 错误
    UNKNOWN = "unknown"  # 未检查


@dataclass
class HealthResult:
    """健康检查结果"""

    status: HealthStatus
    message: str
    latency_ms: Optional[float] = None
    last_checked: Optional[datetime] = None
    error_type: Optional[str] = None


class HealthChecker:
    """健康检查器"""

    def __init__(self):
        self.health_file = Path.home() / ".cli-switch" / "health_status.json"
        self.config_file = Path.home() / ".cli-switch" / "config.yaml"

        # 默认配置
        self.config = {
            "health_check": {"expired_threshold_days": 30, "auto_check": False, "timeout": 10},
            "error_reporting": {"default_mode": "simple", "show_solutions": True},
        }

    def check_model_health(self, model: Any) -> HealthResult:
        """
        检查单个模型健康状态

        Args:
            model: 模型对象（包含 key, base_url, api_key_env, model_id 等属性）

        Returns:
            HealthResult: 健康检查结果
        """
        import time

        # 1. 检查配置是否完整
        if not model.base_url:
            return HealthResult(
                status=HealthStatus.ERROR, message="无 base_url 配置", error_type="MISSING_CONFIG"
            )

        # 2. 检查 API key 是否存在
        if model.api_key_env and not os.getenv(model.api_key_env):
            return HealthResult(
                status=HealthStatus.ERROR,
                message=f"API key 环境变量未设置: {model.api_key_env}",
                error_type="MISSING_API_KEY",
            )

        # 3. 发送测试请求检查连接和认证
        try:
            headers = {}
            if model.api_key_env:
                api_key = os.getenv(model.api_key_env)
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

            start_time = time.time()

            # 使用 HEAD 请求测试端点
            response = requests.head(
                model.base_url, headers=headers, timeout=self.config["health_check"]["timeout"]
            )

            latency = (time.time() - start_time) * 1000

            # 分析响应
            if response.status_code == 200:
                # 成功
                return HealthResult(status=HealthStatus.HEALTHY, message="正常", latency_ms=latency)
            elif response.status_code == 401:
                return HealthResult(
                    status=HealthStatus.ERROR, message="API 认证失败", error_type="INVALID_API_KEY"
                )
            elif response.status_code == 404:
                return HealthResult(
                    status=HealthStatus.MAYBE_EXPIRED,
                    message="模型可能已下线或更名",
                    error_type="MODEL_NOT_FOUND",
                )
            elif response.status_code == 429:
                return HealthResult(
                    status=HealthStatus.DEGRADED, message="请求频率限制", error_type="RATE_LIMITED"
                )
            else:
                return HealthResult(
                    status=HealthStatus.ERROR,
                    message=f"HTTP {response.status_code}: {response.text[:50]}...",
                    error_type="HTTP_ERROR",
                )

        except requests.exceptions.Timeout:
            return HealthResult(status=HealthStatus.ERROR, message="请求超时", error_type="TIMEOUT")
        except requests.exceptions.ConnectionError:
            return HealthResult(
                status=HealthStatus.ERROR, message="连接错误", error_type="CONNECTION_ERROR"
            )
        except Exception as e:
            return HealthResult(status=HealthStatus.ERROR, message=str(e), error_type="EXCEPTION")

    def load_health_status(self) -> Dict:
        """加载健康状态缓存"""
        if self.health_file.exists():
            try:
                with open(self.health_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data
            except Exception:
                pass
        return {"models": {}, "last_full_check": None}

    def save_health_status(self, model_key: str, result: HealthResult):
        """保存健康状态到缓存文件"""
        data = self.load_health_status()
        if "models" not in data:
            data["models"] = {}

        data["models"][model_key] = {
            "status": result.status.value,
            "message": result.message,
            "latency_ms": result.latency_ms,
            "last_checked": (
                result.last_checked.isoformat()
                if result.last_checked
                else datetime.now().isoformat()
            ),
            "error_type": result.error_type,
        }

        # 更新最后检查时间
        data["last_full_check"] = datetime.now().isoformat()

        # 确保目录存在
        self.health_file.parent.mkdir(parents=True, exist_ok=True)

        # 临时文件+重命名确保原子性
        temp_file = self.health_file.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        temp_file.replace(self.health_file)

    def is_model_expired(self, model_key: str) -> bool:
        """检查模型是否可能已过期"""
        data = self.load_health_status()
        model_data = data.get("models", {}).get(model_key, {})

        if not model_data:
            return False  # 未检查过的模型不算过期

        last_check_str = model_data.get("last_checked")
        if not last_check_str:
            return False

        try:
            last_check = datetime.fromisoformat(last_check_str)
            days_since_check = (datetime.now() - last_check).days
            threshold = self.config["health_check"]["expired_threshold_days"]
            status = model_data.get("status")
            return days_since_check >= threshold and (
                status == "error" or status == "maybe_expired"
            )
        except ValueError:
            return False

    def get_health_report(self, model_registry: Any) -> Dict[str, Any]:
        """
        生成健康报告

        Args:
            model_registry: 模型注册表对象

        Returns:
            Dict: 健康报告
        """
        healthy_count = 0
        degraded_count = 0
        maybe_expired_count = 0
        error_count = 0
        unknown_count = 0

        report = {
            "summary": {
                "total": 0,
                "healthy": 0,
                "degraded": 0,
                "maybe_expired": 0,
                "error": 0,
                "unknown": 0,
            },
            "model_details": [],  # Changed from 'details' to 'model_details'
        }

        all_models = model_registry.list()
        report["summary"]["total"] = len(all_models)

        data = self.load_health_status()
        models_health = data.get("models", {})

        for model in all_models:
            health_info = models_health.get(model.key, {})

            if health_info:
                status = HealthStatus(health_info.get("status", "unknown"))
                detail = {
                    "model": model.key,
                    "name": model.name,
                    "status": status.value,
                    "message": health_info.get("message", "Unknown"),
                    "latency_ms": health_info.get("latency_ms"),
                    "last_checked": health_info.get("last_checked"),
                    "error_type": health_info.get("error_type"),
                }

                # 分类统计
                if status == HealthStatus.HEALTHY:
                    healthy_count += 1
                    report["summary"]["healthy"] += 1
                elif status == HealthStatus.DEGRADED:
                    degraded_count += 1
                    report["summary"]["degraded"] += 1
                elif status == HealthStatus.MAYBE_EXPIRED:
                    maybe_expired_count += 1
                    report["summary"]["maybe_expired"] += 1
                elif status == HealthStatus.ERROR:
                    error_count += 1
                    report["summary"]["error"] += 1
                else:
                    unknown_count += 1
                    report["summary"]["unknown"] += 1
            else:
                # 没有健康记录的模型视为未知状态
                detail = {
                    "model": model.key,
                    "name": model.name,
                    "status": "unknown",
                    "message": "未检查",
                    "latency_ms": None,
                    "last_checked": None,
                    "error_type": None,
                }
                unknown_count += 1

            report["model_details"].append(detail)  # Changed from 'details' to 'model_details'

        return report

    def mark_model_maybe_expired(self, model_key: str, reason: str = ""):
        """手动标记模型可能已过期"""
        result = HealthResult(
            status=HealthStatus.MAYBE_EXPIRED,
            message=f"手动标记可能过期: {reason}" if reason else "可能已过期",
            error_type="MANUAL_EXPIRY",
        )
        result.last_checked = datetime.now()
        self.save_health_status(model_key, result)

    def update_config(self):
        """更新配置，从配置文件加载或使用默认值"""
        if self.config_file.exists():
            try:
                import yaml

                with open(self.config_file, "r", encoding="utf-8") as f:
                    file_config = yaml.safe_load(f)
                    if file_config:
                        # 合并配置 - 简化的合并
                        def merge_dict(base: dict, override: dict):
                            result = base.copy()
                            for key, value in override.items():
                                if (
                                    key in result
                                    and isinstance(result[key], dict)
                                    and isinstance(value, dict)
                                ):
                                    result[key] = merge_dict(result[key], value)
                                else:
                                    result[key] = value
                            return result

                        self.config = merge_dict(self.config, file_config)
            except ImportError:
                # 如果没有yaml库，保持默认配置
                pass
            except Exception:
                # 配置文件损坏时使用默认值
                pass
