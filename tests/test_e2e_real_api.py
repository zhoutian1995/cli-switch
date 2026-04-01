#!/usr/bin/env python3
"""
端到端真实 API 测试 - 验证每个模型都能正常回复

测试方法:
1. 对每个模型发送真实聊天请求: "你是什么模型？请简短回答"
2. 验证响应包含预期关键词
3. 记录响应时间和状态

运行方式:
  python tests/test_e2e_real_api.py
  python tests/test_e2e_real_api.py --tool claude
  python tests/test_e2e_real_api.py --model qwen
  python tests/test_e2e_real_api.py --json
"""

import os
import sys
import json
import time
import argparse
import requests
from pathlib import Path
from typing import List, Optional, Tuple
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cli_switch.models import ModelRegistry, ToolType


@dataclass
class TestResult:
    model_key: str
    model_name: str
    tool: str
    success: bool
    latency_ms: float
    response_text: str = ""
    error: str = ""
    expected_keywords: List[str] = field(default_factory=list)
    matched_keywords: List[str] = field(default_factory=list)


MODEL_IDENTITY_KEYWORDS = {
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
    "opus4.6": ["claude", "opus"],
    "opus4.6-thinking": ["claude", "opus"],
    "opus4.5-20251101": ["claude", "opus"],
    "opus4.5-20251101-thinking": ["claude", "opus"],
    "sonnet4.6": ["claude", "sonnet"],
    "sonnet4.6-thinking": ["claude", "sonnet"],
    "haiku4.5-20251001": ["claude", "haiku"],
    "gemini-3.1-pro": ["gemini", "google"],
    "gemini-2.5-flash": ["gemini", "google"],
    "gemini-2.5-pro": ["gemini", "google"],
    "nanobanana": ["gemini", "banana"],
    "imagen-4-ultra": ["imagen"],
    "gpt-5.2-codex": ["gpt", "openai"],
}


def get_api_key(model) -> Optional[str]:
    env_var = model.api_key_env or "API_KEY"
    return os.getenv(env_var)


def call_anthropic_api(model, api_key: str, prompt: str) -> Tuple[bool, str, str]:
    """调用 Anthropic 兼容 API (百炼、智谱、Fucheers)"""
    base_url = model.base_url.rstrip("/")

    if "fucheers" in base_url.lower():
        url = f"{base_url}/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
    else:
        url = f"{base_url}/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }

    payload = {
        "model": model.model_id,
        "max_tokens": 100,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        start = time.time()
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        _ = (time.time() - start) * 1000  # latency (not used)

        if response.status_code != 200:
            return False, "", f"HTTP {response.status_code}: {response.text[:200]}"

        data = response.json()

        if "choices" in data:
            text = data["choices"][0]["message"]["content"]
        elif "content" in data:
            if isinstance(data["content"], list):
                text = data["content"][0].get("text", "")
            else:
                text = data["content"]
        else:
            return False, "", f"未知响应格式: {str(data)[:200]}"

        return True, text, ""

    except requests.exceptions.Timeout:
        return False, "", "请求超时 (60s)"
    except Exception as e:
        return False, "", str(e)


def call_gemini_api(model, api_key: str, prompt: str) -> Tuple[bool, str, str]:
    """调用 Gemini API"""
    model_id = model.model_id
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"

    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 200},
    }

    try:
        start = time.time()
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        _ = (time.time() - start) * 1000  # latency (not used)

        if response.status_code != 200:
            return False, "", f"HTTP {response.status_code}: {response.text[:200]}"

        data = response.json()

        if "candidates" in data and len(data["candidates"]) > 0:
            candidate = data["candidates"][0]
            finish_reason = candidate.get("finishReason", "")

            if finish_reason == "MAX_TOKENS":
                if "content" in candidate and "parts" in candidate["content"]:
                    for part in candidate["content"]["parts"]:
                        if "text" in part and part["text"]:
                            return True, part["text"], ""
                return False, "", "MAX_TOKENS 但无有效文本内容"

            if "content" in candidate and "parts" in candidate["content"]:
                for part in candidate["content"]["parts"]:
                    if "text" in part and part["text"]:
                        return True, part["text"], ""

            return False, "", f"无文本内容: {str(candidate)[:200]}"

        return False, "", f"未知响应格式: {str(data)[:200]}"

    except requests.exceptions.Timeout:
        return False, "", "请求超时 (60s)"
    except Exception as e:
        return False, "", str(e)


def call_openai_api(model, api_key: str, prompt: str) -> Tuple[bool, str, str]:
    """调用 OpenAI 兼容 API (Codex)"""
    base_url = model.base_url.rstrip("/")
    url = f"{base_url}/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "model": model.model_id,
        "max_tokens": 100,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        start = time.time()
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        _ = (time.time() - start) * 1000  # latency (not used)

        if response.status_code != 200:
            return False, "", f"HTTP {response.status_code}: {response.text[:200]}"

        data = response.json()

        if "choices" in data and len(data["choices"]) > 0:
            text = data["choices"][0]["message"]["content"]
            return True, text, ""

        return False, "", f"未知响应格式: {str(data)[:200]}"

    except requests.exceptions.Timeout:
        return False, "", "请求超时 (60s)"
    except Exception as e:
        return False, "", str(e)


