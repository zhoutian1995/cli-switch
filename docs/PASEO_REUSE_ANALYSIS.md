# Paseo 参考价值分析

> 更新日期：2026-05-08
>
> 参考对象：<https://github.com/getpaseo/paseo>

## 结论

Paseo 对 cli-switch 有明确参考价值，但不适合直接复制代码。

原因：
- Paseo 是成熟的多端 Agent 编排系统，覆盖 daemon、CLI、desktop/mobile/web、relay、skills 和 worktree 流程。
- cli-switch 的产品定位更底层：作为 Agent Capability Router，提供稳定 CLI / JSON 能力调用接口。
- Paseo 使用 AGPL-3.0 许可证；cli-switch 当前是 MIT。直接复制实现会带来许可证污染风险。

建议策略：参考架构模式和产品设计，不复制源码实现。

## 可参考的设计模式

| Paseo 能力 | 对 cli-switch 的参考价值 |
|------------|--------------------------|
| Daemon + session 生命周期 | 后续如需长期 Agent 会话，可参考 `run/ls/attach/send` 这类操作模型。 |
| `--worktree` 工作流 | 对应 cli-switch 后续 worktree 隔离和临时任务分支。 |
| Handoff / Loop / Orchestrator skills | 与 cli-switch 的 Capability / Strategy / Skill 三层抽象高度相关。 |
| 多 provider CLI 统一入口 | 可参考其 agent 选择与 provider 命名方式，但保持 cli-switch 的 gateway/tier 抽象。 |
| Self-hosted relay | 当前不是 cli-switch 重点；只作为远期 remote-control 参考。 |

## 不建议照搬的部分

- Mobile / desktop / web UI：超出 cli-switch 当前 CLI 执行层定位。
- Relay 加密通信：属于远程控制产品能力，不是下一轮 P0。
- AGPL 源码实现：不可直接复制到 MIT 项目。
- 持久 daemon 架构：除非 cli-switch 从一次性执行器升级为长期 session manager，否则不应过早引入。

## 对下一轮路线图的影响

Paseo 最适合影响 cli-switch 的后续 P2 设计：

1. **worktree 隔离**：参考 `paseo run --worktree feature-x` 的用户心智，cli-switch 可设计 `--worktree` 或 sandbox 策略字段。
2. **Skill 工作流**：参考 `/paseo-handoff`、`/paseo-loop`、`/paseo-orchestrator` 的命名和用途，但实现应落在 cli-switch 的 Strategy registry。
3. **Session 可观测性**：如果未来加入 daemon，可参考 `ls/attach/send` 模型；当前不进入 P0/P1。

## 当前决策

- P0/P1 不直接依赖 Paseo。
- P2 worktree / Skill 设计阶段再做更深入源码阅读。
- 任何参考实现必须重新设计并独立实现，保留 MIT 许可证边界。
