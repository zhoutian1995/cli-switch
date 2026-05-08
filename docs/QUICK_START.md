# cli-switch 快速上手

## 安装

```
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install
npm run build
```

## 30 秒体验

### 查看路由决策（不执行）
```
cli-switch run "帮我重构这个函数" --dry-run
```

### 指定 Agent 执行
```
cli-switch run "写个排序算法" --agent codex
```

### JSON 输出（给 Agent 用）
```
cli-switch run "解释这段代码" --json
```

## 配置 LLM 意图分析（可选）

```
export OPENROUTER_API_KEY=sk-or-v1-xxx
# 现在会用 LLM 分析你的意图
```

## 配置 Agent Gateway / 中转站（可选）

```
# 推荐：显式 cli-switch gateway
export SWITCH_API_KEY=your-gateway-key
export SWITCH_BASE_URL=https://your-relay.example.com/v1
export SWITCH_MODEL_STANDARD=your-standard-model

# 自建中转站别名也可用
export SWITCH_RELAY_API_KEY=your-relay-key
export SWITCH_RELAY_BASE_URL=https://your-relay.example.com/v1

# OpenRouter key 也可复用为 Agent gateway key
export OPENROUTER_API_KEY=sk-or-v1-xxx
```

优先级：`SWITCH_*` > `SWITCH_RELAY_*` > `OPENROUTER_*`。

## 下一步

- 阅读 README.md 了解完整功能
- 查看 docs/ 了解架构设计
