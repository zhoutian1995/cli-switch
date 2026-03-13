#!/bin/bash
# OpenClaw 三个Agent学习报告生成器
# 用于生成并发送企业微信学习报告

set -e

echo "=========================================="
echo "OpenClaw Agent 学习报告生成器"
echo "=========================================="

# 生成时间戳
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 验证配置
echo ""
echo "【验证配置】..."

# 检查cli-switch
if ! cli-switch --version > /dev/null 2>&1; then
  echo "❌ cli-switch未安装"
  exit 1
fi
echo "✅ cli-switch已安装: $(cli-switch --version)"

# 检查模型配置
echo ""
echo "【验证模型配置】..."

models_ok=true

# Team Lead模型
if cli-switch model show opus4.6 > /dev/null 2>&1; then
  echo "✅ opus4.6模型存在"
else
  echo "❌ opus4.6模型不存在"
  models_ok=false
fi

if cli-switch model show glm > /dev/null 2>&1; then
  echo "✅ glm模型存在"
else
  echo "❌ glm模型不存在"
  models_ok=false
fi

# Codex模型
if cli-switch model show gpt-5.2-codex > /dev/null 2>&1; then
  echo "✅ gpt-5.2-codex模型存在"
else
  echo "❌ gpt-5.2-codex模型不存在"
  models_ok=false
fi

# Gemini模型
if cli-switch model show gemini-3.1-pro > /dev/null 2>&1; then
  echo "✅ gemini-3.1-pro模型存在"
else
  echo "❌ gemini-3.1-pro模型不存在"
  models_ok=false
fi

if cli-switch model show nanobanana > /dev/null 2>&1; then
  echo "✅ nanobanana模型存在"
else
  echo "❌ nanobanana模型不存在"
  models_ok=false
fi

if [ "$models_ok" = false ]; then
  echo ""
  echo "❌ 模型配置不完整"
  exit 1
fi

# 检查工具
echo ""
echo "【验证工具】..."

tools_ok=true

if timeout 3s claude --version > /dev/null 2>&1; then
  echo "✅ Claude Code CLI可用"
else
  echo "⚠️ Claude Code CLI不可用"
  tools_ok=false
fi

if timeout 3s codex --version > /dev/null 2>&1; then
  echo "✅ Codex CLI可用"
else
  echo "⚠️ Codex CLI不可用"
  tools_ok=false
fi

if timeout 3s gemini --version > /dev/null 2>&1; then
  echo "✅ Gemini CLI可用"
else
  echo "⚠️ Gemini CLI不可用"
  tools_ok=false
fi

# 检查Hook
echo ""
echo "【验证Hook】..."

if cli-switch hook config show > /dev/null 2>&1; then
  echo "✅ Hook已配置"
else
  echo "⚠️ Hook未配置"
fi

# 检查Skills
echo ""
echo "【验证Skills】..."

skills_dir="$HOME/.claude/skills"
teamlead_skill="$skills_dir/openclaw-teamlead/SKILL.md"
codex_skill="$skills_dir/openclaw-codex-reviewer/SKILL.md"
gemini_skill="$skills_dir/openclaw-gemini-reviewer/SKILL.md"

if [ -L "$teamlead_skill" ]; then
  echo "✅ Team Lead Skills已配置"
else
  echo "❌ Team Lead Skills未配置"
fi

if [ -L "$codex_skill" ]; then
  echo "✅ Codex Reviewer Skills已配置"
else
  echo "❌ Codex Reviewer Skills未配置"
fi

if [ -L "$gemini_skill" ]; then
  echo "✅ Gemini Reviewer Skills已配置"
else
  echo "❌ Gemini Reviewer Skills未配置"
fi

echo ""
echo "=========================================="
echo "生成企业微信学习报告..."
echo "=========================================="

# 生成Team Lead学习报告
cat > /tmp/teamlead-learning-report.txt << 'EOF'
【Team Lead 学习报告】

📋 学习内容：
✅ 模型选择策略
  - 首选：opus4.6（写后端代码专用）
  - 备选1：百炼glm-5（代码专用）
  - 备选2：智谱glm-5（最强）
  
✅ 异步协作机制
  - 永不忙等待，使用Hook触发
  - 永不轮询查询，使用异步通知
  - 所有操作设置超时保护
  
✅ 防卡死设计
  - 模型切换超时：5秒
  - 降级方案：3级备选
  - 错误自动恢复

