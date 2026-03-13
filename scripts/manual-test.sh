#!/usr/bin/env bash
# 手动端到端测试脚本 - 测试每个模型能否正常回复

set -e

# 设置环境变量 (注意: OPENAI_API_KEY 不要覆盖，使用系统中的值)
export BAILIAN_API_KEY="sk-sp-f44502a7dac14c66ac903c429ca21345"
export ZHIPU_AUTH_TOKEN="d15c3c036d7f4029a0fa6128c13ae8f8.Er6qlNj3CSVl02y3"
export ANTHROPIC_AUTH_TOKEN="sk-sP0U7aUfN4ExpAfRv4UO1yUf2ZUeMW5Ffoi5khkJV5lzaeOA"
# OPENAI_API_KEY 保持系统原有值，不要覆盖

# 激活虚拟环境
source .venv/bin/activate

echo "========================================"
echo "CLI-Switch 手动端到端测试"
echo "========================================"
echo ""

# 测试函数
test_model() {
    local tool=$1
    local model=$2
    
    echo ""
    echo ">>> 测试: $tool / $model"
    echo "----------------------------------------"
    
    python -m cli_switch chat-test "$model" 2>&1
    
    echo ""
    read -p "按 Enter 继续下一个模型..."
}

# Claude 工具模型列表
CLAUDE_MODELS="qwen qwen-max qwen-next qwen-coder minimax glm glm47 kimi glm47-zhipu glm5-zhipu opus4.6 sonnet4.6"

# Gemini 工具模型列表
GEMINI_MODELS="gemini-3.1-pro gemini-2.5-flash gemini-2.5-pro"

# Codex 工具模型列表
CODEX_MODELS="gpt-5.2-codex"

echo "选择测试范围:"
echo "  1) 测试 Claude 工具所有模型"
echo "  2) 测试 Gemini 工具所有模型"
echo "  3) 测试 Codex 工具所有模型"
echo "  4) 测试所有模型"
echo "  5) 测试单个模型"
echo ""
read -p "请选择 (1-5): " choice

case $choice in
    1)
        for model in $CLAUDE_MODELS; do
            test_model "claude" "$model"
        done
        ;;
    2)
        for model in $GEMINI_MODELS; do
            test_model "gemini" "$model"
        done
        ;;
    3)
        for model in $CODEX_MODELS; do
            test_model "codex" "$model"
        done
        ;;
    4)
        for model in $CLAUDE_MODELS; do
            test_model "claude" "$model"
        done
        for model in $GEMINI_MODELS; do
            test_model "gemini" "$model"
        done
        for model in $CODEX_MODELS; do
            test_model "codex" "$model"
        done
        ;;
    5)
        read -p "输入模型名称 (如 qwen, gemini-2.5-flash): " model
        test_model "auto" "$model"
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "测试完成！"
echo "========================================"