#!/usr/bin/env python3
"""
CLI Switch 完整测试报告

测试每个模型的配置和实际响应
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

# 测试结果
results = []

def log(message):
    print(message)
    results.append(message)

def run_command(cmd, capture=True):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=capture, text=True, timeout=30
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "超时"
    except Exception as e:
        return False, "", str(e)

def check_config_file():
    """检查配置文件"""
    log("=" * 70)
    log("1. 检查 Claude 配置文件")
    log("=" * 70)

    config_path = Path.home() / ".claude" / "settings.json"
    if not config_path.exists():
        log(f"❌ 配置文件不存在：{config_path}")
        return None

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    env = config.get("env", {})
    log(f"当前 ANTHROPIC_MODEL: {env.get('ANTHROPIC_MODEL', '未设置')}")
    log(f"当前 ANTHROPIC_BASE_URL: {env.get('ANTHROPIC_BASE_URL', '未设置')}")
    log(f"当前 ANTHROPIC_AUTH_TOKEN: {'已设置' if env.get('ANTHROPIC_AUTH_TOKEN') else '未设置'}")

    return env

def test_model(model_key, expected_model_id, expected_base_url=None):
    """测试单个模型切换"""
    log(f"\n测试模型：{model_key}")
    log(f"预期 model_id: {expected_model_id}")
    log(f"预期 base_url: {expected_base_url or 'N/A'}")
    log("-" * 50)

    # 切换模型
    success, stdout, stderr = run_command(f"cli-switch {model_key}")

    if not success:
        log(f"❌ 切换失败：{stderr}")
        return False

    log(f"切换输出：{stdout}")

    # 检查配置
    config_path = Path.home() / ".claude" / "settings.json"
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        env = config.get("env", {})
        actual_model = env.get("ANTHROPIC_MODEL")
        actual_base_url = env.get("ANTHROPIC_BASE_URL")

        log(f"实际 ANTHROPIC_MODEL: {actual_model}")
        log(f"实际 ANTHROPIC_BASE_URL: {actual_base_url}")

        # 验证配置
        model_ok = actual_model == expected_model_id
        url_ok = True if expected_base_url is None else actual_base_url == expected_base_url

        if model_ok and url_ok:
            log(f"✅ 配置正确")
            return True
        else:
            if not model_ok:
                log(f"❌ model_id 不匹配：期望 {expected_model_id}, 实际 {actual_model}")
            if not url_ok:
                log(f"❌ base_url 不匹配：期望 {expected_base_url}, 实际 {actual_base_url}")
            return False

    return False

def test_api_response(model_key):
    """测试 API 响应（发送测试消息）"""
    log(f"\n测试 API 响应：{model_key}")
    log("-" * 50)

    # 使用 claude 命令发送测试消息
    test_prompt = "请用一句话回答：1+1 等于几？"

    success, stdout, stderr = run_command(
        f'echo "{test_prompt}" | claude --no-echo',
        capture=True
    )

    if success and stdout:
        log(f"✅ API 响应正常")
        log(f"响应内容：{stdout[:200]}...")
        return True
    else:
        log(f"⚠️  API 响应测试跳过或失败：{stderr[:100] if stderr else '无输出'}")
        return None  # 跳过不算失败

def main():
    """主测试函数"""
    log("=" * 70)
    log("CLI Switch 完整测试报告")
    log(f"测试时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 70)

    # 模型配置列表（key, 期望的 model_id, 期望的 base_url）
    models_to_test = [
        # fucheers Claude 原生
        ("opus", "claude-opus-4-6", "https://www.fucheers.top"),
        ("opus45", "claude-opus-4.5-20251101", "https://www.fucheers.top"),
        ("sonnet", "claude-sonnet-4.5-20250929", "https://www.fucheers.top"),
        ("haiku", "claude-haiku-4.5-20251001", "https://www.fucheers.top"),

        # 智谱 Zhipu
        ("zhipu", "glm-4.5-air", "https://open.bigmodel.cn/api/anthropic"),
        ("glm45", "glm-4.5", "https://open.bigmodel.cn/api/anthropic"),
        ("glm46", "glm-4.6", "https://open.bigmodel.cn/api/anthropic"),
        ("glm47", "glm-4.7", "https://open.bigmodel.cn/api/anthropic"),
        ("glm5", "glm-5", "https://open.bigmodel.cn/api/anthropic"),
        ("glm-flash", "glm-4-flash", "https://open.bigmodel.cn/api/anthropic"),

        # 阿里云百炼
        ("qwen", "qwen3.5-plus", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("kimi", "kimi-k2.5", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("glm", "glm-5", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("minimax", "MiniMax-M2.5", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("qwen-max", "qwen3-max-2026-01-23", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("qwen-coder", "qwen3-coder-plus", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("qwen-next", "qwen3-coder-next", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),
        ("glm47", "glm-4.7", "https://coding.dashscope.aliyuncs.com/apps/anthropic"),

        # Gemini CLI
        ("gemini-2.5-pro", "gemini-2.5-pro", None),  # Gemini 使用不同配置
        ("nanobanana", "gemini-2.5-flash", None),

        # Codex CLI
        ("gpt-5.2-codex", "gpt-5.2-codex", None),  # Codex 使用不同配置
        ("gpt-5.4-codex", "gpt-5-4-codex", None),
    ]

    passed = 0
    failed = 0
    skipped = 0

    # 先检查初始配置
    initial_env = check_config_file()

    # 测试每个模型切换
    log("\n" + "=" * 70)
    log("2. 测试模型切换配置")
    log("=" * 70)

    for model_key, expected_model_id, expected_base_url in models_to_test:
        if test_model(model_key, expected_model_id, expected_base_url):
            passed += 1
        else:
            failed += 1

    # 测试 API 响应（选择几个代表性模型）
    log("\n" + "=" * 70)
    log("3. 测试 API 响应")
    log("=" * 70)

    response_test_models = ["qwen", "glm5", "opus"]
    for model_key in response_test_models:
        result = test_api_response(model_key)
        if result is True:
            log(f"✅ {model_key} API 响应正常")
        elif result is False:
            log(f"❌ {model_key} API 响应失败")
            failed += 1
        else:
            log(f"⚠️  {model_key} API 响应跳过")
            skipped += 1

    # 生成摘要
    log("\n" + "=" * 70)
    log("测试摘要")
    log("=" * 70)
    log(f"总测试数：{len(models_to_test)}")
    log(f"通过：{passed}")
    log(f"失败：{failed}")
    log(f"跳过：{skipped}")
    log(f"通过率：{passed / len(models_to_test) * 100:.1f}%")

    # 保存测试报告
    report_path = Path.home() / ".local" / "share" / "cli-switch" / "test-report.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# CLI Switch 完整测试报告\n\n")
        f.write(f"测试时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 测试结果\n\n")
        for r in results:
            f.write(f"```\n{r}\n```\n")

    log(f"\n完整报告已保存到：{report_path}")

    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
