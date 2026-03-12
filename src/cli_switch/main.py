"""
CLI Switch - 主入口
"""

import sys
import argparse
import os
from typing import Optional

from . import __version__
from .models import ModelRegistry, ToolType
from .config import Config, ConfigError
from .switcher import Switcher, SwitchError


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cli-switch", description="AI CLI 工具切换器")
    parser.add_argument("--version", "-v", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--config", "-c", type=str, help="自定义配置文件路径")
    parser.add_argument("--json", "-j", action="store_true", help="以 JSON 格式输出")

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # switch 命令
    switch_parser = subparsers.add_parser("switch", help="切换模型")
    switch_parser.add_argument("model", nargs="?", help="模型名称")
    switch_parser.add_argument("--list", "-l", action="store_true", help="列出所有模型")
    switch_parser.add_argument("--current", action="store_true", help="显示当前模型")

    subparsers.add_parser("list", help="列出所有模型")
    subparsers.add_parser("status", help="显示当前状态")

    test_parser = subparsers.add_parser("test", help="测试模型")
    test_parser.add_argument("model", nargs="?", help="模型名称")
    test_parser.add_argument("--timeout", "-t", type=int, default=30, help="超时时间（秒）")

    tool_parser = subparsers.add_parser("tool", help="选择目标工具")
    tool_parser.add_argument("tool", choices=["claude", "gemini", "codex"], help="工具名称")

    config_parser = subparsers.add_parser("config", help="配置管理")
    config_parser.add_argument("action", choices=["show", "edit"], help="操作")

    return parser


def main(argv: Optional[list] = None):
    parser = create_parser()
    args = parser.parse_args(argv)

    try:
        config = Config()
        if args.config:
            config.config_path = config.config_path.__class__(args.config)
        config.load()
    except ConfigError as e:
        print(f"配置错误：{e}", file=sys.stderr)
        sys.exit(2)

    registry = ModelRegistry()
    switcher = Switcher(config)

    if args.command is None:
        if len(sys.argv) >= 2 and not sys.argv[1].startswith("-"):
            handle_switch(sys.argv[1], registry, switcher, args.json)
        else:
            parser.print_help()
    elif args.command == "switch":
        if args.list:
            handle_list(registry, args.json)
        elif args.current:
            handle_status(switcher, registry, args.json)
        elif args.model:
            handle_switch(args.model, registry, switcher, args.json)
        else:
            print("请指定模型名称或使用 --list 查看所有模型")
            sys.exit(1)
    elif args.command == "list":
        handle_list(registry, args.json)
    elif args.command == "status":
        handle_status(switcher, registry, args.json)
    elif args.command == "test":
        handle_test(args.model, registry, config, args.json, args.timeout)
    elif args.command == "tool":
        config.active_tool = args.tool
        config.save()
        print(f"已选择工具：{args.tool.upper()}")
    elif args.command == "config":
        handle_config(args.action, config)


def handle_list(registry: ModelRegistry, json_output: bool = False):
    import json
    if json_output:
        models = {}
        for tool in ToolType:
            models[tool.value] = [m.to_dict() for m in registry.list(tool)]
        print(json.dumps(models, indent=2, ensure_ascii=False))
    else:
        print("可用模型：")
        for tool in ToolType:
            print(f"\n【{tool.value.upper()}】({registry.count(tool)} 个模型)")
            print("-" * 50)
            for m in registry.list(tool):
                print(f"  {m.key:15} → {m.name} ({m.description})")


def handle_switch(model_key: str, registry: ModelRegistry, switcher: Switcher, json_output: bool = False):
    import json
    model = registry.get(model_key)
    if model is None:
        if json_output:
            print(json.dumps({"success": False, "error": f"模型 '{model_key}' 不存在",
                             "available_models": [m.key for m in registry.list()]}, indent=2, ensure_ascii=False))
        else:
            print(f"错误：模型 '{model_key}' 不存在")
            print("可用模型：", ", ".join([m.key for m in registry.list()]))
        sys.exit(1)

    success, message = switcher.switch(model)
    if json_output:
        print(json.dumps({"success": success, "model": model.to_dict(), "message": message}, indent=2, ensure_ascii=False))
    else:
        print(f"✅ {message}" if success else f"❌ {message}")
        if not success:
            sys.exit(1)


def handle_status(switcher: Switcher, registry: ModelRegistry, json_output: bool = False):
    import json
    current_key = switcher.get_current()
    current_model = registry.get(current_key) if current_key else None
    if json_output:
        print(json.dumps({
            "active_tool": current_model.tool.value if current_model else "unknown",
            "active_model": current_key or "unknown",
            "model_name": current_model.name if current_model else "unknown",
        }, indent=2, ensure_ascii=False))
    else:
        if current_model:
            print(f"当前工具：{current_model.tool.value.upper()}")
            print(f"当前模型：{current_model.name} ({current_key})")
            print(f"模型 ID: {current_model.model_id}")
        else:
            print("当前模型：未知")


def handle_test(model_key: Optional[str], registry: ModelRegistry, config: Config,
                json_output: bool = False, timeout: int = 30):
    import http.client
    import ssl
    import time
    import json

    def test_model(model) -> dict:
        result = {"model": model.key, "name": model.name, "success": False, "error": None, "latency_ms": None}
        if not model.base_url:
            result["error"] = "无 base_url，跳过测试"
            return result
        try:
            url = model.base_url.replace("https://", "")
            host, path = url.split("/", 1) if "/" in url else (url, "/")
            conn = http.client.HTTPSConnection(host, timeout=timeout, context=ssl._create_unverified_context())
            start = time.time()
            conn.request("HEAD", "/" + path if not path.startswith("/") else path)
            response = conn.getresponse()
            latency = (time.time() - start) * 1000
            result["success"] = response.status < 400
            result["latency_ms"] = round(latency, 2)
            result["status_code"] = response.status
        except Exception as e:
            result["error"] = str(e)
        return result

    if model_key:
        model = registry.get(model_key)
        if not model:
            print(f"错误：模型 '{model_key}' 不存在")
            sys.exit(1)
        results = [test_model(model)]
    else:
        models = [m for m in registry.list() if m.base_url]
        results = [test_model(m) for m in models]

    if json_output:
        print(json.dumps({
            "total": len(results),
            "passed": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "results": results,
        }, indent=2, ensure_ascii=False))
    else:
        print(f"测试 {'所有模型' if not model_key else model_key}")
        print("=" * 60)
        for r in results:
            status = "✅" if r["success"] else "❌"
            latency = f"{r['latency_ms']}ms" if r["latency_ms"] else "N/A"
            print(f"{status} {r['model']:15} - {r['name']:20} - {latency:>10} {r.get('error', '') or ''}")


def handle_config(action: str, config: Config):
    import subprocess
    if action == "show":
        print(f"配置文件：{config.config_path}")
        print(f"当前工具：{config.active_tool}")
        print(f"当前模型：{config.active_model}")
    elif action == "edit":
        editor = os.getenv("EDITOR", "vim")
        subprocess.run([editor, str(config.config_path)])


if __name__ == "__main__":
    main()
