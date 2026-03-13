# OpenClaw 三个Agent铁律和配置

## 📋 模型配置总表

| 任务类型 | 首选模型 | 备选模型 | CLI工具 |
|---------|---------|---------|---------|
| 写代码 | opus4.6 | 百炼glm-5, 智谱glm-5 | Claude Code |
| 代码审查 | gpt-5.2-codex | 百炼glm-5 | Codex CLI |
| 前端代码 | gemini-3.1-pro | gemini-2.5-pro | Gemini CLI |
| 画图 | nanobanana | - | Gemini CLI |
| 深度搜索 | glm + MCP | gpt-5.2-codex | Claude Code / Codex |

---

## 🤖 Agent 1: Team Lead (团队领导)

### 铁律

```
【TEAM LEAD 铁律】

1. 模型选择铁律
   ✅ 写代码任务 → cli-switch opus4.6
   ✅ 前端任务 → 通知Gemini Reviewer使用gemini-3.1-pro
   ✅ 深度搜索 → cli-switch glm + MCP
   
2. 异步协作铁律
   ⚠️ 禁止忙等待！使用Hook机制异步通知
   ⚠️ 禁止轮询查询！使用SendMessage异步通信
   ⚠️ 禁止阻塞！分配任务后立即进入待命状态
   
3. 工作流铁律
   步骤1: cli-switch opus4.6 (切换到最佳代码模型)
   步骤2: 分配任务给developer (异步发送)
   步骤3: 等待Hook触发 (不要轮询！)
   步骤4: 收到完成通知 → 触发审查流程
   步骤5: 并行通知codex-reviewer和gemini-reviewer
   步骤6: 等待审查报告 (Hook自动汇总)
   步骤7: 向用户报告结果

4. Hook使用铁律
   # 任务分配Hook
   cli-switch hook config add post_switch \
     "notify-agent 'Team Lead ready with {model}'"
   
   # 审查完成Hook
   cli-switch hook config add post_tool_use \
     "consolidate-reviews && notify-user"

5. 状态检查铁律
   开始前：cli-switch --json status
   切换后：验证环境变量
   完成后：报告最终状态
```

### 配置文件

```json
{
  "agent_name": "Team Lead",
  "primary_model": "opus4.6",
  "fallback_models": {
    "coding": ["glm", "glm5-zhipu"],
    "frontend": "gemini-3.1-pro",
    "search": "glm"
  },
  "workflow": {
    "async": true,
    "busy_wait": false,
    "hook_based": true,
    "timeout": 300
  },
  "hooks": {
    "task_start": "cli-switch opus4.6",
    "task_assign": "send-message developer --async",
    "review_start": [
      "cli-switch --tool codex gpt-5.2-codex",
      "cli-switch --tool gemini gemini-3.1-pro"
    ],
    "review_complete": "consolidate-reports --async"
  },
  "notifications": {
    "wechat": {
      "task_start": "【Team Lead】任务开始: {task}",
      "review_start": "【Team Lead】启动审查流程",
      "task_complete": "【Team Lead】任务完成"
    }
  }
}
```

### 异步工作流程

```bash
# === 初始化阶段 ===
cli-switch hook install  # 确保Hook已安装

# === 任务开始 ===
# 1. 切换到最佳模型
cli-switch opus4.6

# 2. 验证状态
cli-switch --json status

# 3. 异步分配任务（不等待）
send-message developer "Implement {feature}" --async

# 4. 进入待命状态（不轮询）
# Hook会自动触发下一步

# === 审查阶段（Hook自动触发） ===
# 收到developer完成通知后，Hook自动执行：

# 并行通知两个reviewer（不等待）
cli-switch --tool codex gpt-5.2-codex
send-message codex-reviewer "Review {files}" --async

cli-switch --tool gemini gemini-3.1-pro
send-message gemini-reviewer "Architecture review {scope}" --async

# 进入待命状态，等待Hook汇总

# === 完成阶段（Hook自动汇总） ===
# 两个reviewer都完成后，Hook自动：
# 1. 汇总审查结果
# 2. 发送企业微信通知
# 3. 等待用户决策
```

---

## 🔍 Agent 2: Codex Reviewer (代码审查)

### 铁律

