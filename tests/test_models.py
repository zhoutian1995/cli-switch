#!/usr/bin/env python3
"""
CLI Switch 完整测试报告 - 测试每个模型的配置正确性
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

# 测试结果
test_results = []

def log(message, save=True):
    print(message)
    if save:
        test_results.append(message)

def run_command(cmd, timeout=10):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "超时"
    except Exception as e:
        return False, "", str(e)

def get_current_config():
    """获取当前配置"""
    config_path = Path.home() / ".claude" / "settings.json"
    if not config_path.exists():
        return None

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    env = config.get("env", {})
    return {
        "model": env.get("ANTHROPIC_MODEL"),
        "base_url": env.get("ANTHROPIC_BASE_URL"),
        "auth_token": env.get("ANTHROPIC_AUTH_TOKEN", "")[:10] + "..." if env.get("ANTHROPIC_AUTH_TOKEN") else None
    }

def test_claude_model(model_key, expected_model_id, expected_base_url):
    """测试 Claude 模型切换"""
    log(f"\n测试：{model_key}")
    log(f"  期望 model: {expected_model_id}")
    log(f"  期望 base_url: {expected_base_url}")

    # 切换模型
    success, stdout, stderr = run_command(f"cli-switch {model_key}")

    if not success:
        log(f"  ❌ 切换失败：{stderr}", save=False)
        return False, stderr

    # 获取配置
    config = get_current_config()
    if not config:
        log(f"  ❌ 无法读取配置文件")
        return False, "配置文件不存在"

    # 验证
    model_ok = config["model"] == expected_model_id
    url_ok = config["base_url"] == expected_base_url

    log(f"  实际 model: {config['model']} {'✅' if model_ok else '❌'}")
    log(f"  实际 base_url: {config['base_url']} {'✅' if url_ok else '❌'}")

    if model_ok and url_ok:
        log(f"  ✅ 通过")
        return True, "通过"
    else:
        errors = []
        if not model_ok:
            errors.append(f"model 不匹配")
        if not url_ok:
            errors.append(f"base_url 不匹配")
        return False, "; ".join(errors)

def test_api_key(model_key, expected_provider):
    """测试 API Key 配置"""
    config = get_current_config()
    if config and config.get("auth_token"):
        log(f"  API Key: 已配置 ({config['auth_token']})")
        return True
    else:
        log(f"  API Key: 未配置或从环境变量读取")
        return None  # 可能从环境变量读取，不算失败

def main():
    """主测试函数"""
    log("=" * 70)
    log("CLI Switch 完整测试报告")
    log(f"测试时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 70)

    # 检查初始状态
    log("\n【初始状态检查】")
    initial_config = get_current_config()
    if initial_config:
        log(f"当前 model: {initial_config['model']}")
        log(f"当前 base_url: {initial_config['base_url']}")
    else:
        log("❌ Claude 配置文件不存在")

    # 测试用例：(model_key, expected_model_id, expected_base_url, provider)
    test_cases = [
        # fucheers Claude 原生
        ("opus", "claude-opus-4-6", "https://www.fucheers.top", "fucheers"),
        ("opus45", "claude-opus-4.5-20251101", "https://www.fucheers.top", "fucheers"),
        ("sonnet", "claude-sonnet-4.5-20250929", "https://www.fucheers.top", "fucheers"),
        ("haiku", "claude-haiku-4.5-20251001", "https://www.fucheers.top", "fucheers"),

        # 智谱 Zhipu
        ("glm45", "glm-4.5", "https://open.bigmodel.cn/api/anthropic", "zhipu"),
        ("glm46", "glm-4.6", "https://open.bigmodel.cn/api/anthropic", "zhipu"),
        ("glm47", "glm-4.7", "https://open.bigmodel.cn/api/anthropic", "zhipu"),
        ("glm5", "glm-5", "https://open.bigmodel.cn/api/anthropic", "zhipu"),
        ("glm-flash", "glm-4-flash", "https://open.bigmodel.cn/api/anthropic", "zhipu"),

        # 阿里云百炼
        ("qwen", "qwen3.5-plus", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
        ("kimi", "kimi-k2.5", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
        ("glm", "glm-5", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
        ("minimax", "MiniMax-M2.5", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
        ("qwen-max", "qwen3-max-2026-01-23", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
        ("qwen-coder", "qwen3-coder-plus", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
        ("qwen-next", "qwen3-coder-next", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "bailian"),
    ]

    log("\n" + "=" * 70)
    log("【模型切换测试】")
    log("=" * 70)

    passed = 0
    failed = 0

    for model_key, expected_model, expected_url, provider in test_cases:
        success, error = test_claude_model(model_key, expected_model, expected_url)
        if success:
            passed += 1
        else:
            failed += 1
            log(f"  错误：{error}")

    # 总结
    log("\n" + "=" * 70)
    log("【测试总结】")
    log("=" * 70)
    log(f"总测试数：{len(test_cases)}")
    log(f"通过：{passed}")
    log(f"失败：{failed}")
    log(f"通过率：{passed / len(test_cases) * 100:.1f}%")

    # 保存报告
    report_dir = Path.home() / ".local" / "share" / "cli-switch"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "test-report.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# CLI Switch 完整测试报告\n\n")
        f.write(f"**测试时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        f.write("## 测试结果\n\n")
        f.write("| 模型 | 期望 model_id | 实际 model_id | 期望 base_url | 实际 base_url | 结果 |\n")
        f.write("|------|---------------|---------------|---------------|---------------|------|\n")

        for model_key, expected_model, expected_url, provider in test_cases:
            # 获取实际值
            subprocess.run(f"cli-switch {model_key} > /dev/null 2>&1", shell=True)
            config = get_current_config()
            if config:
                actual_model = config.get("model", "N/A")
                actual_url = config.get("base_url", "N/A")
                model_ok = "✅" if actual_model == expected_model else "❌"
                url_ok = "✅" if actual_url == expected_url else "❌"
                result = "✅" if (actual_model == expected_model and actual_url == expected_url) else "❌"
            else:
                actual_model = "N/A"
                actual_url = "N/A"
                result = "❌"

            f.write(f"| {model_key} | {expected_model} | {actual_model} {model_ok} | {expected_url} | {actual_url} {url_ok} | {result} |\n")

        f.write(f"\n## 统计\n\n")
        f.write(f"- 总测试数：{len(test_cases)}\n")
        f.write(f"- 通过：{passed}\n")
        f.write(f"- 失败：{failed}\n")
        f.write(f"- 通过率：{passed / len(test_cases) * 100:.1f}%\n")

    log(f"\n完整报告已保存到：{report_path}")

    # 恢复初始模型
    log("\n恢复初始模型...")
    run_command("cli-switch qwen")

    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
