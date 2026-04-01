# OpenClaw 三个 Agent 使用指南

## 架构说明

您的三个agent共享一个cli-switch skills文件，通过软连接方式配置：

```
~/.claude/skills/
├── cli-switch/
│   └── SKILL.md          # 共享的skills文件
├── openclaw-teamlead -> cli-switch/SKILL.md
├── openclaw-codex-reviewer -> cli-switch/SKILL.md
└── openclaw-gemini-reviewer -> cli-switch/SKILL.md
```

## 三个 Agent 的角色和模型使用策略

### Agent 1: Team Lead (团队领导)

**角色职责：**
- 协调整体工作流程
- 分配任务给其他两个agent
- 汇总和评估审查结果
- 与用户沟通

**推荐模型：**
- **默认：** `opus4.6` - 写后端/架构代码（首选）
- **复杂任务：** `glm-5.1` - 最新旗舰版，最强推理
- **代码相关：** `glm-5` - 代码专用

**使用场景：**
```bash
# 任务开始
cli-switch opus4.6
cli-switch --json status

# 分配给开发者
# developer开始工作...

# 收到开发者完成通知
# 切换到审查模式
cli-switch --tool codex gpt-5.2-codex
# codex-reviewer开始审查

# 并行架构审查
cli-switch --tool gemini gemini-3.1-pro
# gemini-reviewer开始审查

# 汇总审查结果
cli-switch status

# 向用户报告
```

**企业微信通知模板：**
```
【Team Lead】任务进度更新

当前阶段：{阶段名称}
使用模型：{model_name}
参与Agent：{agent_list}

审查结果摘要：
- Codex: {codex_summary}
- Gemini: {gemini_summary}

下一步：{next_action}
```

### Agent 2: Codex Reviewer (代码审查)

**角色职责：**
- 专注于代码质量审查
- 发现bug、安全漏洞、性能问题
- 检查并发和边界条件
- 提供具体修复建议

**推荐模型：**
- **代码审查：** `gpt-5.2-codex` (Codex CLI) - 深度搜索（首选）

**使用场景：**
```bash
# 确保使用Codex工具
cli-switch --tool codex gpt-5.2-codex

# 验证环境
cli-switch --json status

# 读取代码变更
# 使用Read/Glob/Grep工具

# 准备审查输入
cat > /tmp/review-input.txt << 'EOF'
{代码内容}
EOF

# 执行审查
cat /tmp/review-input.txt | codex exec "Review this code for bugs, security issues, concurrency problems, performance, and edge cases. Output in Chinese."

# 如果需要更强分析
cli-switch --tool codex gpt-5.2-codex
cat /tmp/review-input.txt | codex exec "Deep analysis for critical bugs and security vulnerabilities. Output in Chinese."

# 汇总报告发送给Team Lead
# 使用SendMessage工具
```

**审查重点：**
1. **Bug和安全漏洞**
   - 输入验证
   - SQL注入、XSS
   - 权限检查
   - 错误处理

2. **并发问题**
   - 竞态条件
   - 死锁风险
   - 资源泄露

3. **性能问题**
   - 算法复杂度
   - 内存使用
   - I/O优化

4. **边界条件**
   - 空值处理
   - 越界访问
   - 异常输入

**企业微信通知模板：**
```
【Codex Review】代码审查完成

审查模型：{model_name}
审查范围：{files_changed}

发现问题：
🔴 严重 ({critical_count}): {critical_issues}
🟡 警告 ({warning_count}): {warning_issues}
🟢 建议 ({suggestion_count}): {suggestions}

质量评分：{score}/10

详细报告已发送至Team Lead
```

### Agent 3: Gemini Reviewer (架构审查)

**角色职责：**
- 专注于架构和设计审查
- 评估设计模式应用
- 分析可维护性
- 提供替代方案

**推荐模型：**
- **架构审查：** `gemini-3.1-pro` - 推理能力强
- **多模态分析：** `nanobanana` - 支持图表分析
- **快速评估：** `gemini-2.5-flash` - 快速响应

**使用场景：**
```bash
# 切换到Gemini工具
cli-switch --tool gemini gemini-3.1-pro

# 验证环境
cli-switch --json status

# 读取架构相关文件
# 使用Read/Glob/Grep工具

# 准备架构审查输入
cat > /tmp/architecture-review.txt << 'EOF'
{架构描述/代码结构}
EOF

# 执行架构审查
cat /tmp/architecture-review.txt | gemini -p "Review this architecture focusing on design patterns, maintainability, and alternatives. Output in Chinese."

# 如果需要分析架构图
cli-switch --tool gemini nanobanana
# 使用多模态能力分析图表

# 汇总报告发送给Team Lead
# 使用SendMessage工具
```

**审查重点：**
1. **架构合理性**
   - 模块划分
   - 依赖关系
   - 扩展性
   - 可测试性

