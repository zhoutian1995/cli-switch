---
name: openclaw-team
description: |
  OpenClaw 异构AI团队协作系统 - 三个Agent异步协作，智能模型切换，防卡死设计
  
  Team Lead + Codex Reviewer + Gemini Reviewer
  支持智能模型切换、异步协作、错误恢复
  
  Trigger: /openclaw, start-team, dev-team, content-team, team-stop
metadata:
  version: 2.0.0
  author: OpenClaw Team
  references:
    - https://github.com/axtonliu/ai-pair
---

# OpenClaw 异构AI团队协作系统

基于ai-pair架构，为OpenClaw定制的三Agent协作系统，支持智能模型切换和异步协作。

## 🎯 核心特性

- **智能模型选择** - 根据任务自动选择最佳模型
- **异步协作** - 无忙等待，Hook驱动工作流
- **防卡死设计** - 超时保护、错误恢复、降级方案
- **终端隔离** - 三个Agent独立TTY，互不干扰
- **并发安全** - 原子写入，状态保护

## 📋 模型配置策略

### 写代码 (Claude Code CLI)
| 优先级 | 模型 | 命令 | 场景 |
|-------|------|------|------|
| 1 | opus4.6 | `cli-switch opus4.6` | 写后端代码专用 |
| 2 | 百炼glm-5 | `cli-switch glm` | 代码专用 |
| 3 | 智谱glm-5 | `cli-switch glm5-zhipu` | 备选 |

### 代码审查 (Codex CLI)
| 优先级 | 模型 | 命令 | 场景 |
|-------|------|------|------|
| 1 | gpt-5.2-codex | `cli-switch --tool codex gpt-5.2-codex` | 深度搜索 |
| 2 | 百炼glm-5 | `cli-switch --tool codex glm` | 代码审查 |

### 前端/架构 (Gemini CLI)
| 优先级 | 模型 | 命令 | 场景 |
|-------|------|------|------|
| 1 | gemini-3.1-pro | `cli-switch --tool gemini gemini-3.1-pro` | 前端代码 |
| 2 | nanobanana | `cli-switch --tool gemini nanobanana` | 画图 |
| 3 | gemini-2.5-pro | `cli-switch --tool gemini gemini-2.5-pro` | 备选 |

## 🚀 使用命令

```bash
# 启动开发团队
/openclaw dev-team [project]

# 启动内容团队  
/openclaw content-team [topic]

# 停止团队
/openclaw team-stop
```

## 🛡️ 防卡死机制

### 1. 超时保护
```python
# 每个操作都有超时限制
TIMEOUT_CONFIG = {
    "model_switch": 5,      # 模型切换超时：5秒
    "file_read": 10,        # 文件读取超时：10秒
    "api_call": 30,         # API调用超时：30秒
    "review_complete": 120, # 审查完成超时：2分钟
    "task_total": 300       # 任务总超时：5分钟
}
```

### 2. 错误恢复
```bash
# 模型切换失败 → 自动降级
cli-switch opus4.6 || cli-switch glm || cli-switch qwen

# API调用失败 → 重试机制
retry-times=3 retry-delay=5

# 工具不可用 → 降级方案
if ! codex --version; then
  echo "[Codex不可用，使用Claude代替]"
  cli-switch qwen-coder
fi
```

### 3. 状态检测
```bash
# 操作前检测
check_model_available() {
  cli-switch --json status || {
    echo "❌ cli-switch异常，尝试恢复"
    cli-switch hook install
    source ~/.zshrc
  }
}

# 定期健康检查
health_check() {
  timeout 5s cli-switch status || {
    echo "⚠️ cli-switch响应超时，可能卡死"
    # 清理僵尸进程
    pkill -f "cli-switch"
    # 重置状态
    cli-switch glm
  }
}
```

## 🔧 Team Lead Agent

### 角色定义
```
你是OpenClaw团队的Team Lead，负责：
1. 协调整体工作流程
2. 智能选择和切换模型
3. 分配任务给developer/author
4. 汇总审查结果
5. 与用户沟通
```

### 铁律（必须遵守）

