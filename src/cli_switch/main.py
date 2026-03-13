"""
CLI Switch - 主入口
"""

import sys
import argparse
import os
from pathlib import Path
from typing import Optional

from . import __version__
from .models import ModelRegistry, ToolType
from .config import Config, ConfigError
from .switcher import Switcher
from .mcp import MCPManager
from . import hooks as hooks_module


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cli-switch",
        description="AI CLI 工具切换器",
        add_help=False,  # 禁用默认帮助，以便自定义处理
    )
    parser.add_argument("--version", "-v", action="store_true", help="显示版本号")
    parser.add_argument("--config", "-c", type=str, help="自定义配置文件路径")
    parser.add_argument("--json", "-j", action="store_true", help="以 JSON 格式输出")
    parser.add_argument("--help", "-h", action="store_true", help="显示帮助")
    parser.add_argument("--tool", "-t", type=str, help="指定目标工具 (claude/gemini/codex)")
    parser.add_argument("--hook", type=str, help="切换后执行的 hook 命令")
    parser.add_argument("--list", "-l", action="store_true", help="列出所有模型")
    parser.add_argument("--current", action="store_true", help="显示当前模型")

    # 位置参数 - 可以是模型名称或命令
    parser.add_argument("command", nargs="?", default=None, help="命令或模型名称")
    parser.add_argument("args", nargs=argparse.REMAINDER, help="命令参数")

    return parser