2. **设计模式**
   - 模式选择是否合理
   - 是否过度设计
   - 是否有更合适的模式

3. **可维护性**
   - 代码组织
   - 命名规范
   - 文档完整性
   - 测试覆盖率

4. **替代方案**
   - 其他实现方式
   - 权衡分析
   - 迁移成本

**企业微信通知模板：**
```
【Gemini Review】架构评审完成

评审模型：{model_name}
评审范围：{scope}

架构评分：
- 模块化：{modularity_score}/10
- 扩展性：{extensibility_score}/10
- 可维护性：{maintainability_score}/10

主要发现：
✅ 优点：{strengths}
⚠️ 改进点：{improvements}
💡 建议：{recommendations}

详细报告已发送至Team Lead
```

## 完整工作流程示例

### 场景：开发新功能

```bash
# === Team Lead ===
# 1. 任务开始
cli-switch opus4.6
cli-switch status

# 输出：
# 当前工具：CLAUDE
# 当前模型：Opus 4.6 (opus4.6)
# 模型 ID: claude-opus-4-6

# 2. 分配任务给developer
# [developer开始编写代码...]

# 3. developer完成，进入审查阶段
# Team Lead切换到审查模型
cli-switch --tool codex gpt-5.2-codex
# 通知codex-reviewer开始审查

cli-switch --tool gemini gemini-3.1-pro
# 通知gemini-reviewer开始审查

# 4. 等待两个reviewer的报告
# [收到审查结果]

# 5. 汇总结果，向用户报告
cli-switch status


# === Codex Reviewer ===
# 1. 确认使用Codex工具
cli-switch --tool codex gpt-5.2-codex

# 2. 验证状态
cli-switch --json status
# 返回：{"active_tool": "codex", "active_model": "gpt-5.2-codex", ...}

# 3. 读取代码变更
# Read files...

# 4. 执行审查
cat /tmp/review-input.txt | codex exec "Review for bugs, security, performance. Output in Chinese."

# 5. 发送报告给Team Lead


# === Gemini Reviewer ===
# 1. 切换到Gemini工具
cli-switch --tool gemini gemini-3.1-pro

# 2. 验证状态
cli-switch --json status

# 3. 读取架构相关文件
# Read files...

# 4. 执行架构审查
cat /tmp/architecture.txt | gemini -p "Review architecture and design. Output in Chinese."

# 5. 发送报告给Team Lead
```

## 环境检测和状态管理

### 每个Agent在开始任务前都应该：

```bash
# 1. 检查当前环境
cli-switch --json status

# 返回示例：
{
  "active_tool": "claude",
  "active_model": "opus4.6",
  "model_name": "Opus 4.6"
}

# 2. 根据需要切换模型
cli-switch {appropriate-model}

# 3. 再次验证
cli-switch status
```

### 多终端隔离验证

```bash
# 检查当前TTY
tty
# 输出：/dev/ttys001

# 查看TTY专属状态
cat ~/.cli-switch/sessions/dev_ttys001.json

# 确认环境变量
echo $ANTHROPIC_MODEL
echo $ANTHROPIC_BASE_URL
```

## 故障排查

### 问题1：模型切换失败

```bash
# 检查配置文件
cat ~/.claude/settings.json

# 检查API密钥
env | grep -E "ZHIPU_AUTH_TOKEN"

# 重新切换
cli-switch opus4.6
```

### 问题2：多个Agent状态冲突

```bash
# 检查TTY隔离
cli-switch status
tty

# 清理幽灵状态
rm ~/.cli-switch/sessions/*.json

# 重新切换
cli-switch opus4.6
```

### 问题3：Codex/Gemini CLI不可用

```bash
# 检查CLI是否安装
codex --version
gemini --version

# 检查认证
codex auth status
gemini auth status
```

## 性能监控

### 监控切换延迟

```bash
time cli-switch opus4.6
# 应该 < 1秒
```

### 监控API响应

```bash
cli-switch test opus4.6
# 检查连通性和响应时间
```

### 监控并发安全

```bash
# 多个Agent同时切换
# Agent 1:
cli-switch opus4.6 &
# Agent 2:
cli-switch glm-5 &
# Agent 3:
cli-switch gpt-5.2-codex &

# 检查是否有冲突
cli-switch status
```

## 最佳实践

### 1. 任务开始前
- 检查当前状态
- 确认使用正确的工具和模型
- 验证环境变量

### 2. 任务进行中
- 保持模型稳定，避免频繁切换
- 定期检查状态
- 记录关键操作

### 3. 任务结束后
- 汇总报告
- 清理临时状态
- 准备下一个任务

### 4. 团队协作
- 使用企业微信及时沟通
- 明确分工和责任
- 共享审查结果
- 保持信息同步