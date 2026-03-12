# CLI Switch 测试报告

**测试日期**: 2026-03-12
**测试版本**: cli-switch 0.1.0

---

## 执行摘要

**测试结果**: ✅ **11/11 通过 (100%)**

| 类别 | 通过数 | 总数 | 通过率 |
|------|--------|------|--------|
| 百炼模型 | 8 | 8 | 100% ✅ |
| 智谱模型 | 2 | 2 | 100% ✅ |
| Fucheers 模型 | 1 | 1 | 100% ✅ |

---

## 一、模型列表（按用户配置）

### 百炼模型 (8 个) - Claude Code / Codex CLI

| 别名 | 模型名称 | 模型 Key | base_url | 测试结果 |
|:---|:---|:---|:---|:---|
| qwen | Qwen3.5+ | qwen3.5-plus | coding.dashscope.aliyuncs.com | ✅ |
| qwen-max | Qwen3 Max | qwen3-max-2026-01-23 | coding.dashscope.aliyuncs.com | ✅ |
| qwen-next | Qwen Coder Next | qwen3-coder-next | coding.dashscope.aliyuncs.com | ✅ |
| qwen-coder | Qwen Coder+ | qwen3-coder-plus | coding.dashscope.aliyuncs.com | ✅ |
| minimax | MiniMax M2.5 | MiniMax-M2.5 | coding.dashscope.aliyuncs.com | ✅ |
| glm | GLM-5 (百炼) | glm-5 | coding.dashscope.aliyuncs.com | ✅ |
| glm47 | GLM-4.7 (百炼) | glm-4.7 | coding.dashscope.aliyuncs.com | ✅ |
| kimi | Kimi K2.5 | kimi-k2.5 | coding.dashscope.aliyuncs.com | ✅ |

### 智谱模型 (2 个) - Claude Code / Gemini CLI

| 别名 | 模型名称 | 模型 Key | base_url | 测试结果 |
|:---|:---|:---|:---|:---|
| glm47-zhipu | GLM-4.7 | glm-4.7 | open.bigmodel.cn | ✅ |
| glm5-zhipu | 智谱 GLM-5 | glm-5 | open.bigmodel.cn | ✅ |

### Fucheers 模型 (1 个) - 仅 Claude Code

| 别名 | 模型名称 | 模型 Key | base_url | 测试结果 |
|:---|:---|:---|:---|:---|
| opus4.6 | Opus 4.6 | claude-opus-4-6 | www.fucheers.top | ✅ |

### Gemini CLI 模型 (2 个)

| 别名 | 模型名称 | 模型 Key | 描述 |
|:---|:---|:---|:---|
| gemini-31-pro | Gemini 3.1 Pro | gemini-3.1-pro | 写前端代码 |
| nanobanana | Gemini 3 Pro Image | gemini-3-pro-image | 画图专用 |

### Codex CLI 模型 (2 个)

| 别名 | 模型名称 | 模型 Key | 描述 |
|:---|:---|:---|:---|
| gpt-5.2-codex | GPT-5.2 Codex | gpt-5.2-codex | 深度搜索 |
| gpt-5.4-codex | GPT-5.4 Codex | gpt-5-4-codex | 代码 review |

---

## 二、详细测试结果

### 百炼模型测试

```
测试：qwen
  期望 model: qwen3.5-plus ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：qwen-max
  期望 model: qwen3-max-2026-01-23 ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：qwen-next
  期望 model: qwen3-coder-next ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：qwen-coder
  期望 model: qwen3-coder-plus ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：minimax
  期望 model: MiniMax-M2.5 ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：glm
  期望 model: glm-5 ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：glm47
  期望 model: glm-4.7 ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅

测试：kimi
  期望 model: kimi-k2.5 ✅
  期望 base_url: https://coding.dashscope.aliyuncs.com/apps/anthropic ✅
```

### 智谱模型测试

```
测试：glm47-zhipu
  期望 model: glm-4.7 ✅
  期望 base_url: https://open.bigmodel.cn/api/anthropic ✅

测试：glm5-zhipu
  期望 model: glm-5 ✅
  期望 base_url: https://open.bigmodel.cn/api/anthropic ✅
```

### Fucheers 模型测试

```
测试：opus4.6
  期望 model: claude-opus-4-6 ✅
  期望 base_url: https://www.fucheers.top ✅
```

---

## 三、使用说明

### 安装
```bash
cd ~/projects/cli-switch
pip3 install --break-system-packages -e .
```

### 基本用法
```bash
# 切换模型
cli-switch qwen          # 百炼 Qwen3.5+
cli-switch opus4.6       # Fucheers Opus 4.6
cli-switch glm5-zhipu    # 智谱 GLM-5

# 查看状态
cli-switch status

# 列出模型
cli-switch list

# 测试端点
cli-switch test
```

### 交互式菜单
```bash
cli-menu
```

---

## 四、Git 提交历史

```
a2b54fa 修正模型列表 - 仅保留用户配置的 15 个模型
f27eb6b Add comprehensive test report (TEST_REPORT.md)
30d2922 Fix CLI argument parsing and add comprehensive tests
2640fcc Add cli-menu interactive bash script
9b36ed8 Initial commit: cli-switch v0.1.0
```

---

## 五、项目结构

```
~/projects/cli-switch/
├── README.md
├── TEST_REPORT.md           # 测试报告
├── pyproject.toml
├── src/cli_switch/
│   ├── __init__.py
│   ├── __main__.py
│   ├── main.py              # 主入口
│   ├── models.py            # 模型定义 (15 个)
│   ├── config.py            # 配置管理
│   └── switcher.py          # 切换逻辑
├── scripts/cli-menu         # Bash 菜单
└── tests/test_models.py     # 测试脚本
```

---

**报告生成**: cli-switch test v0.1.0
**项目位置**: `~/projects/cli-switch`