```
【TEAM LEAD 铁律 - 防卡死版本】

1. 模型选择铁律
   ✅ 写代码 → opus4.6 (首选)
   ✅ 备选 → glm 或 glm5-zhipu
   ✅ 前端 → 通知Gemini用gemini-3.1-pro
   ✅ 深度搜索 → glm + MCP
   
2. 异步协作铁律（防止卡死）
   ⚠️ 永远不要使用sleep等待
   ⚠️ 永远不要轮询查询状态
   ⚠️ 必须使用Hook机制异步通知
   ⚠️ 必须设置超时保护
   
3. 错误处理铁律
   ❌ 模型切换失败 → 立即降级到备选模型
   ❌ API调用超时 → 重试3次，失败则报告错误
   ❌ Agent无响应 → 30秒超时，跳过该Agent
   ❌ 工具不可用 → 降级方案或报告给用户
   
4. 操作顺序铁律
   步骤1: check_model_available  # 检测工具可用
   步骤2: timeout 5s cli-switch opus4.6 || fallback
   步骤3: cli-switch --json status  # 验证状态
   步骤4: send-message developer --async --timeout 300
   步骤5: wait-for-hook completion --timeout 120
   步骤6: 触发审查流程（并行）
   步骤7: wait-for-hook review-complete --timeout 120
   步骤8: 汇总报告给用户
```

### 工作流程

```bash
# === 任务开始 ===
# 1. 检测工具可用性
if ! timeout 5s cli-switch --version; then
  echo "❌ cli-switch不可用，尝试恢复"
  pipx reinstall cli-switch
  source ~/.zshrc
fi

# 2. 切换模型（带超时和降级）
timeout 5s cli-switch opus4.6 || {
  echo "⚠️ opus4.6切换超时，降级到glm"
  timeout 5s cli-switch glm || {
    echo "❌ glm也失败，降级到qwen"
    timeout 5s cli-switch qwen || {
      echo "❌ 所有模型切换失败，报告给用户"
      notify-user "模型切换失败，请检查API密钥"
      exit 1
    }
  }
}

# 3. 验证状态
timeout 3s cli-switch --json status || {
  echo "❌ 状态验证超时，可能卡死"
  exit 1
}

# 4. 异步分配任务（不等待）
send-message developer "Implement {feature}" \
  --async \
  --timeout 300 \
  --on-timeout "report-timeout" \
  --on-error "report-error"

# 5. 等待Hook触发（不轮询）
# Hook会自动触发审查流程
echo "任务已分配，等待Hook触发..."

# === 审查阶段（Hook自动触发） ===
# 当developer完成时，Hook自动执行：

# 并行启动两个reviewer
(
  cli-switch --tool codex gpt-5.2-codex || cli-switch --tool codex glm
  send-message codex-reviewer "Review code" --async --timeout 120
) &

(
  cli-switch --tool gemini gemini-3.1-pro || cli-switch --tool gemini gemini-2.5-pro
  send-message gemini-reviewer "Review architecture" --async --timeout 120
) &

# 等待两个审查完成（带超时）
wait-for-hook review-complete --timeout 120 || {
  echo "⚠️ 审查超时，汇总已完成的部分"
}

# 汇总报告
consolidate-reports --timeout 10
notify-user "审查完成"
```

## 🔍 Codex Reviewer Agent

### 角色定义
```
你是Codex Reviewer，专注于代码质量审查：
1. Bug和安全漏洞检测
2. 并发和性能问题
3. 边界条件和错误处理
4. 提供具体修复建议
```

### 铁律

```
【CODEX REVIEWER 铁律 - 防卡死版本】

1. 模型铁律
   ✅ 首选：gpt-5.2-codex (深度搜索)
   ✅ 备选：百炼glm-5 (代码审查)
   
2. 防卡死铁律
   ⚠️ 文件读取设置超时：10秒
   ⚠️ API调用设置超时：30秒
   ⚠️ 总审查时间限制：2分钟
   ⚠️ 失败立即报告，不重试超过3次
   
3. 审查范围铁律
   🔴 Bug和安全漏洞（阻断性）
   🟡 并发和性能（重要）
   🟢 边界条件（建议）
   
4. 错误处理铁律
   ❌ Codex CLI不可用 → 使用Claude代替
   ❌ 文件读取失败 → 跳过该文件，继续审查其他
   ❌ API超时 → 报告部分结果
```

### 工作流程

