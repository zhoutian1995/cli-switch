#!/usr/bin/env python3
"""
端到端测试 - 验证所有模型切换功能
"""

import subprocess
import json
import sys
from pathlib import Path


def run_cmd(cmd):
    """运行命令并返回结果"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode == 0, result.stdout.strip(), result.stderr.strip()


def test_switch_to_bailian_glm():
    """测试切换到百炼GLM-5"""
    print("测试: 切换到百炼GLM-5 (glm)")
    success, stdout, stderr = run_cmd("cli-switch glm")
    if not success:
        print(f"  ❌ 失败: {stderr}")
        return False

    # 验证Claude配置
    config_path = Path.home() / ".claude" / "settings.json"
    with open(config_path) as f:
        config = json.load(f)

    model = config.get("env", {}).get("ANTHROPIC_MODEL")
    base_url = config.get("env", {}).get("ANTHROPIC_BASE_URL")

    if model == "glm-5" and "dashscope.aliyuncs.com" in base_url:
        print(f"  ✅ 成功: model={model}, base_url正确")
        return True
    else:
        print(f"  ❌ 配置不正确: model={model}, base_url={base_url}")
        return False


def test_switch_to_zhipu_glm5():
    """测试切换到智谱GLM-5"""
    print("测试: 切换到智谱GLM-5 (glm5-zhipu)")
    success, stdout, stderr = run_cmd("cli-switch glm5-zhipu")
    if not success:
        print(f"  ❌ 失败: {stderr}")
        return False

    # 验证Claude配置
    config_path = Path.home() / ".claude" / "settings.json"
    with open(config_path) as f:
        config = json.load(f)

    model = config.get("env", {}).get("ANTHROPIC_MODEL")
    base_url = config.get("env", {}).get("ANTHROPIC_BASE_URL")

    if model == "glm-5" and "open.bigmodel.cn" in base_url:
        print(f"  ✅ 成功: model={model}, base_url正确")
        return True
    else:
        print(f"  ❌ 配置不正确: model={model}, base_url={base_url}")
        return False


def test_list_models():
    """测试列出模型"""
    print("测试: 列出所有模型")
    success, stdout, stderr = run_cmd("cli-switch --json list")
    if not success:
        print(f"  ❌ 失败: {stderr}")
        return False

    try:
        models = json.loads(stdout)
        claude_count = len(models.get("claude", []))
        gemini_count = len(models.get("gemini", []))
        codex_count = len(models.get("codex", []))

        print(f"  ✅ 成功: Claude={claude_count}, Gemini={gemini_count}, Codex={codex_count}")
        return True
    except Exception as e:
        print(f"  ❌ JSON解析失败: {e}")
        return False


def test_status():
    """测试状态查询"""
    print("测试: 查询当前状态")
    success, stdout, stderr = run_cmd("cli-switch --json status")
    if not success:
        print(f"  ❌ 失败: {stderr}")
        return False

    try:
        status = json.loads(stdout)
        print(f"  ✅ 成功: {status}")
        return True
    except Exception as e:
        print(f"  ❌ JSON解析失败: {e}")
        return False


def test_model_add_remove():
    """测试添加和删除自定义模型"""
    print("测试: 添加自定义模型")

    # 添加
    success, stdout, stderr = run_cmd(
        "cli-switch model add test-ollama --model-id llama3 --tool claude --base-url http://localhost:11434/v1"
    )
    if not success:
        print(f"  ❌ 添加失败: {stderr}")
        return False
    print("  ✅ 添加成功")

    # 验证
    success, stdout, stderr = run_cmd("cli-switch model show test-ollama --json")
    if not success:
        print(f"  ❌ 查询失败: {stderr}")
        return False

    # 删除
    success, stdout, stderr = run_cmd("cli-switch model remove test-ollama")
    if not success:
        print(f"  ❌ 删除失败: {stderr}")
        return False
    print("  ✅ 删除成功")

    return True


def main():
    """运行所有测试"""
    print("=" * 60)
    print("CLI-Switch 端到端测试")
    print("=" * 60)

    tests = [
        ("列出模型", test_list_models),
        ("切换百炼GLM-5", test_switch_to_bailian_glm),
        ("切换智谱GLM-5", test_switch_to_zhipu_glm5),
        ("状态查询", test_status),
        ("自定义模型管理", test_model_add_remove),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        print(f"\n{name}:")
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ❌ 异常: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"测试结果: 通过={passed}, 失败={failed}")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
