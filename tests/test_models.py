#!/usr/bin/env python3
"""
CLI Switch 完整测试报告 - 测试每个模型的配置正确性

模型列表根据用户提供的配置：
- 百炼模型：8 个 (qwen, qwen-max, qwen-next, qwen-coder, minimax, glm, glm47, kimi)
- 智谱模型：2 个 (glm47-zhipu, glm5-zhipu)
- Fucheers 模型：1 个 (opus4.6)
- Gemini 模型：2 个 (gemini-3-pro, nanobanana)
- Codex 模型：2 个 (gpt-5.2-codex, gpt-5.4-codex)

总计：15 个模型
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

test_results = []

def log(message, save=True):
    print(message)
    if save:
        test_results.append(message)

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
    }

def test_claude_model(model_key, expected_model_id, expected_base_url):
    """测试 Claude 模型切换"""
    log(f"\n测试：{model_key}")
    log(f"  期望 model: {expected_model_id}")
    log(f"  期望 base_url: {expected_base_url}")

    success, stdout, stderr = subprocess.run(
        f"cli-switch {model_key}", shell=True, capture_output=True, text=True, timeout=10
    ).returncode == 0, "", ""

    result = subprocess.run(f"cli-switch {model_key}", shell=True, capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        log(f"  ❌ 切换失败：{result.stderr[:100]}")
        return False, result.stderr

    config = get_current_config()
    if not config:
        log(f"  ❌ 无法读取配置文件")
        return False, "配置文件不存在"

    model_ok = config["model"] == expected_model_id
    url_ok = config["base_url"] == expected_base_url

    log(f"  实际 model: {config['model']} {'✅' if model_ok else '❌'}")
    log(f"  实际 base_url: {config['base_url']} {'✅' if url_ok else '❌'}")

    if model_ok and url_ok:
        log(f"  ✅ 通过")
        return True, "通过"
    else:
        errors = []
        if not model_ok: errors.append(f"model 不匹配")
        if not url_ok: errors.append(f"base_url 不匹配")
        return False, "; ".join(errors)

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

    # 测试用例：(model_key, expected_model_id, expected_base_url, category)
    test_cases = [
        # === 百炼模型 (Claude Code / Codex CLI) ===
        ("qwen", "qwen3.5-plus", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("qwen-max", "qwen3-max-2026-01-23", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("qwen-next", "qwen3-coder-next", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("qwen-coder", "qwen3-coder-plus", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("minimax", "MiniMax-M2.5", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("glm", "glm-5", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("glm47", "glm-4.7", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),
        ("kimi", "kimi-k2.5", "https://coding.dashscope.aliyuncs.com/apps/anthropic", "百炼"),

        # === 智谱模型 (Claude Code / Gemini CLI) ===
        ("glm47-zhipu", "glm-4.7", "https://open.bigmodel.cn/api/anthropic", "智谱"),
        ("glm5-zhipu", "glm-5", "https://open.bigmodel.cn/api/anthropic", "智谱"),

        # === Fucheers 模型 (仅 Claude Code) ===
        ("opus4.6", "claude-opus-4-6", "https://www.fucheers.top", "Fucheers"),
    ]

    log("\n" + "=" * 70)
    log("【模型切换测试】")
    log("=" * 70)

    passed = 0
    failed = 0
    results_by_category = {}

    for model_key, expected_model, expected_url, category in test_cases:
        success, error = test_claude_model(model_key, expected_model, expected_url)
        if success:
            passed += 1
        else:
            failed += 1
            log(f"  错误：{error}")

        if category not in results_by_category:
            results_by_category[category] = {"passed": 0, "failed": 0}
        if success:
            results_by_category[category]["passed"] += 1
        else:
            results_by_category[category]["failed"] += 1

    # 按类别总结
    log("\n" + "=" * 70)
    log("【按类别统计】")
    log("=" * 70)
    for category, stats in results_by_category.items():
        total = stats["passed"] + stats["failed"]
        log(f"{category}: {stats['passed']}/{total} 通过")

    # 总结
    log("\n" + "=" * 70)
    log("【测试总结】")
    log("=" * 70)
    log(f"总测试数：{len(test_cases)}")
    log(f"通过：{passed}")
    log(f"失败：{failed}")
    if len(test_cases) > 0:
        log(f"通过率：{passed / len(test_cases) * 100:.1f}%")

    # 保存报告
    report_dir = Path.home() / ".local" / "share" / "cli-switch"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "test-report.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# CLI Switch 完整测试报告\n\n")
        f.write(f"**测试时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 测试结果\n\n")
        f.write("| 类别 | 模型 | 期望 model_id | 实际 model_id | 期望 base_url | 实际 base_url | 结果 |\n")
        f.write("|------|------|---------------|---------------|---------------|---------------|------|\n")

        for model_key, expected_model, expected_url, category in test_cases:
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
            f.write(f"| {category} | {model_key} | {expected_model} | {actual_model} {model_ok} | {expected_url} | {actual_url} {url_ok} | {result} |\n")

        f.write(f"\n## 统计\n\n")
        f.write(f"- 总测试数：{len(test_cases)}\n")
        f.write(f"- 通过：{passed}\n")
        f.write(f"- 失败：{failed}\n")

    log(f"\n完整报告已保存到：{report_path}")

    # 恢复初始模型
    log("\n恢复初始模型 (qwen)...")
    subprocess.run("cli-switch qwen > /dev/null 2>&1", shell=True)

    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