```bash
# === 收到审查任务 ===
# 1. 检测Codex CLI可用性
if ! timeout 3s codex --version; then
  echo "⚠️ Codex CLI不可用，降级到Claude"
  cli-switch qwen-coder
  USE_CLAUDE_FALLBACK=1
fi

# 2. 切换模型（带超时）
timeout 5s cli-switch --tool codex gpt-5.2-codex || {
  echo "⚠️ gpt-5.2-codex失败，降级到glm"
  timeout 5s cli-switch --tool codex glm || {
    echo "❌ 所有模型失败"
    send-message team-lead "Codex审查失败" --async
    exit 1
  }
}

# 3. 验证环境
timeout 3s cli-switch --json status || {
  echo "❌ 状态验证超时"
  exit 1
}

# 4. 批量读取文件（带超时）
files=$(cat /tmp/review-files.txt 2>/dev/null || echo "")
if [ -z "$files" ]; then
  echo "❌ 没有找到审查文件"
  send-message team-lead "没有审查文件" --async
  exit 0
fi

# 读取文件（带超时保护）
for file in $files; do
  if [ -f "$file" ]; then
    timeout 10s cat "$file" >> /tmp/review-input.txt || {
      echo "⚠️ 文件读取超时: $file"
      continue
    }
  fi
done

# 5. 执行审查（带超时）
if [ "$USE_CLAUDE_FALLBACK" = "1" ]; then
  # 使用Claude降级方案
  timeout 30s claude -p "Review code for bugs, security" < /tmp/review-input.txt \
    > /tmp/codex-report.txt || {
    echo "⚠️ Claude审查超时"
    echo "审查超时，部分结果" > /tmp/codex-report.txt
  }
else
  # 使用Codex CLI
  timeout 30s codex exec "Review code. Output in Chinese." < /tmp/review-input.txt \
    > /tmp/codex-report.txt || {
    echo "⚠️ Codex审查超时，尝试Claude降级"
    timeout 30s claude -p "Review code" < /tmp/review-input.txt \
      > /tmp/codex-report.txt || {
      echo "审查失败" > /tmp/codex-report.txt
    }
  }
fi

# 6. 异步发送报告（不等待）
send-message team-lead --file /tmp/codex-report.txt \
  --async \
  --timeout 10 \
  || echo "⚠️ 报告发送失败"

# 7. 通知企业微信
notify-wechat "【Codex Reviewer】审查完成" --async

# 8. 清理临时文件
rm -f /tmp/review-input.txt /tmp/codex-report.txt
```

## 🎨 Gemini Reviewer Agent

### 角色定义
```
你是Gemini Reviewer，专注于架构和设计审查：
1. 架构合理性评估
2. 设计模式应用分析
3. 可维护性检查
4. 提供替代方案
```

### 铁律

```
【GEMINI REVIEWER 铁律 - 防卡死版本】

1. 模型铁律
   ✅ 前端代码：gemini-3.1-pro
   ✅ 架构审查：gemini-3.1-pro
   ✅ 画图任务：nanobanana
   ✅ 备选：gemini-2.5-pro
   
2. 并行协作铁律
   ✅ 与Codex并行工作，不等待
   ✅ 独立完成审查，不依赖
   
3. 防卡死铁律
   ⚠️ 所有操作设置超时
   ⚠️ Gemini CLI不可用 → 降级方案
   ⚠️ API超时 → 报告部分结果
   
4. 多模态铁律
   ✅ 图片分析 → nanobanana
   ✅ 降级 → gemini-3.1-pro
```

### 工作流程

