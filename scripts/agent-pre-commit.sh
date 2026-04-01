#!/bin/bash
# Agent 提交前质量检查脚本
# 防止不符合规范的代码提交到 GitHub
# 
# 用法:
#   bash ~/projects/cli-switch/scripts/agent-pre-commit.sh [项目路径]
#   或在项目目录中运行:
#   bash ~/projects/cli-switch/scripts/agent-pre-commit.sh .

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# 获取项目目录
PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

# 1. Ruff lint 检查（自动修复）
echo "  → Running ruff..."
if command -v ruff &> /dev/null; then
    ruff check src/ tests/ --fix 2>&1 || {
        echo "    ❌ ruff 检查失败，请修复后重试"
        exit 1
    }
    echo "    ✅ ruff passed"
else
    echo "    ⚠️  ruff 未安装，跳过"
fi

# 2. Black 格式检查
echo "  → Running black..."
if command -v black &> /dev/null; then
    black --check src/ tests/ 2>&1 || {
        echo "    ⚠️  格式检查失败，正在自动修复..."
        black src/ tests/
        echo "    ✅ 格式已自动修复，请重新提交"
        exit 1
    }
    echo "    ✅ black passed"
else
    echo "    ⚠️  black 未安装，跳过"
fi

# 3. 运行测试
echo "  → Running pytest..."
if command -v pytest &> /dev/null; then
    pytest tests/ -v --tb=short -q 2>&1 || {
        echo "    ❌ 测试失败，请修复后重试"
        exit 1
    }
    echo "    ✅ tests passed"
else
    echo "    ⚠️  pytest 未安装，跳过"
fi

echo ""
echo "✅ All pre-commit checks passed!"
echo ""