def run_model_test(model, tool: ToolType) -> TestResult:
    """测试单个模型"""
    prompt = "你是什么模型？请用一句话简短回答。"

    api_key = get_api_key(model)
    if not api_key:
        return TestResult(
            model_key=model.key,
            model_name=model.name,
            tool=tool.value,
            success=False,
            latency_ms=0,
            error=f"API Key 未设置: {model.api_key_env}",
        )

    start = time.time()

    if tool == ToolType.CLAUDE:
        success, text, error = call_anthropic_api(model, api_key, prompt)
    elif tool == ToolType.GEMINI:
        success, text, error = call_gemini_api(model, api_key, prompt)
    elif tool == ToolType.CODEX:
        success, text, error = call_openai_api(model, api_key, prompt)
    else:
        success, text, error = False, "", f"未知工具类型: {tool}"

    latency = (time.time() - start) * 1000

    if not success:
        return TestResult(
            model_key=model.key,
            model_name=model.name,
            tool=tool.value,
            success=False,
            latency_ms=latency,
            error=error,
        )

    expected_keywords = MODEL_IDENTITY_KEYWORDS.get(model.key, [])
    text_lower = text.lower()
    matched = [kw for kw in expected_keywords if kw.lower() in text_lower]

    identity_verified = len(matched) > 0 if expected_keywords else True

    return TestResult(
        model_key=model.key,
        model_name=model.name,
        tool=tool.value,
        success=identity_verified,
        latency_ms=latency,
        response_text=text[:200],
        expected_keywords=expected_keywords,
        matched_keywords=matched,
    )


def run_tests(
    registry: ModelRegistry,
    tool_filter: Optional[str] = None,
    model_filter: Optional[str] = None,
    json_output: bool = False,
) -> List[TestResult]:
    """运行测试"""
    results = []

    if tool_filter:
        tool = ToolType(tool_filter.lower())
        models = registry.list_for_tool(tool)
    else:
        models = registry.list()

    if model_filter:
        models = [m for m in models if m.key == model_filter]

    image_models = {"nanobanana", "imagen-4-ultra"}
    text_models = [m for m in models if m.key not in image_models]

    if not json_output:
        print("=" * 80)
        print("CLI-Switch 端到端真实 API 测试")
        print("=" * 80)
        print(f"测试模型数: {len(text_models)} (排除图片生成模型)")
        print()

    for model in text_models:
        if not json_output:
            print(f"测试: {model.key:20} ({model.name})", end=" ... ", flush=True)

        supported_tools = model.supported_tools if model.supported_tools else [model.tool]
        primary_tool = supported_tools[0]

        try:
            result = run_model_test(model, primary_tool)
            results.append(result)

            if not json_output:
                if result.success:
                    print(f"✅ 通过 ({result.latency_ms:.0f}ms)")
                    if result.matched_keywords:
                        print(f"      响应: {result.response_text[:100]}")
                        print(f"      匹配: {result.matched_keywords}")
                else:
                    print("❌ 失败")
                    print(f"      错误: {result.error}")

        except Exception as e:
            result = TestResult(
                model_key=model.key,
                model_name=model.name,
                tool=primary_tool.value,
                success=False,
                latency_ms=0,
                error=str(e),
            )
            results.append(result)

            if not json_output:
                print(f"❌ 异常: {e}")

    return results


def print_summary(results: List[TestResult]):
    """打印测试摘要"""
    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed

    total_latency = sum(r.latency_ms for r in results)
    avg_latency = total_latency / len(results) if results else 0

    print()
    print("=" * 80)
    print("测试摘要")
    print("=" * 80)
    print(f"总计: {len(results)} | 通过: {passed} | 失败: {failed}")
    print(f"平均延迟: {avg_latency:.0f}ms")

    if failed > 0:
        print()
        print("失败的模型:")
        for r in results:
            if not r.success:
                print(f"  - {r.model_key}: {r.error}")

    print("=" * 80)

    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="端到端真实 API 测试")
    parser.add_argument(
        "--tool", "-t", choices=["claude", "gemini", "codex"], help="只测试指定工具"
    )
    parser.add_argument("--model", "-m", type=str, help="只测试指定模型")
    parser.add_argument("--json", "-j", action="store_true", help="JSON 输出")
    args = parser.parse_args()

    registry = ModelRegistry()
    results = run_tests(
        registry,
        tool_filter=args.tool,
        model_filter=args.model,
        json_output=args.json,
    )

    if args.json:
        output = {
            "total": len(results),
            "passed": sum(1 for r in results if r.success),
            "failed": sum(1 for r in results if not r.success),
            "results": [
                {
                    "model": r.model_key,
                    "name": r.model_name,
                    "tool": r.tool,
                    "success": r.success,
                    "latency_ms": round(r.latency_ms, 2),
                    "response": r.response_text,
                    "error": r.error,
                    "matched_keywords": r.matched_keywords,
                }
                for r in results
            ],
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        success = print_summary(results)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