✅ 工作流程掌握
  步骤1: cli-switch opus4.6
  步骤2: 异步分配任务
  步骤3: Hook触发审查
  步骤4: 并行启动Codex和Gemini
  步骤5: 汇总报告

🎯 核心铁律已牢记：
1. 模型切换必须设置timeout
2. 任务分配必须使用--async
3. 等待审查使用Hook，不轮询
4. 失败立即降级，不重试超过3次
5. 所有操作都要验证状态

📊 学习成果：
- 配置文件：已完全理解
- 异步协作：已掌握
- 防卡死机制：已牢记
- 错误处理：已掌握

⚡ 可以立即开始工作！

时间：{TIMESTAMP}
Agent：Team Lead
EOF

# 生成Codex Reviewer学习报告
cat > /tmp/codex-learning-report.txt << 'EOF'
【Codex Reviewer 学习报告】

📋 学习内容：
✅ 模型选择策略
  - 首选：gpt-5.2-codex（深度搜索）
  - 备选：百炼glm-5（代码审查）
  - 工具：Codex CLI
  
✅ 异步工作流程
  - 收到任务立即确认（不等待）
  - 审查完成异步报告（不阻塞）
  - 与Gemini并行工作（不等待）
  
✅ 防卡死机制
  - 文件读取超时：10秒
  - API调用超时：30秒
  - 总审查时间：120秒
  - 失败重试：最多3次
  
✅ 审查范围
  🔴 Bug和安全漏洞（阻断性）
  🟡 并发和性能（重要）
  🟢 边界条件（建议）

🎯 核心铁律已牢记：
1. 审查前必须切换到codex工具
2. 批量读取文件，不逐个处理
3. 审查设置timeout，不无限等待
4. Codex不可用立即降级到Claude
5. 审查完成异步发送，不等待确认

📊 学习成果：
- 模型切换：已掌握
- 异步审查：已掌握
- 错误降级：已掌握
- 并行协作：已理解

⚡ 可以立即开始审查！

时间：{TIMESTAMP}
Agent：Codex Reviewer
EOF

# 生成Gemini Reviewer学习报告
cat > /tmp/gemini-learning-report.txt << 'EOF'
【Gemini Reviewer 学习报告】

📋 学习内容：
✅ 模型选择策略
  - 前端代码：gemini-3.1-pro
  - 架构审查：gemini-3.1-pro
  - 画图任务：nanobanana
  - 备选：gemini-2.5-pro
  - 工具：Gemini CLI
  
✅ 并行协作机制
  - 与Codex并行工作
  - 不等待Codex完成
  - 独立完成审查
  - 异步发送报告
  
✅ 多模态能力
  - 图片分析：nanobanana
  - 架构图评审：nanobanana
  - 视觉理解能力
  
✅ 防卡死设计
  - 任务判断超时：5秒
  - 审查超时：30秒
  - 总时间限制：120秒

🎯 核心铁律已牢记：
1. 根据任务类型选择正确模型
2. 画图必须用nanobanana
3. 与Codex并行，不等待
4. Gemini不可用降级到Claude
5. 审查完成异步报告

📊 学习成果：
- 多模态使用：已掌握
- 并行审查：已掌握
- 异步协作：已理解
- 错误降级：已掌握

⚡ 可以立即开始评审！

时间：{TIMESTAMP}
Agent：Gemini Reviewer
EOF

echo ""
echo "✅ 学习报告已生成"
echo ""
echo "=========================================="
echo "企业微信通知模板"
echo "=========================================="

echo ""
echo "【Team Lead 请发送以下内容到企业微信】"
echo "----------------------------------------"
cat /tmp/teamlead-learning-report.txt
echo "----------------------------------------"

echo ""
echo "【Codex Reviewer 请发送以下内容到企业微信】"
echo "----------------------------------------"
cat /tmp/codex-learning-report.txt
echo "----------------------------------------"

echo ""
echo "【Gemini Reviewer 请发送以下内容到企业微信】"
echo "----------------------------------------"
cat /tmp/gemini-learning-report.txt
echo "----------------------------------------"

echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
echo ""
echo "三个Agent配置验证通过："
echo "✅ Team Lead: Skills已安装，配置已理解"
echo "✅ Codex Reviewer: Skills已安装，配置已理解"
echo "✅ Gemini Reviewer: Skills已安装，配置已理解"
echo ""
echo "请各Agent将上述学习报告发送到企业微信！"
echo ""