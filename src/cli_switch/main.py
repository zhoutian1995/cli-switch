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
    parser = argparse.ArgumentParser(
        prog="cli-switch",
        description="AI CLI 工具切换器",
        add_help=False  # 禁用默认帮助，以便自定义处理
    )
    parser.add_argument("--version", "-v", action="store_true", help="显示版本号")
    parser.add_argument("--config", "-c", type=str, help="自定义配置文件路径")
    parser.add_argument("--json", "-j", action="store_true", help="以 JSON 格式输出")
    parser.add_argument("--help", "-h", action="store_true", help="显示帮助")

    # 位置参数 - 可以是模型名称或命令
    parser.add_argument("command", nargs="?", default=None, help="命令或模型名称")
    parser.add_argument("model", nargs="?", default=None, help="模型名称（当 command 是 switch 时）")
    parser.add_argument("--list", "-l", action="store_true", help="列出所有模型")
    parser.add_argument("--current", action="store_true", help="显示当前模型")
    parser.add_argument("--timeout", "-t", type=int, default=30, help="超时时间（秒）")
    parser.add_argument("rest", nargs="*", help="剩余参数")

    return parser


def print_help():
    """打印帮助信息"""
    print("""cli-switch - AI CLI 工具切换器

用法:
  cli-switch <model>              切换到指定模型
  cli-switch list                 列出所有模型
  cli-switch status               显示当前状态
  cli-switch test [model]         测试模型
  cli-switch tool <tool>          选择目标工具
  cli-switch config show|edit     配置管理
  cli-switch switch <model>       切换模型
  cli-switch --list               列出所有模型
  cli-switch --current            显示当前模型

选项:
  --version, -v    显示版本号
  --help, -h       显示帮助
  --json, -j       JSON 格式输出
  --config, -c     自定义配置文件路径
  --list, -l       列出所有模型
  --current        显示当前模型
  --timeout, -t    测试超时时间（秒）

示例:
  cli-switch qwen                 切换到 Qwen3.5+
  cli-switch list                 列出所有模型
  cli-switch status               显示当前状态
  cli-switch test                 测试所有模型
  cli-switch --json list          JSON 格式列出模型
""")


def main(argv: Optional[list] = None):
    parser = create_parser()
    args = parser.parse_args(argv)

    # 处理 --version
    if args.version:
        print(f"cli-switch {__version__}")
        return

    # 处理 --help
    if args.help or args.command is None:
        print_help()
        return

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

    cmd = args.command
    json_output = args.json

    # 处理命令
    if cmd == "list" or args.list:
        handle_list(registry, json_output)
    elif cmd == "status" or args.current:
        handle_status(switcher, registry, json_output)
    elif cmd == "test":
        model_key = args.model if args.model and not args.model.startswith("-") else None
        handle_test(model_key, registry, config, json_output, args.timeout)
    elif cmd == "tool":
        if args.rest:
            config.active_tool = args.rest[0]
            config.save()
            print(f"已选择工具：{args.rest[0].upper()}")
        else:
            print("请指定工具名称：claude, gemini, codex")
            sys.exit(1)
    elif cmd == "config":
        if args.rest:
            handle_config(args.rest[0], config)
        else:
            print("请指定操作：show, edit")
            sys.exit(1)
    elif cmd == "switch":
        if args.model:
            handle_switch(args.model, registry, switcher, json_output)
        elif args.list:
            handle_list(registry, json_output)
        elif args.current:
            handle_status(switcher, registry, json_output)
        else:
            print("请指定模型名称或使用 --list 查看所有模型")
            sys.exit(1)
    else:
        # 假设是模型名称，直接切换
        handle_switch(cmd, registry, switcher, json_output)


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