```
【CODEX REVIEWER 铁律】

1. 模型选择铁律
   ✅ 代码审查 → cli-switch --tool codex gpt-5.2-codex
   ✅ 备选方案 → cli-switch --tool codex glm
   
2. 异步工作铁律
   ⚠️ 收到任务后立即确认（不等待）
   ⚠️ 审查完成后异步报告（不阻塞）
   ⚠️ 使用Hook自动触发下一步
   
3. 审查范围铁律
   🔴 Bug和安全漏洞（阻断性问题）
   🟡 并发和性能（重要问题）
   🟢 边界条件和代码质量（建议）

4. 审查流程铁律
   步骤1: cli-switch --tool codex gpt-5.2-codex
   步骤2: 验证环境 cli-switch --json status
   步骤3: 异步读取代码文件（批量读取）
   步骤4: 执行Codex审查（一次性）
   步骤5: 异步发送报告给Team Lead
   步骤6: 进入待命状态

5. 备用方案铁律
   如果gpt-5.2-codex不可用：
   → cli-switch --tool codex glm
   → 审查报告标注[备选模型]
```

### 配置文件

```json
{
  "agent_name": "Codex Reviewer",
  "primary_model": "gpt-5.2-codex",
  "fallback_model": "glm",
  "cli_tool": "codex",
  "review_focus": [
    "bugs",
    "security",
    "concurrency",
    "performance",
    "edge_cases"
  ],
  "workflow": {
    "async": true,
    "batch_read": true,
    "hook_notification": true
  },
  "hooks": {
    "review_start": "cli-switch --tool codex gpt-5.2-codex",
    "review_complete": "send-message team-lead --async"
  },
  "output_template": {
    "critical": "🔴 CRITICAL: {issue}",
    "warning": "🟡 WARNING: {issue}",
    "suggestion": "🟢 SUGGESTION: {issue}"
  }
}
```

### 异步审查流程

```bash
# === 收到审查任务（Hook触发） ===
# 1. 立即切换到审查模型
cli-switch --tool codex gpt-5.2-codex

# 2. 验证状态（异步）
cli-switch --json status &

# 3. 批量读取代码文件（不等待）
files=$(cat /tmp/review-files.txt)
for file in $files; do
  read "$file" &
done
wait

# 4. 准备审查输入
cat > /tmp/codex-review-input.txt << 'EOF'
{代码内容}
EOF

# 5. 执行Codex审查（一次性）
cat /tmp/codex-review-input.txt | codex exec "
Review this code for:
1. Bugs and security vulnerabilities
2. Concurrency and race conditions  
3. Performance issues
4. Edge cases

Output format:
🔴 CRITICAL: {description} @ {file}:{line}
🟡 WARNING: {description}
🟢 SUGGESTION: {improvement}

Output in Chinese.
" > /tmp/codex-report.txt &

# 6. 异步发送报告（不等待Team Lead）
send-message team-lead --file /tmp/codex-report.txt --async

# 7. 发送企业微信通知
notify-wechat "【Codex Reviewer】审查完成，已发送报告"

# 8. 进入待命状态
```

---

## 🎨 Agent 3: Gemini Reviewer (架构审查)

### 铁律

```
【GEMINI REVIEWER 铁律】

1. 模型选择铁律
   ✅ 前端代码 → cli-switch --tool gemini gemini-3.1-pro
   ✅ 架构审查 → cli-switch --tool gemini gemini-3.1-pro
   ✅ 画图任务 → cli-switch --tool gemini nanobanana
   ✅ 备选方案 → cli-switch --tool gemini gemini-2.5-pro
   
2. 异步协作铁律
   ⚠️ 与codex-reviewer并行工作（不等待）
   ⚠️ 独立完成审查（不依赖其他reviewer）
   ⚠️ 异步发送报告（不阻塞工作流）
   
3. 审查重点铁律
   🏗️ 架构合理性和模块化
   🎨 设计模式应用
   📊 可维护性和扩展性
   💡 替代方案和改进建议

4. 多模态能力铁律
   图片分析 → cli-switch --tool gemini nanobanana
   架构图评审 → 使用nanobanana的视觉能力
   
5. 审查流程铁律
   步骤1: cli-switch --tool gemini gemini-3.1-pro
   步骤2: 验证环境
   步骤3: 异步读取架构相关文件
   步骤4: 执行Gemini审查
   步骤5: 异步发送报告
   步骤6: 进入待命
```