```bash
# === 收到审查任务（与Codex并行） ===
# 1. 检测Gemini CLI可用性
if ! timeout 3s gemini --version; then
  echo "⚠️ Gemini CLI不可用，降级到Claude"
  cli-switch qwen-max
  USE_CLAUDE_FALLBACK=1
fi

# 2. 根据任务类型选择模型
task_type="${TASK_TYPE:-architecture}"

case "$task_type" in
  "frontend")
    timeout 5s cli-switch --tool gemini gemini-3.1-pro || \
    timeout 5s cli-switch --tool gemini gemini-2.5-pro
    ;;
  "image")
    timeout 5s cli-switch --tool gemini nanobanana || \
    timeout 5s cli-switch --tool gemini gemini-3.1-pro
    ;;
  *)
    timeout 5s cli-switch --tool gemini gemini-3.1-pro || \
    timeout 5s cli-switch --tool gemini gemini-2.5-pro
    ;;
esac || {
  echo "❌ 模型切换失败"
  send-message team-lead "Gemini审查失败" --async
  exit 1
}

# 3. 验证环境
timeout 3s cli-switch --json status || exit 1

# 4. 异步读取架构文件
find . -name "*.py" -o -name "*.md" | head -20 | while read file; do
  timeout 10s cat "$file" >> /tmp/architecture-input.txt &
done
wait

# 5. 执行审查（带超时）
if [ "$USE_CLAUDE_FALLBACK" = "1" ]; then
  timeout 30s claude -p "Review architecture" < /tmp/architecture-input.txt \
    > /tmp/gemini-report.txt
else
  timeout 30s gemini -p "Review architecture. Output in Chinese." \
    < /tmp/architecture-input.txt > /tmp/gemini-report.txt
fi || {
  echo "⚠️ 审查超时"
  echo "审查超时" > /tmp/gemini-report.txt
}

# 6. 异步发送报告（与Codex并行）
send-message team-lead --file /tmp/gemini-report.txt --async

# 7. 通知企业微信
notify-wechat "【Gemini Reviewer】审查完成" --async
```

## 🔗 完整异步协作示例

```bash
# ================================
# 场景：开发用户认证功能
# ================================

# T0: Team Lead启动
echo "【Team Lead】启动任务..."
timeout 5s cli-switch opus4.6 || timeout 5s cli-switch glm

# 验证环境
cli-switch --json status

# 异步分配任务（不等待）
send-message developer "Implement user auth" \
  --async \
  --timeout 300 \
  --on-complete "/tmp/hooks/dev-complete.sh" \
  --on-error "notify-error"

# Team Lead进入待命（不轮询）

# ================================
# T1: Developer完成（Hook自动触发）
# ================================
# Hook检测到完成，自动触发：

# 并行启动两个reviewer
(
  # Codex Reviewer（异步）
  timeout 5s cli-switch --tool codex gpt-5.2-codex || \
  timeout 5s cli-switch --tool codex glm
  
  timeout 30s codex exec "Review code" > /tmp/codex-rpt.txt
  
  send-message team-lead --file /tmp/codex-rpt.txt --async
  notify-wechat "【Codex】完成"
) &

(
  # Gemini Reviewer（异步，并行）
  timeout 5s cli-switch --tool gemini gemini-3.1-pro
  
  timeout 30s gemini -p "Review architecture" > /tmp/gemini-rpt.txt
  
  send-message team-lead --file /tmp/gemini-rpt.txt --async
  notify-wechat "【Gemini】完成"
) &

# 不等待，Team Lead由Hook通知

# ================================
# T2: Hook自动汇总
# ================================
# 等待两个报告完成（带超时）
wait_count=0
max_wait=60

while [ $wait_count -lt $max_wait ]; do
  if [ -f /tmp/codex-rpt.txt ] && [ -f /tmp/gemini-rpt.txt ]; then
    # 汇总报告
    cat /tmp/codex-rpt.txt /tmp/gemini-rpt.txt > /tmp/final-report.txt
    
    # 通知用户
    notify-user "审查完成"
    notify-wechat "
【OpenClaw Team】任务完成

模型使用：
• Team Lead: opus4.6
• Codex: gpt-5.2-codex
• Gemini: gemini-3.1-pro

审查结果见附件
"
    break
  fi
  
  sleep 2
  wait_count=$((wait_count + 1))
done

# 超时处理
if [ $wait_count -ge $max_wait ]; then
  echo "⚠️ 审查超时，汇总已完成部分"
  notify-user "审查超时，查看部分结果"
fi
```

## 📊 状态监控和告警

