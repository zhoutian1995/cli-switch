#!/bin/bash
# 安装 pre-commit hook
# 防止 CI 失败的代码质量检查

set -e

echo "🔍 安装 pre-commit hook..."
echo ""

# 检查是否在 git 仓库中
if [ ! -d ".git" ]; then
    echo "❌ 不在 git 仓库中，请在项目根目录运行"
    exit 1
fi

# 复制 pre-commit hook
if [ -f "scripts/pre-commit" ]; then
    cp scripts/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "  ✅ pre-commit hook 已安装"
else
    echo "  ⚠️  scripts/pre-commit 不存在，创建默认 hook"
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
set -e
echo "🔍 Running pre-commit checks..."
ruff check src/ tests/ --fix
black --check src/ tests/
pytest tests/ -q
echo "✅ All checks passed!"
EOF
    chmod +x .git/hooks/pre-commit
    echo "  ✅ 默认 pre-commit hook 已安装"
fi

# 安装依赖
echo ""
echo "📦 检查依赖..."
if command -v pipx &> /dev/null; then
    pipx install ruff 2>/dev/null || echo "  ⚠️  ruff 已安装或安装失败"
    pipx install black 2>/dev/null || echo "  ⚠️  black 已安装或安装失败"
    echo "  ✅ ruff 和 black 已安装"
else
    echo "  ⚠️  pipx 未安装，请手动安装 ruff 和 black"
    echo "     brew install pipx"
    echo "     pipx install ruff black"
fi

echo ""
echo "🎉 Pre-commit hook 安装完成！"
echo ""
echo "现在每次 git commit 都会自动运行："
echo "  1. ruff check --fix"
echo "  2. black --check"
echo "  3. pytest tests/"
echo ""
echo "全部通过才允许提交！"
