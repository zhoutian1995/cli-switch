# 企业微信通知模板

## Team Lead Agent 通知模板

### 任务开始通知
```
【OpenClaw Team Lead】任务启动

📋 任务类型：{任务类型}
🤖 使用模型：{model_name}
⏰ 开始时间：{timestamp}

使用命令：
• cli-switch {model} 切换模型
• cli-switch status 查看状态

技术细节：
- 支持Claude Code、Gemini CLI、Codex CLI
- 多终端隔离，互不干扰
- 并发安全，原子写入保护

建议使用场景：
✅ 代码开发：qwen-coder / glm
✅ 通用对话：qwen
✅ 深度推理：qwen-max / glm5-zhipu
✅ 多模态：gemini-3.1-pro

注意事项：
⚠️ 每次切换前检查当前状态
⚠️ 确保API密钥已配置
⚠️ 多agent协作时注意终端隔离
```

### 任务完成通知
```
【OpenClaw Team Lead】任务完成

✅ 完成任务：{task_name}
⏱️ 耗时：{duration}
📊 使用模型：{model_name}

审查结果：
• Codex Review: {codex_result}
• Gemini Review: {gemini_result}

质量评估：{quality_score}/10

下一步建议：
{next_steps}
```

## Codex Reviewer Agent 通知模板

### 审查开始通知
```
【Codex Reviewer】开始代码审查

🔍 审查范围：{files}
🤖 审查模型：{model_name}
📋 审查重点：
  • Bug和安全漏洞
  • 并发和性能问题
  • 边界条件处理

使用命令：
cli-switch --tool codex {model}

技术优势：
✅ Codex CLI专用模型
✅ 深度代码分析
✅ 安全漏洞检测

适用场景：
✅ 代码质量审查
✅ 安全审计
✅ 性能优化建议
```

### 审查完成通知
```
【Codex Reviewer】审查完成

🔍 审查文件：{files}
⏱️ 耗时：{duration}

发现问题：
🔴 严重 ({critical}): {critical_issues}
🟡 警告 ({warning}): {warning_issues}
🟢 建议 ({suggestion}): {suggestions}

质量评分：{score}/10

改进建议：
{improvements}

使用感想：
✅ cli-switch让模型切换非常方便
✅ JSON输出便于集成到工作流
✅ 多终端隔离确保审查独立

注意事项：
⚠️ 确保使用--tool codex参数
⚠️ 审查前验证API密钥
⚠️ 保存审查结果到文件
```

## Gemini Reviewer Agent 通知模板

### 审查开始通知
```
【Gemini Reviewer】开始架构审查

🏗️ 审查范围：{scope}
🤖 审查模型：{model_name}
📋 审查重点：
  • 架构合理性
  • 设计模式应用
  • 可维护性

使用命令：
cli-switch --tool gemini {model}

技术优势：
✅ Gemini CLI原生支持
✅ 支持智谱GLM模型
✅ 多模态分析能力

适用场景：
✅ 架构设计评审
✅ 代码结构优化
✅ 技术方案评估
```

### 审查完成通知
```
【Gemini Reviewer】审查完成

🏗️ 审查范围：{scope}
⏱️ 耗时：{duration}

架构评估：
• 模块化：{modularity}/10
• 扩展性：{extensibility}/10
• 可维护性：{maintainability}/10

主要发现：
✅ 优点：{strengths}
⚠️ 改进点：{improvements}
💡 建议：{recommendations}

使用感想：
✅ 支持智谱GLM-5非常适合中文审查
✅ gemini-3.1-pro推理能力强
✅ nanobanana可以分析架构图

注意事项：
⚠️ 切换时使用--tool gemini
⚠️ 中文审查用智谱模型
⚠️ 多模态分析用nanobanana
```

## 汇总报告模板

### 三个Agent联合报告
```
【OpenClaw Team】协作完成报告

📊 项目：{project_name}
⏱️ 总耗时：{total_duration}
🤖 参与Agent：3个

━━━━━━━━━━━━━━━━━━━━
Team Lead 总结
━━━━━━━━━━━━━━━━━━━━
使用模型：{teamlead_model}
完成任务：{completed_tasks}
质量评分：{quality_score}/10

使用感想：
✅ cli-switch极大地简化了模型管理
✅ 多终端隔离让三个agent可以并行工作
✅ JSON输出便于自动化流程

最佳使用场景：
• 代码开发 → qwen-coder
• 快速审查 → qwen
• 深度分析 → qwen-max

━━━━━━━━━━━━━━━━━━━━
Codex Reviewer 总结
━━━━━━━━━━━━━━━━━━━━
审查模型：{codex_model}
发现issue：{issues_found}
严重问题：{critical_issues}

使用感想：
✅ Codex CLI集成完美
✅ 代码审查质量高
✅ 安全检测准确

建议：
• 安全审计用qwen-coder
• 性能优化用qwen-max

━━━━━━━━━━━━━━━━━━━━
Gemini Reviewer 总结
━━━━━━━━━━━━━━━━━━━━
审查模型：{gemini_model}
架构评分：{architecture_score}
改进建议：{suggestions_count}条

使用感想：
✅ Gemini CLI支持智谱模型
✅ GLM-5中文理解能力强
✅ 多模态分析是亮点

建议：
• 架构审查用gemini-3.1-pro
• 图表分析用nanobanana

━━━━━━━━━━━━━━━━━━━━
整体评价
━━━━━━━━━━━━━━━━━━━━
cli-switch为OpenClaw团队提供了强大的模型管理能力：

✅ 核心优势：
  1. 一键切换多个AI工具
  2. 多终端完美隔离
  3. Agent友好的JSON输出
  4. 并发安全有保障

⚠️ 注意事项：
  1. 首次使用需配置API密钥
  2. 切换前检查当前状态
  3. 多agent协作时注意终端区分

🎯 推荐使用场景：
  • 团队协作开发
  • 多模型交叉审查
  • 自动化工作流集成

工具评分：⭐⭐⭐⭐⭐ (5/5)
推荐指数：强烈推荐！
```