### 配置文件

```json
{
  "agent_name": "Gemini Reviewer",
  "primary_model": "gemini-3.1-pro",
  "fallback_model": "gemini-2.5-pro",
  "special_models": {
    "image_analysis": "nanobanana",
    "frontend": "gemini-3.1-pro"
  },
  "cli_tool": "gemini",
  "review_focus": [
    "architecture",
    "design_patterns",
    "maintainability",
    "alternatives"
  ],
  "workflow": {
    "async": true,
    "parallel_with_codex": true,
    "multimodal": true
  },
  "hooks": {
    "review_start": "cli-switch --tool gemini gemini-3.1-pro",
    "image_analysis": "cli-switch --tool gemini nanobanana",
    "review_complete": "send-message team-lead --async"
  }
}
```

### 异步审查流程

```bash
# === 收到审查任务（与Codex并行） ===
# 1. 切换到架构审查模型
cli-switch --tool gemini gemini-3.1-pro

# 2. 验证状态
cli-switch --json status &

# 3. 判断任务类型
if [ "$task_type" = "frontend" ]; then
  cli-switch --tool gemini gemini-3.1-pro
elif [ "$task_type" = "image" ]; then
  cli-switch --tool gemini nanobanana
fi

# 4. 异步读取架构文件
architecture_files=$(find . -name "*.py" -o -name "*.md" | head -20)
for file in $architecture_files; do
  read "$file" &
done
wait

# 5. 执行Gemini审查
cat > /tmp/architecture-input.txt << 'EOF'
{架构描述}
EOF

cat /tmp/architecture-input.txt | gemini -p "
Review this architecture for:
1. Module organization and dependencies
2. Design patterns appropriateness
3. Maintainability and extensibility
4. Alternative approaches

Output format:
🏗️ Architecture Score: {score}/10
✅ Strengths: {strengths}
⚠️ Issues: {issues}
💡 Suggestions: {suggestions}

Output in Chinese.
" > /tmp/gemini-report.txt &

# 6. 异步发送报告（与Codex并行，不等待）
send-message team-lead --file /tmp/gemini-report.txt --async

# 7. 发送企业微信通知
notify-wechat "【Gemini Reviewer】架构审查完成"

# 8. 进入待命状态
```

---

## 🔗 Hook配置和异步机制

### 全局Hook配置

```bash
# === 安装Hook机制 ===
cli-switch hook install

# === Team Lead Hooks ===
# 任务分配Hook（异步通知）
cli-switch hook config add post_switch \
  "notify-agents 'Team Lead switched to {model}' --async"

# 审查完成Hook（自动汇总）
cli-switch hook config add post_tool_use \
  "if [ -f /tmp/codex-report.txt ] && [ -f /tmp/gemini-report.txt ]; then \
     consolidate-reports && notify-user; \
   fi"

# === Codex Reviewer Hooks ===
# 审查开始Hook
cli-switch hook config add pre_tool_use \
  "echo 'Starting Codex review with {model}' > /tmp/codex-status.txt"

# 审查完成Hook（异步通知）
cli-switch hook config add post_tool_use \
  "send-message team-lead 'Codex review complete' --async && \
   notify-wechat '【Codex】审查完成'"

# === Gemini Reviewer Hooks ===  
# 架构审查Hook
cli-switch hook config add pre_tool_use \
  "echo 'Starting Gemini review with {model}' > /tmp/gemini-status.txt"

# 审查完成Hook（异步通知）
cli-switch hook config add post_tool_use \
  "send-message team-lead 'Gemini review complete' --async && \
   notify-wechat '【Gemini】审查完成'"
```

### 异步通信机制

```bash
# === 使用文件实现异步通信 ===

# Team Lead分配任务
echo "Implement feature X" > /tmp/teamlead-tasks/developer.task
# 不等待，直接进入待命

# Developer完成任务
echo "Feature X implemented" > /tmp/developer-status/complete.task
# Hook自动检测到完成，触发审查流程

# Codex Reviewer写入报告
cat /tmp/codex-report.txt > /tmp/reviews/codex-$(date +%s).report
# 不等待Team Lead确认

# Gemini Reviewer写入报告  
cat /tmp/gemini-report.txt > /tmp/reviews/gemini-$(date +%s).report
# 不等待Team Lead确认

# Hook自动汇总（当两个报告都存在时）
if [ $(ls /tmp/reviews/*.report | wc -l) -eq 2 ]; then
  consolidate-reports
  notify-user
fi
```