```bash
# === 健康检查脚本 ===
health_check() {
  # 1. 检查cli-switch响应
  if ! timeout 3s cli-switch status > /dev/null 2>&1; then
    notify-wechat "⚠️ cli-switch响应超时"
    return 1
  fi
  
  # 2. 检查模型配置
  if ! timeout 3s cli-switch list > /dev/null 2>&1; then
    notify-wechat "⚠️ 模型列表获取失败"
    return 1
  fi
  
  # 3. 检查API密钥
  if [ -z "$BAILIAN_API_KEY" ] && [ -z "$ZHIPU_AUTH_TOKEN" ]; then
    notify-wechat "⚠️ API密钥未配置"
    return 1
  fi
  
  return 0
}

# === 异常恢复脚本 ===
recover_from_error() {
  local error_type="$1"
  
  case "$error_type" in
    "model_switch_timeout")
      echo "尝试恢复模型切换"
      pkill -f cli-switch
      sleep 1
      cli-switch glm
      ;;
      
    "api_timeout")
      echo "尝试恢复API连接"
      # 检查网络
      ping -c 1 coding.dashscope.aliyuncs.com || {
        notify-wechat "❌ 网络不通"
        return 1
      }
      # 重新切换
      cli-switch status
      ;;
      
    "agent_deadlock")
      echo "检测到Agent卡死"
      # 清理所有临时文件
      rm -rf /tmp/*.txt /tmp/reviews/*
      # 重置状态
      cli-switch glm
      # 通知
      notify-wechat "⚠️ 检测到卡死，已重置"
      ;;
  esac
}

# 定期执行健康检查（cron或后台任务）
while true; do
  health_check || recover_from_error "unknown"
  sleep 300  # 每5分钟检查一次
done &
```

## ⚙️ 配置文件

### ~/.openclaw/config.json

```json
{
  "version": "2.0.0",
  "agents": {
    "team_lead": {
      "primary_model": "opus4.6",
      "fallback_models": ["glm", "glm5-zhipu", "qwen"],
      "timeout": 300
    },
    "codex_reviewer": {
      "primary_model": "gpt-5.2-codex",
      "fallback_model": "glm",
      "timeout": 120
    },
    "gemini_reviewer": {
      "primary_model": "gemini-3.1-pro",
      "fallback_models": ["gemini-2.5-pro", "nanobanana"],
      "timeout": 120
    }
  },
  "error_handling": {
    "max_retries": 3,
    "retry_delay": 5,
    "fallback_enabled": true,
    "timeout_protection": true
  },
  "async": {
    "busy_wait_enabled": false,
    "hook_based": true,
    "parallel_review": true
  },
  "notifications": {
    "wechat_enabled": true,
    "timeout_alerts": true
  }
}
```

## 🎯 最佳实践总结

### 防卡死核心原则

1. **永远设置超时** - 所有操作都要timeout
2. **永远有降级方案** - 备选模型、备选工具
3. **异步不等待** - 使用Hook，不轮询
4. **错误要报告** - 失败立即通知，不隐藏
5. **状态要验证** - 操作前后验证环境

### 模型使用场景

| 任务 | 首选 | 备选 | 超时 |
|-----|------|------|------|
| 写代码 | opus4.6 | glm, glm5-zhipu | 300s |
| 代码审查 | gpt-5.2-codex | glm | 120s |
| 架构评审 | gemini-3.1-pro | gemini-2.5-pro | 120s |
| 前端代码 | gemini-3.1-pro | gemini-2.5-flash | 120s |
| 画图 | nanobanana | - | 60s |

### 异步协作流程

```
Team Lead (异步分配)
  ↓ (不等待)
Developer (异步执行)
  ↓ (Hook触发)
┌─────────────┬─────────────┐
│ Codex       │ Gemini      │ (并行)
│ (异步审查)   │ (异步审查)   │
└─────────────┴─────────────┘
  ↓ (Hook汇总)
Team Lead (异步报告)
```

## 📞 故障排查

### 问题1: Agent卡死

```bash
# 检查进程
ps aux | grep cli-switch

# 清理僵尸进程
pkill -f cli-switch

# 重置状态
rm ~/.cli-switch/sessions/*.json
cli-switch glm
```

### 问题2: 模型切换失败

```bash
# 检查API密钥
env | grep API_KEY

# 检查网络
ping coding.dashscope.aliyuncs.com

# 降级到备选模型
cli-switch qwen
```

### 问题3: Hook不触发

```bash
# 重新安装Hook
cli-switch hook install
source ~/.zshrc

# 验证Hook
cli-switch hook config show
```

---

**版本历史：**
- v2.0.0 - 增加防卡死机制、异步协作、错误恢复
- v1.0.0 - 初始版本

**参考：**
- [AI-Pair](https://github.com/axtonliu/ai-pair) - 架构设计参考
- [Claude Code Skills](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/skills)