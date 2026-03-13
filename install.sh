#!/bin/bash
# CLI-Switch 安装和配置脚本
# 用于OpenClaw的三个agent共享配置

set -e

echo "======================================"
echo "CLI-Switch 安装脚本"
echo "======================================"

# 检查是否在项目目录
if [ ! -f "pyproject.toml" ]; then
    echo "错误：请在cli-switch项目根目录运行此脚本"
    exit 1
fi

echo ""
echo "【步骤1】安装CLI-Switch"
pipx install -e . --force

echo ""
echo "【步骤2】验证安装"
cli-switch --version

echo ""
echo "【步骤3】创建共享Skills目录"
SKILLS_DIR="$HOME/.claude/skills/cli-switch"
mkdir -p "$SKILLS_DIR"

# 复制SKILL.md到共享目录
cp SKILL.md "$SKILLS_DIR/"
echo "✅ SKILL.md 已安装到 $SKILLS_DIR"

echo ""
echo "【步骤4】为三个Agent创建软连接"

# Agent 1: Team Lead
AGENT1_DIR="$HOME/.claude/skills/openclaw-teamlead"
mkdir -p "$AGENT1_DIR"
ln -sf "$SKILLS_DIR/SKILL.md" "$AGENT1_DIR/SKILL.md"
echo "✅ Team Lead agent 配置完成: $AGENT1_DIR"

# Agent 2: Codex Reviewer  
AGENT2_DIR="$HOME/.claude/skills/openclaw-codex-reviewer"
mkdir -p "$AGENT2_DIR"
ln -sf "$SKILLS_DIR/SKILL.md" "$AGENT2_DIR/SKILL.md"
echo "✅ Codex Reviewer agent 配置完成: $AGENT2_DIR"

# Agent 3: Gemini Reviewer
AGENT3_DIR="$HOME/.claude/skills/openclaw-gemini-reviewer"
mkdir -p "$AGENT3_DIR"
ln -sf "$SKILLS_DIR/SKILL.md" "$AGENT3_DIR/SKILL.md"
echo "✅ Gemini Reviewer agent 配置完成: $AGENT3_DIR"

echo ""
echo "【步骤5】配置Shell Hook"
cli-switch hook install

echo ""
echo "【步骤6】验证功能"
echo "测试模型切换..."
cli-switch qwen
cli-switch status

echo ""
echo "======================================"
echo "安装完成！"
echo "======================================"
echo ""
echo "三个Agent已配置完成："
echo "  1. Team Lead: $AGENT1_DIR"
echo "  2. Codex Reviewer: $AGENT2_DIR"
echo "  3. Gemini Reviewer: $AGENT3_DIR"
echo ""
echo "使用方法："
echo "  /cli-switch          # 查看帮助"
echo "  cli-switch qwen      # 切换到Qwen模型"
echo "  cli-switch status    # 查看当前状态"
echo ""
echo "请重启Claude Code以生效"