def print_help():
    """打印帮助信息"""
    print("""cli-switch - AI CLI 工具切换器

用法:
  cli-switch <model>              切换到指定模型
  cli-switch list                 列出所有模型
  cli-switch status               显示当前状态
  cli-switch test [model]         测试模型连通性
  cli-switch chat-test [model]    端到端聊天测试 (真实API调用)
  cli-switch tool <tool>          选择目标工具
  cli-switch config show|edit     配置管理
  cli-switch switch <model>       切换模型
  cli-switch model <command>       自定义模型管理
  cli-switch mcp <command>        MCP 配置管理
  cli-switch hook <command>       Hook 管理
  cli-switch --list               列出所有模型
  cli-switch --current            显示当前模型
  cli-switch --tool <tool>        指定目标工具 (跨工具切换时使用)
  cli-switch --hook <command>     切换后执行 hook 命令

MCP 命令:
  mcp list                        列出已配置的 MCP Server
  mcp show <name>                 显示 MCP Server 详情
  mcp add <name>                  添加 MCP Server (如：zai-mcp-server)
  mcp remove <name>               移除 MCP Server
  mcp install-zai [api-key]       安装智谱视觉 MCP
  mcp enable-web-search           启用 web-search 权限
  mcp enable-web-reader           启用 web-reader 权限

模型管理命令:
  model list                      列出所有模型（含来源标记）
  model show <key>                显示模型详情
  model add <key> [options]       添加自定义模型
  model remove <key>              移除自定义模型

Hook 命令:
  hook install                    安装 shell precmd hook
  hook uninstall                  卸载 shell precmd hook
  hook config show                显示 hooks 配置
  hook config add <type> <cmd>    添加 hook (type: post_switch, pre_tool_use)
  hook config remove <type> <cmd> 移除 hook
  hook config clear <type>        清空指定类型的 hooks

选项:
  --version, -v    显示版本号
  --help, -h       显示帮助
  --json, -j       JSON 格式输出
  --config, -c     自定义配置文件路径
  --list, -l       列出所有模型
  --current        显示当前模型
  --tool, -t       指定目标工具 (claude/gemini/codex)
  --hook           切换后执行的 hook 命令
  --timeout, -t    测试超时时间（秒）

示例:
  cli-switch qwen                 切换到 Qwen3.5+
  cli-switch list                 列出所有模型
  cli-switch status               显示当前状态
  cli-switch test                 测试所有模型
  cli-switch mcp list             列出 MCP Server
  cli-switch mcp install-zai      安装智谱视觉 MCP
  cli-switch --json list          JSON 格式列出模型
  cli-switch --hook "notify-agent switched to {model}" qwen

跨工具切换:
  cli-switch --tool gemini glm47-zhipu   切换到 Gemini CLI 使用 GLM-4.7
  cli-switch --tool codex qwen           切换到 Codex CLI 使用 Qwen3.5+

Hook 配置示例:
  cli-switch hook config add post_switch "echo 'Switched to {model}'"
  cli-switch hook config add pre_tool_use "check-model-consistency"

自定义模型示例:
  cli-switch model add my-ollama --model-id llama3 --base-url http://localhost:11434/v1 --tool claude --api-key-env OLLAMA_KEY
  cli-switch model list
  cli-switch model show my-ollama
  cli-switch model remove my-ollama
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
    cmd_args = args.args if args.args else []
    target_tool = args.tool

    # 处理 --hook 参数
    custom_hook = args.hook

    # 处理 --list
    if args.list:
        handle_list(registry, json_output)
        return

    # 处理 --current
    if args.current:
        handle_current(switcher, registry, json_output)
        return

    # 处理命令
    if cmd == "list":
        handle_list(registry, json_output)
    elif cmd == "status":
        handle_status(switcher, registry, json_output)
    elif cmd == "test":
        model_key = cmd_args[0] if cmd_args and not cmd_args[0].startswith("-") else None
        timeout = 30
        if "-t" in cmd_args:
            idx = cmd_args.index("-t")
            if idx + 1 < len(cmd_args):
                timeout = int(cmd_args[idx + 1])
        if "--timeout" in cmd_args:
            idx = cmd_args.index("--timeout")
            if idx + 1 < len(cmd_args):
                timeout = int(cmd_args[idx + 1])
        handle_test(model_key, registry, config, json_output, timeout)
    elif cmd == "chat-test":
        handle_chat_test(cmd_args, registry, json_output)
    elif cmd == "tool":
        if cmd_args:
            config.active_tool = cmd_args[0]
            config.save()
            print(f"已选择工具：{cmd_args[0].upper()}")
        else:
            print("请指定工具名称：claude, gemini, codex")
            sys.exit(1)
    elif cmd == "config":
        if cmd_args:
            handle_config(cmd_args[0], config)
        else:
            print("请指定操作：show, edit")
            sys.exit(1)
    elif cmd == "model":
        handle_model(cmd_args, registry, json_output)
    elif cmd == "mcp":
        handle_mcp(cmd_args, json_output)
    elif cmd == "hook":
        handle_hook(cmd_args, json_output, custom_hook)
    elif cmd == "health-check":
        model_key = cmd_args[0] if cmd_args and not cmd_args[0].startswith("-") else None
        handle_health_check(model_key, registry, json_output)
    elif cmd == "health-report":
        handle_health_report(registry, json_output)
    elif cmd == "image":
        # 图像生成命令
        from .images import handle_image_generation

        result = handle_image_generation(cmd_args)
        if json_output:
            import json

            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            if result["success"]:
                print(f"🎨 {result['message']}")
                for file_path in result["generated_files"]:
                    print(f"  ✅ {file_path}")
            else:
                print(f"❌ {result['error']}")
    elif cmd == "switch":
        if cmd_args:
            handle_switch(cmd_args[0], registry, switcher, json_output, target_tool, custom_hook)
        else:
            print("请指定模型名称或使用 --list 查看所有模型")
            sys.exit(1)
    else:
        # 假设是模型名称，直接切换
        handle_switch(cmd, registry, switcher, json_output, target_tool, custom_hook)


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


def handle_switch(
    model_key: str,
    registry: ModelRegistry,
    switcher: Switcher,
    json_output: bool = False,
    target_tool: Optional[str] = None,
    custom_hook: Optional[str] = None,
):
    import json

    model = registry.get(model_key)
    if model is None:
        if json_output:
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": f"模型 '{model_key}' 不存在",
                        "available_models": [m.key for m in registry.list()],
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
        else:
            print(f"错误：模型 '{model_key}' 不存在")
            print("可用模型：", ", ".join([m.key for m in registry.list()]))
        sys.exit(1)

    # 临时添加 custom hook 到配置
    if custom_hook:
        hooks_module.add_hook("post_switch", custom_hook)

    success, message = switcher.switch(model, target_tool)

    # 执行 custom hook（如果指定）
    if custom_hook and success:
        context = {
            "model": model.key,
            "tool": target_tool or model.tool.value,
            "model_id": model.model_id,
        }
        hooks_module.execute_hook(custom_hook, context, check_reentrancy=False)

    if json_output:
        print(
            json.dumps(
                {"success": success, "model": model.to_dict(), "message": message},
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        print(f"✅ {message}" if success else f"❌ {message}")
        if not success:
            sys.exit(1)


def handle_current(switcher: Switcher, registry: ModelRegistry, json_output: bool = False):
    """显示当前模型（增强版，显示 TTY 状态）"""
    import json
    from . import session

    current_key = switcher.get_current()
    current_model = registry.get(current_key) if current_key else None
    tty_state = session.get_session_state()

    if json_output:
        result = {
            "active_tool": current_model.tool.value if current_model else "unknown",
            "active_model": current_key or "unknown",
            "model_name": current_model.name if current_model else "unknown",
            "source": "tty" if tty_state else "global",
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        if tty_state:
            print(f"TTY: {tty_state.get('tty', 'unknown')}")
        if current_model:
            print(f"当前工具：{current_model.tool.value.upper()}")
            print(f"当前模型：{current_model.name} ({current_key})")
            print(f"模型 ID: {current_model.model_id}")
            if tty_state:
                print("状态来源：TTY (终端独立)")
            else:
                print("状态来源：全局 fallback")
        else:
            print("当前模型：未知")


def handle_status(switcher: Switcher, registry: ModelRegistry, json_output: bool = False):
    import json

    current_key = switcher.get_current()
    current_model = registry.get(current_key) if current_key else None
    if json_output:
        print(
            json.dumps(
                {
                    "active_tool": current_model.tool.value if current_model else "unknown",
                    "active_model": current_key or "unknown",
                    "model_name": current_model.name if current_model else "unknown",
                },
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        if current_model:
            print(f"当前工具：{current_model.tool.value.upper()}")
            print(f"当前模型：{current_model.name} ({current_key})")
            print(f"模型 ID: {current_model.model_id}")
        else:
            print("当前模型：未知")


def handle_test(
    model_key: Optional[str],
    registry: ModelRegistry,
    config: Config,
    json_output: bool = False,
    timeout: int = 30,
    verbose: bool = False,
):
    import http.client
    import ssl
    import time
    import json
    from .errors import diagnose_error, format_error_report

    def test_model(model) -> dict:
        result = {
            "model": model.key,
            "name": model.name,
            "success": False,
            "error": None,
            "latency_ms": None,
            "status_code": None,
            "error_type": None,
            "suggestion": None,
        }
        if not model.base_url:
            result["error"] = "无 base_url，跳过测试"
            return result
        try:
            url = model.base_url.replace("https://", "")
            host, path = url.split("/", 1) if "/" in url else (url, "/")
            conn = http.client.HTTPSConnection(
                host, timeout=timeout, context=ssl._create_unverified_context()
            )
            start = time.time()
            conn.request("HEAD", "/" + path if not path.startswith("/") else path)
            response = conn.getresponse()
            latency = (time.time() - start) * 1000
            result["success"] = response.status < 400
            result["latency_ms"] = round(latency, 2)
            result["status_code"] = response.status
            if not result["success"]:
                # 服务器响应但返回错误状态，进行错误诊断
                error_diag = diagnose_error(
                    error_message=f"HTTP {response.status}: Request failed",
                    status_code=response.status,
                    verbose=verbose,
                )
                result["error_type"] = error_diag.error_type.value
                result["suggestion"] = (
                    error_diag.solutions[0] if error_diag.solutions else "参考错误解决方案"
                )
        except Exception as e:
            result["error"] = str(e)
            if verbose:
                # 使用错误诊断模块诊断异常
                error_diag = diagnose_error(str(e), status_code=None, verbose=verbose)
                result["error_type"] = error_diag.error_type.value
                report = format_error_report(error_diag, verbose=verbose)
                result["detailed_diagnosis"] = report
                result["suggestion"] = (
                    error_diag.solutions[0] if error_diag.solutions else "请检查网络和配置"
                )
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
        print(
            json.dumps(
                {
                    "total": len(results),
                    "passed": sum(1 for r in results if r["success"]),
                    "failed": sum(1 for r in results if not r["success"]),
                    "verbose": verbose,
                    "results": results,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        print(
            f"测试 {'所有模型' if not model_key else model_key} (详细模式={'是' if verbose else '否'})"
        )
        print("=" * 80)
        for r in results:
            status = "✅" if r["success"] else "❌"
            latency = f"{r['latency_ms']}ms" if r["latency_ms"] else "N/A"
            if not r["success"]:
                error_msg = r.get("error", "")
                status_code = r.get("status_code", "N/A")
                suggestion = r.get("suggestion", "")

                if verbose and "detailed_diagnosis" in r:
                    message = f"[{status_code}] {error_msg}"
                    print(f"{status} {r['model']:15} - {r['name']:20} - {latency:>10} {message}")
                    print(f"    建议: {suggestion}")
                    print("    诊断详情:")
                    for line in r["detailed_diagnosis"].split("\n"):
                        if line.strip():
                            print(f"      • {line}")
                    print("    💡 提示：运行 cli-switch health-check 了解更多")
                else:
                    message = f"[{status_code}] {error_msg} - {suggestion}"
                    print(f"{status} {r['model']:15} - {r['name']:20} - {latency:>10} {message}")
            else:
                print(
                    f"{status} {r['model']:15} - {r['name']:20} - {latency:>10} [{r.get('status_code', 'N/A')}]"
                )


def handle_chat_test(args: list, registry: ModelRegistry, json_output: bool = False):
    """端到端聊天测试 - 发送真实请求验证模型身份"""
    import os
    import time
    import json
    import requests

    model_key = None
    tool_filter = None
    prompt = "你是什么模型？请简短回答。"

    i = 0
    while i < len(args):
        if args[i] == "--tool" and i + 1 < len(args):
            tool_filter = args[i + 1]
            i += 2
        elif args[i] == "--prompt" and i + 1 < len(args):
            prompt = args[i + 1]
            i += 2
        elif not args[i].startswith("-"):
            model_key = args[i]
            i += 1
        else:
            i += 1

    MODEL_KEYWORDS = {
        "qwen": ["qwen", "通义", "千问"],
        "qwen-max": ["qwen", "通义", "千问"],
        "qwen-next": ["qwen", "通义", "千问"],
        "qwen-coder": ["qwen", "通义", "千问"],
        "minimax": ["minimax", "海螺"],
        "glm": ["glm", "智谱"],
        "glm47": ["glm", "智谱"],
        "glm47-zhipu": ["glm", "智谱"],
        "glm5-zhipu": ["glm", "智谱"],
        "kimi": ["kimi", "月之暗面"],
        "opus4.6": ["claude", "opus", "antigravity"],
        "opus4.6-thinking": ["claude", "opus", "antigravity"],
        "opus4.5-20251101": ["claude", "opus", "antigravity"],
        "opus4.5-20251101-thinking": ["claude", "opus", "antigravity"],
        "sonnet4.6": ["claude", "sonnet", "antigravity", "deepmind"],
        "sonnet4.6-thinking": ["claude", "sonnet", "antigravity", "deepmind"],
        "haiku4.5-20251001": ["claude", "haiku", "antigravity", "gemini"],
        "gemini-3.1-pro": ["gemini", "google"],
        "gemini-2.5-flash": ["gemini", "google"],
        "gemini-2.5-pro": ["gemini", "google"],
        "gpt-5.2-codex": ["gpt", "openai", "chatgpt"],
    }

    def call_anthropic(model, api_key: str, prompt_text: str):
        base_url = model.base_url.rstrip("/")
        url = f"{base_url}/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": model.model_id,
            "max_tokens": 200,
            "messages": [{"role": "user", "content": prompt_text}],
        }
        r = requests.post(url, headers=headers, json=payload, timeout=120)
        if r.status_code != 200:
            return False, "", f"HTTP {r.status_code}: {r.text[:200]}"
        d = r.json()

        # OpenAI 格式
        if "choices" in d:
            text = d.get("choices", [{}])[0].get("message", {}).get("content", "")
            return True, text, ""

        # Anthropic 格式
        if "content" in d:
            content = d["content"]
            if isinstance(content, list):
                # 提取所有 text 类型的内容
                texts = []
                thinking = []
                for item in content:
                    if item.get("type") == "text" and item.get("text"):
                        texts.append(item["text"])
                    elif item.get("type") == "thinking" and item.get("thinking"):
                        thinking.append(item["thinking"])

                # 优先返回 text，如果没有 text 则返回 thinking
                if texts:
                    return True, texts[0], ""
                if thinking:
                    return True, thinking[0][:200], ""
            elif isinstance(content, str):
                return True, content, ""

        return False, "", f"未知响应格式"

    def call_gemini(model, api_key: str, prompt_text: str):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model.model_id}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {"maxOutputTokens": 500},
        }
        r = requests.post(
            url, headers={"Content-Type": "application/json"}, json=payload, timeout=120
        )
        if r.status_code != 200:
            return False, "", f"HTTP {r.status_code}: {r.text[:200]}"
        d = r.json()
        for c in d.get("candidates", []):
            for p in c.get("content", {}).get("parts", []):
                if "text" in p:
                    return True, p["text"], ""
        return False, "", f"无文本内容"

    def call_openai(model, api_key: str, prompt_text: str):
        url = f"{model.base_url.rstrip('/')}/chat/completions"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model.model_id,
            "max_tokens": 100,
            "messages": [{"role": "user", "content": prompt_text}],
        }
        r = requests.post(url, headers=headers, json=payload, timeout=120)
        if r.status_code != 200:
            return False, "", f"HTTP {r.status_code}: {r.text[:200]}"
        text = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        return True, text, ""

    def test_one_model(m):
        api_key = os.getenv(m.api_key_env or "API_KEY")
        if not api_key:
            return {
                "model": m.key,
                "name": m.name,
                "success": False,
                "error": f"API Key 未设置: {m.api_key_env}",
            }

        tool = m.supported_tools[0] if m.supported_tools else m.tool
        start = time.time()

        try:
            if tool == ToolType.CLAUDE:
                ok, text, err = call_anthropic(m, api_key, prompt)
            elif tool == ToolType.GEMINI:
                ok, text, err = call_gemini(m, api_key, prompt)
            elif tool == ToolType.CODEX:
                ok, text, err = call_openai(m, api_key, prompt)
            else:
                return {
                    "model": m.key,
                    "name": m.name,
                    "success": False,
                    "error": f"未知工具: {tool}",
                }
        except Exception as e:
            return {"model": m.key, "name": m.name, "success": False, "error": str(e)}

        latency = (time.time() - start) * 1000
        if not ok:
            return {
                "model": m.key,
                "name": m.name,
                "success": False,
                "error": err,
                "latency_ms": latency,
            }

        keywords = MODEL_KEYWORDS.get(m.key, [])
        matched = [kw for kw in keywords if kw.lower() in text.lower()]
        return {
            "model": m.key,
            "name": m.name,
            "success": len(matched) > 0 if keywords else True,
            "latency_ms": latency,
            "response": text[:200],
            "matched_keywords": matched,
        }

    if model_key:
        m = registry.get(model_key)
        if not m:
            print(f"错误: 模型 '{model_key}' 不存在")
            return
        models = [m]
    elif tool_filter:
        try:
            tool = ToolType(tool_filter.lower())
            models = registry.list_for_tool(tool)
        except ValueError:
            print(f"错误: 未知工具 '{tool_filter}'")
            return
    else:
        models = registry.list()

    image_keys = {"nanobanana", "imagen-4-ultra"}
    models = [m for m in models if m.key not in image_keys and m.key != "zhi-mcp-server"]

    if not json_output:
        print("=" * 80)
        print("CLI-Switch 端到端聊天测试")
        print("=" * 80)
        print(f"测试模型数: {len(models)} | 提示词: {prompt[:50]}...")
        print()

    results = [test_one_model(m) for m in models]

    if json_output:
        print(
            json.dumps(
                {
                    "total": len(results),
                    "passed": sum(1 for r in results if r["success"]),
                    "results": results,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return

    for r in results:
        status = "✅" if r["success"] else "❌"
        lat = f"{r.get('latency_ms', 0):.0f}ms" if r.get("latency_ms") else "N/A"
        print(f"{status} {r['model']:20} ({r['name']:20}) {lat:>10}", end="")
        if r["success"]:
            print(f" → {r.get('response', '')[:50]}")
        else:
            print(f" → 错误: {r.get('error', '')[:50]}")

    passed = sum(1 for r in results if r["success"])
    print()
    print("=" * 80)
    print(f"测试结果: 通过 {passed}/{len(results)}")
    print("=" * 80)


def handle_model(args: list, registry: ModelRegistry, json_output: bool = False):
    """处理模型管理命令"""
    import json

    if not args:
        print("模型管理命令:")
        print("  cli-switch model list              列出所有模型（含来源标记）")
        print("  cli-switch model show <key>         显示模型详情")
        print("  cli-switch model add <key> [opts]   添加自定义模型")
        print("  cli-switch model remove <key>       移除自定义模型")
        print()
        print("添加模型选项:")
        print("  --model-id <id>       模型 ID (必填)")
        print("  --tool <tool>         工具类型: claude/gemini/codex (必填)")
        print("  --base-url <url>      API 端点 URL")
        print("  --api-key-env <var>   API 密钥环境变量名")
        print("  --description <desc>  模型描述")
        print("  --supported-tools <t> 支持的工具列表 (逗号分隔, 如 claude,codex)")
        print("  --codex-model-id <id> Codex CLI 专用模型 ID")
        print("  --gemini-model-id <id> Gemini CLI 专用模型 ID")
        return

    action = args[0]

    if action == "list":
        # 列出所有模型（含来源标记）
        if json_output:
            models = []
            for m in registry.list():
                d = m.to_dict()
                models.append(d)
            print(json.dumps(models, indent=2, ensure_ascii=False))
        else:
            print("所有模型:")
            print(f"{'KEY':15} {'NAME':25} {'TOOL':8} {'SOURCE':8} DESCRIPTION")
            print("-" * 80)
            for m in registry.list():
                source_tag = "[自定义]" if m.source == "custom" else "[内置]"
                print(f"{m.key:15} {m.name:25} {m.tool.value:8} {source_tag:8} {m.description}")

    elif action == "show":
        if len(args) < 2:
            print("请指定模型 key")
            sys.exit(1)
        key = args[1]
        model = registry.get(key)
        if not model:
            print(f"模型 '{key}' 不存在")
            sys.exit(1)
        if json_output:
            print(json.dumps(model.to_dict(), indent=2, ensure_ascii=False))
        else:
            print(f"模型详情: {key}")
            print(f"  名称:         {model.name}")
            print(f"  工具:         {model.tool.value}")
            print(f"  模型 ID:      {model.model_id}")
            print(f"  描述:         {model.description}")
            print(f"  API 端点:     {model.base_url or 'N/A'}")
            print(f"  API Key 变量: {model.api_key_env or 'N/A'}")
            print(f"  支持工具:     {', '.join(t.value for t in model.supported_tools)}")
            print(f"  标签:         {', '.join(model.tags) if model.tags else 'N/A'}")
            print(f"  来源:         {'自定义' if model.source == 'custom' else '内置'}")
            if model.codex_model_id:
                print(f"  Codex ID:     {model.codex_model_id}")
            if model.gemini_model_id:
                print(f"  Gemini ID:    {model.gemini_model_id}")

    elif action == "add":
        if len(args) < 2:
            print(
                "用法: cli-switch model add <key> --model-id <id> --tool <tool> [--base-url <url>] ..."
            )
            sys.exit(1)

        key = args[1]
        rest = args[2:]

        # 解析 --key value 参数
        def get_opt(name):
            if name in rest:
                idx = rest.index(name)
                if idx + 1 < len(rest):
                    return rest[idx + 1]
            return None

        model_id = get_opt("--model-id")
        tool = get_opt("--tool")

        if not model_id:
            print("错误: 缺少必填参数 --model-id")
            sys.exit(1)
        if not tool:
            print("错误: 缺少必填参数 --tool (claude/gemini/codex)")
            sys.exit(1)
        if tool not in ("claude", "gemini", "codex"):
            print(f"错误: 不支持的工具类型 '{tool}' (支持: claude, gemini, codex)")
            sys.exit(1)

        data = {
            "name": get_opt("--name") or key,
            "tool": tool,
            "model_id": model_id,
            "description": get_opt("--description") or "",
        }

        base_url = get_opt("--base-url")
        if base_url:
            data["base_url"] = base_url

        api_key_env = get_opt("--api-key-env")
        if api_key_env:
            data["api_key_env"] = api_key_env

        supported_tools_str = get_opt("--supported-tools")
        if supported_tools_str:
            data["supported_tools"] = [t.strip() for t in supported_tools_str.split(",")]
        else:
            data["supported_tools"] = [tool]

        codex_model_id = get_opt("--codex-model-id")
        if codex_model_id:
            data["codex_model_id"] = codex_model_id

        gemini_model_id = get_opt("--gemini-model-id")
        if gemini_model_id:
            data["gemini_model_id"] = gemini_model_id

        success = ModelRegistry.add_custom_model(key, data)
        if success:
            if json_output:
                print(
                    json.dumps(
                        {"success": True, "key": key, "data": data}, indent=2, ensure_ascii=False
                    )
                )
            else:
                print(f"已添加自定义模型: {key}")
                print(f"  模型 ID: {model_id}")
                print(f"  工具:    {tool}")
                if base_url:
                    print(f"  API 端点: {base_url}")
                print(f"配置已保存到: {ModelRegistry.CUSTOM_MODELS_PATH}")
        else:
            print("添加失败")
            sys.exit(1)

    elif action == "remove":
        if len(args) < 2:
            print("用法: cli-switch model remove <key>")
            sys.exit(1)

        key = args[1]

        # 检查是否为内置模型
        if registry.exists(key) and not registry.is_custom(key):
            # 检查用户自定义配置中是否有覆盖
            custom_config = ModelRegistry.load_custom_models()
            if key not in custom_config.get("models", {}):
                print(f"错误: '{key}' 是内置模型，无法删除")
                print("提示: 只能删除通过 'cli-switch model add' 添加的自定义模型")
                sys.exit(1)

        success = ModelRegistry.remove_custom_model(key)
        if success:
            if json_output:
                print(json.dumps({"success": True, "key": key}, indent=2, ensure_ascii=False))
            else:
                print(f"已移除自定义模型: {key}")
        else:
            print(f"移除失败: 模型 '{key}' 不在自定义配置中")
            sys.exit(1)

    else:
        print(f"未知的模型命令: {action}")
        sys.exit(1)


def handle_config(action: str, config: Config):
    import subprocess

    if action == "show":
        print(f"配置文件：{config.config_path}")
        print(f"当前工具：{config.active_tool}")
        print(f"当前模型：{config.active_model}")
    elif action == "edit":
        editor = os.getenv("EDITOR", "vim")
        subprocess.run([editor, str(config.config_path)])


def handle_hook(args: list, json_output: bool = False, custom_hook: Optional[str] = None):
    """处理 Hook 命令"""
    import json

    # 如果指定了 --hook 参数，直接执行
    if custom_hook:
        context = {"model": "current", "tool": "current", "model_id": "current"}
        result = hooks_module.execute_hook(custom_hook, context, check_reentrancy=False)
        if json_output:
            print(json.dumps({"success": result, "hook": custom_hook}))
        else:
            print(f"Hook 执行：{'成功' if result else '失败'}")
        return

    if not args:
        print("Hook 命令用法:")
        print("  cli-switch hook install                 安装 shell precmd hook")
        print("  cli-switch hook uninstall               卸载 shell precmd hook")
        print("  cli-switch hook config show             显示 hooks 配置")
        print("  cli-switch hook config add <type> <cmd> 添加 hook")
        print("  cli-switch hook config remove <type> <cmd> 移除 hook")
        print("  cli-switch hook config clear <type>     清空指定类型的 hooks")
        return

    action = args[0]

    if action == "install":
        # 安装 shell hook
        hook_script = Path(__file__).parent / "shell_hook.sh"
        if hook_script.exists():
            # 将 hook 函数写入用户的 shell 配置
            zshrc = Path.home() / ".zshrc"
            bash_profile = Path.home() / ".bash_profile"
            bashrc = Path.home() / ".bashrc"

            # 检查是否已安装
            hook_marker = "# cli-switch hook"
            installed = False

            for rc_file in [zshrc, bash_profile, bashrc]:
                if rc_file.exists():
                    with open(rc_file, "r", encoding="utf-8") as f:
                        content = f.read()
                    if hook_marker in content:
                        installed = True
                        break

            if installed:
                print("cli-switch hook 已安装")
            else:
                # 读取 shell_hook.sh 内容
                with open(hook_script, "r", encoding="utf-8") as f:
                    hook_content = f.read()

                # 添加到 ~/.zshrc（优先）或 ~/.bash_profile
                target_file = (
                    zshrc if zshrc.exists() else (bash_profile if bash_profile.exists() else bashrc)
                )
                if not target_file.exists():
                    target_file = zshrc  # 默认创建在 .zshrc

                with open(target_file, "a", encoding="utf-8") as f:
                    f.write("\n" + hook_marker + "\n")
                    f.write(hook_content)
                    f.write("\n")

                print(f"cli-switch hook 已安装到 {target_file}")
                print("请执行 'source ~/.zshrc' 或重新打开终端以生效")
        else:
            print(f"错误：找不到 shell_hook.sh: {hook_script}")
            sys.exit(1)

    elif action == "uninstall":
        # 卸载 shell hook
        hook_marker = "# cli-switch hook"
        rc_files = [Path.home() / ".zshrc", Path.home() / ".bash_profile", Path.home() / ".bashrc"]

        for rc_file in rc_files:
            if rc_file.exists():
                with open(rc_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                # 找到 hook 开始和结束位置
                start_idx = None
                end_idx = None
                in_hook = False

                for i, line in enumerate(lines):
                    if hook_marker in line:
                        if not in_hook:
                            start_idx = i
                            in_hook = True
                        else:
                            end_idx = i + 1
                            break

                if start_idx is not None:
                    if end_idx is None:
                        # 只找到开始标记，删除从标记到文件末尾
                        lines = lines[:start_idx]
                    else:
                        # 删除标记之间的内容
                        lines = lines[:start_idx] + lines[end_idx:]

                    with open(rc_file, "w", encoding="utf-8") as f:
                        f.writelines(lines)

                    print(f"cli-switch hook 已从 {rc_file} 卸载")

    elif action == "config":
        if len(args) < 2:
            print("请指定操作：show, add, remove, clear")
            return

        config_action = args[1]

        if config_action == "show":
            hooks_config = hooks_module.load_hooks_config()
            if json_output:
                print(json.dumps(hooks_config, indent=2, ensure_ascii=False))
            else:
                print("Hooks 配置:")
                hooks = hooks_config.get("hooks", {})
                if hooks:
                    for hook_type, commands in hooks.items():
                        print(f"\n{hook_type}:")
                        for cmd in commands:
                            print(f"  - {cmd}")
                else:
                    print("  (空)")

        elif config_action == "add":
            if len(args) < 4:
                print("用法：cli-switch hook config add <type> <command>")
                print("类型：post_switch, pre_tool_use, post_tool_use")
                return

            hook_type = args[2]
            command = " ".join(args[3:])
            success = hooks_module.add_hook(hook_type, command)
            if success:
                print(f"已添加 {hook_type} hook: {command}")
            else:
                print("添加失败")
                sys.exit(1)

        elif config_action == "remove":
            if len(args) < 4:
                print("用法：cli-switch hook config remove <type> <command>")
                return

            hook_type = args[2]
            command = " ".join(args[3:])
            success = hooks_module.remove_hook(hook_type, command)
            if success:
                print(f"已移除 {hook_type} hook: {command}")
            else:
                print("移除失败：hook 不存在")
                sys.exit(1)

        elif config_action == "clear":
            if len(args) < 3:
                print("用法：cli-switch hook config clear <type>")
                return

            hook_type = args[2]
            success = hooks_module.clear_hooks(hook_type)
            if success:
                print(f"已清空 {hook_type} hooks")
            else:
                print("清空失败")
                sys.exit(1)

        else:
            print(f"未知的 config 操作：{config_action}")
            sys.exit(1)

    elif action == "pre-tool-use":
        # Claude Code PreToolUse hook 调用入口
        # 防重入检查
        if hooks_module.is_hook_active():
            return  # 静默退出，防止无限递归

        # 解析 --tool 参数
        tool_name = "claude"
        if "--tool" in args:
            idx = args.index("--tool")
            if idx + 1 < len(args):
                tool_name = args[idx + 1]

        # 执行 pre_tool_use hooks
        hooks_module.execute_pre_tool_use(tool_name)

    elif action == "post-tool-use":
        # Claude Code PostToolUse hook 调用入口
        # 防重入检查
        if hooks_module.is_hook_active():
            return  # 静默退出，防止无限递归

        # 解析 --tool 参数
        tool_name = "claude"
        if "--tool" in args:
            idx = args.index("--tool")
            if idx + 1 < len(args):
                tool_name = args[idx + 1]

        # 执行 post_tool_use hooks
        hooks_module.execute_post_tool_use(tool_name)

    else:
        print(f"未知的 Hook 命令：{action}")
        sys.exit(1)


def handle_mcp(args: list, json_output: bool = False):
    """处理 MCP 命令"""
    import json

    manager = MCPManager()

    if not args:
        print("MCP 命令用法:")
        print("  cli-switch mcp list                 列出已配置的 MCP Server")
        print("  cli-switch mcp show <name>          显示 MCP Server 详情")
        print("  cli-switch mcp add <name>           添加 MCP Server")
        print("  cli-switch mcp remove <name>        移除 MCP Server")
        print("  cli-switch mcp install-zai [key]    安装智谱视觉 MCP")
        print("  cli-switch mcp enable-web-search    启用 web-search 权限")
        print("  cli-switch mcp enable-web-reader    启用 web-reader 权限")
        return

    action = args[0]

    if action == "list":
        servers = manager.list_servers()
        if json_output:
            print(json.dumps([s.to_dict() for s in servers], indent=2, ensure_ascii=False))
        else:
            if servers:
                print("已配置的 MCP Server:")
                for s in servers:
                    print(f"  - {s.name}: {s.command} {' '.join(s.args)}")
            else:
                print("未配置任何 MCP Server")

    elif action == "show":
        if len(args) < 2:
            print("请指定 MCP Server 名称")
            return
        name = args[1]
        info = manager.show_server_info(name)
        print(info)

    elif action == "add":
        if len(args) < 2:
            print("请指定 MCP Server 名称")
            return
        name = args[1]
        # 从预设配置中获取
        if name == "zai-mcp-server":
            success, message = manager.install_zai_mcp(args[2] if len(args) > 2 else None)
        else:
            print(f"未知的 MCP Server: {name}")
            print("支持的预设配置：zai-mcp-server")
            return
        print(message)
        if not success:
            sys.exit(1)

    elif action == "remove":
        if len(args) < 2:
            print("请指定 MCP Server 名称")
            return
        name = args[1]
        success, message = manager.remove_server(name)
        print(message)
        if not success:
            sys.exit(1)

    elif action == "install-zai":
        api_key = args[1] if len(args) > 1 else None
        success, message = manager.install_zai_mcp(api_key)
        print(message)
        if not success:
            sys.exit(1)

    elif action == "enable-web-search":
        success, message = manager.enable_web_search()
        print(message)
        if not success:
            sys.exit(1)

    elif action == "enable-web-reader":
        success, message = manager.enable_web_reader()
        print(message)
        if not success:
            sys.exit(1)

    else:
        print(f"未知的 MCP 命令：{action}")
        print("使用 'cli-switch mcp' 查看可用命令")


if __name__ == "__main__":
    main()


def handle_health_check(model_key: Optional[str], registry: ModelRegistry, json_output: bool):
    """健康检查命令处理"""
    import json
    from .health import HealthChecker
    from .errors import diagnose_error, format_error_report, ErrorType

    health_checker = HealthChecker()

    if model_key:
        model = registry.get(model_key)
        if not model:
            if json_output:
                print(
                    json.dumps(
                        {"error": f"模型 '{model_key}' 不存在", "success": False},
                        indent=2,
                        ensure_ascii=False,
                    )
                )
            else:
                print(f"❌ 错误：模型 '{model_key}' 不存在")
            return

        # 使用健康检查器检查模型
        health_result = health_checker.check_model_health(model)
        health_checker.save_health_status(model_key, health_result)

        if json_output:
            result = {
                "model": model_key,
                "name": model.name,
                "status": health_result.status.value,
                "message": health_result.message,
                "latency_ms": health_result.latency_ms,
            }
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            status_emoji = {
                "healthy": "✅",
                "degraded": "⚠️",
                "maybe_expired": "⚠️",
                "error": "❌",
                "unknown": "❓",
            }.get(health_result.status.value, "❓")
            latency_str = f"{health_result.latency_ms:.2f}ms" if health_result.latency_ms else "N/A"
            print(
                f"{status_emoji} {model.key} - {model.name}: {health_result.message} ({latency_str})"
            )
            if health_result.error_type:
                # 提供错误诊断和解决方案
                from .errors import diagnose_error, format_error_report, ErrorType

                diag = diagnose_error("", status_code=None)
                diag.error_type = ErrorType(health_result.error_type)
                diag.message = health_result.message
                formatted_report = format_error_report(diag)
                print(f"    建议: {formatted_report}")
    else:
        # 检查所有模型

        all_models = [m for m in registry.list() if m.base_url]
        results = []

        print(f"正在检查 {len(all_models)} 个模型的健康状态...")
        for model in all_models:
            print(f"  检查 {model.key}... ", end="", flush=True)

            health_result = health_checker.check_model_health(model)
            health_checker.save_health_status(model.key, health_result)

            result_entry = {
                "model": model.key,
                "status": health_result.status.value,
                "message": health_result.message,
                "latency": health_result.latency_ms,
            }
            results.append(result_entry)

            status_emoji = {
                "healthy": "✅",
                "degraded": "⚠️",
                "maybe_expired": "⚠️",
                "error": "❌",
                "unknown": "❓",
            }.get(health_result.status.value, "❓")

            latency_str = f"{health_result.latency_ms:.2f}ms" if health_result.latency_ms else "N/A"
            print(f"{status_emoji} {health_result.message} ({latency_str})")

        if json_output:
            import json  # 添加json导入

            print(
                json.dumps(
                    {"total_models": len(all_models), "results": results},
                    indent=2,
                    ensure_ascii=False,
                )
            )


def handle_health_report(registry: ModelRegistry, json_output: bool):
    """健康报告命令处理"""
    import json
    from .health import HealthChecker

    health_checker = HealthChecker()

    # 直接从保存的状态文件构建报告
    health_data = health_checker.load_health_status()
    models_health = health_data.get("models", {})

    # 重构报告以符合要求格式
    report = {
        "summary": {
            "total": 0,
            "healthy": 0,
            "degraded": 0,
            "maybe_expired": 0,
            "error": 0,
            "unknown": 0,
        },
        "model_details": [],
    }

    all_models = registry.list()
    report["summary"]["total"] = len(all_models)

    for model in all_models:
        health_info = models_health.get(model.key, {})

        if health_info:
            status_str = health_info.get("status", "unknown")
            if status_str == "healthy":
                report["summary"]["healthy"] += 1
            elif status_str == "degraded":
                report["summary"]["degraded"] += 1
            elif status_str == "maybe_expired":
                report["summary"]["maybe_expired"] += 1
            elif status_str == "error":
                report["summary"]["error"] += 1
            else:
                report["summary"]["unknown"] += 1

            detail = {
                "model": model.key,
                "name": model.name,
                "status": status_str,
                "message": health_info.get("message", "Unknown"),
                "latency_ms": health_info.get("latency_ms"),
                "last_checked": health_info.get("last_checked"),
                "error_type": health_info.get("error_type"),
            }
        else:
            # 没有记录视为未知状态
            report["summary"]["unknown"] += 1
            detail = {
                "model": model.key,
                "name": model.name,
                "status": "unknown",
                "message": "未检查",
                "latency_ms": None,
                "last_checked": None,
                "error_type": None,
            }

        report["model_details"].append(detail)

    if json_output:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print("模型健康报告:")
        print("=" * 70)
        summary = report["summary"]
        print(f"总计: {summary['total']} 个模型")
        print(f"  ✅ 健康: {summary['healthy']}")
        print(f"  ⚠️  性能下降: {summary['degraded']}")
        print(f"  ⚠️  [可能过期]: {summary['maybe_expired']}")
        print(f"  ❌ 错误: {summary['error']}")
        print(f"  ❓ 未知: {summary['unknown']}")
        print()

        if report["model_details"]:
            print("详细信息:")
            for detail in report["model_details"]:
                status_emoji = {
                    "healthy": "✅",
                    "degraded": "⚠️",
                    "maybe_expired": "⚠️ [可能过期]",
                    "error": "❌",
                    "unknown": "❓",
                }.get(detail["status"], "❓")
                latency_str = f"{detail['latency_ms']:.2f}ms" if detail["latency_ms"] else "N/A"
                last_check_str = (
                    detail["last_checked"][:16] if detail["last_checked"] else "从未检查"
                )

                if detail["status"] == "maybe_expired":
                    print(
                        f"{status_emoji} {detail['model']:15} {detail['name']:25} - {detail['message']}"
                    )
                    print(f"      最后检查: {last_check_str}")
                else:
                    print(
                        f"{status_emoji} {detail['model']:15} {detail['name']:25} - {detail['message']} (延迟: {latency_str})"
                    )

        print("\n🔧 建议:")
        print("  • 运行 'cli-switch health-check' 更新所有模型健康状态")
        print("  • 对于状态为 [可能过期] 的模型，检查对应的 API 或服务商状态")
        print("  • 使用 'cli-switch list' 查看所有模型的当前状态标记")


# Helper function to add command-line arg parsing for verbose in handle_test
def parse_additional_args(cmd_args):
    """解析额外参数，如--verbose, --timeout等"""
    # 检查是否包含额外的标志参数
    verbose = "--verbose" in cmd_args or "-v" in cmd_args
    timeout = 30  # 默认值

    # 查找是否指定超时参数
    for i, arg in enumerate(cmd_args):
        if arg == "--timeout" or arg == "-t":
            if i + 1 < len(cmd_args):
                try:
                    timeout = int(cmd_args[i + 1])
                except ValueError:
                    timeout = 30
            break

    return verbose, timeout