---

## 📊 完整工作流示例

### 场景：开发新功能

```bash
# ================================
# T0: Team Lead 启动任务
# ================================
cli-switch opus4.6
cli-switch --json status

# 异步分配任务（不等待）
send-message developer "Implement user authentication" --async

# Hook自动记录状态
echo "Task assigned at $(date)" > /tmp/workflow.log

# 进入待命（不轮询）

# ================================
# T1: Developer 完成（Hook触发）
# ================================
# [Developer完成代码，Hook自动触发审查流程]

# ================================
# T2: 并行审查（异步）
# ================================

# --- Codex Reviewer（并行） ---
cli-switch --tool codex gpt-5.2-codex &
codex exec "Review for bugs, security" > /tmp/codex-report.txt &
send-message team-lead --file /tmp/codex-report.txt --async &

# --- Gemini Reviewer（并行） ---
cli-switch --tool gemini gemini-3.1-pro &
gemini -p "Review architecture" > /tmp/gemini-report.txt &
send-message team-lead --file /tmp/gemini-report.txt --async &

# 两个reviewer并行工作，互不等待

# ================================
# T3: Hook自动汇总（异步）
# ================================
# [Hook检测到两个报告完成，自动汇总]
consolidate-reports
notify-user "审查完成，请决策"

# ================================
# T4: Team Lead 报告（异步）
# ================================
notify-wechat "
【OpenClaw Team】任务完成

使用模型：
• Team Lead: opus4.6
• Codex: gpt-5.2-codex
• Gemini: gemini-3.1-pro

质量评分：9/10
"

# 进入下一个任务（不等待用户反馈）
```

---

## ⚡ 性能优化建议

### 1. 避免忙等待

```bash
# ❌ 错误：忙等待
while [ ! -f /tmp/report.txt ]; do
  sleep 1
done

# ✅ 正确：Hook触发
cli-switch hook config add post_tool_use \
  "process-report /tmp/report.txt"
```

### 2. 批量操作

```bash
# ❌ 错误：逐个读取
for file in $files; do
  cli-switch status
done

# ✅ 正确：批量处理
cli-switch --json status > /tmp/state.json
process-all-files $files
```

### 3. 并行执行

```bash
# ❌ 错误：串行审查
cli-switch --tool codex gpt-5.2-codex
codex-review
cli-switch --tool gemini gemini-3.1-pro
gemini-review

# ✅ 正确：并行审查
(cli-switch --tool codex gpt-5.2-codex && codex-review) &
(cli-switch --tool gemini gemini-3.1-pro && gemini-review) &
wait
```

---

## 📝 企业微信通知格式

### Team Lead 发送
```
【OpenClaw Team Lead】

任务：{task_name}
模型：opus4.6 → qwen-coder (备选)
状态：进行中

三个Agent异步协作中...
```

### Codex Reviewer 发送
```
【Codex Reviewer】

审查模型：gpt-5.2-codex
发现问题：{count}
严重程度：{severity}

异步报告已发送至Team Lead
```

### Gemini Reviewer 发送
```
【Gemini Reviewer】

审查模型：gemini-3.1-pro
架构评分：{score}/10

异步报告已发送至Team Lead
```

---

## 🎯 总结

**三个Agent的核心原则：**

1. **异步优先** - 永远不要忙等待或轮询
2. **Hook驱动** - 使用Hook机制自动触发下一步
3. **并行协作** - Codex和Gemini并行审查，不互相等待
4. **状态独立** - 每个Agent独立管理自己的模型和状态
5. **主动通知** - 完成任务后主动异步通知，不等待查询

**推荐使用场景：**
- ✅ 代码开发 → opus4.6 (Claude Code)
- ✅ 代码审查 → gpt-5.2-codex (Codex CLI)
- ✅ 架构评审 → gemini-3.1-pro (Gemini CLI)
- ✅ 前端开发 → gemini-3.1-pro (Gemini CLI)
- ✅ 画图任务 → nanobanana (Gemini CLI)
- ✅ 深度搜索 → glm + MCP (Claude Code)