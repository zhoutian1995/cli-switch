# cli-switch 变更记录

## v2.0.0（规划中）

### 新增功能
- **4 层 Adapter 架构**：CLI → Core Resolver → Adapter → Registry，工具差异封装在 Adapter 内
- **`resolve --json`**：标准化 RuntimeSpec 输出，含 schema_version、模型信息、认证状态、命令规格、能力声明
- **`auth status --json`**：认证状态诊断，支持 4 种模式（api_key/login/oauth/none）× 6 种状态（ready/missing/expired/conflict/unsupported/unknown）
- **`doctor --json`**：统一健康检查，合并 v1 的 validate + health-check，支持 7 类检查项
- **Profile 系统**：同一工具多种运行模式（如 claude-code/default、claude-code/router）
- **OpenCode Adapter**：新增 OpenCode CLI 支持
- **schema_version**：所有 JSON 输出包含版本号，支持消费者兼容性判断
- **Renderer 模块**：文本/JSON 输出渲染分离
- **Adapter Contract Test**：强制每个 Adapter 通过统一接口测试

### 架构变更
- 核心代码重组为 `core/`、`adapters/`、`registry/` 三个子目录
- 模型管理从 `models.py` 迁入 `registry/models.py`
- 新增 `types.py` 统一数据结构定义（RuntimeSpec/AuthResult/CommandSpec/Profile 等）
- 错误系统重构：9 类 ErrorType → 8 类字符串错误码 + 统一 CLISwitchError 模型
- 配置路径 XDG 标准化（`~/.cli-switch/` → `~/.config/cli-switch/` + `~/.local/share/cli-switch/`）

### 废弃预告
- `cli-switch status` → 迁移到 `cli-switch auth status`
- `cli-switch validate` → 迁移到 `cli-switch doctor`
- `cli-switch health-check` → 迁移到 `cli-switch doctor --network`
- `cli-switch test` → 迁移到 `cli-switch doctor --network`
- 以上命令在 v2.0 仍可用（输出 deprecation warning），计划 v2.1 移除

### 保留功能（v1.2.0 → v2.0 无变化）
- 模型切换 `cli-switch <model>`
- Agent Mode `cli-switch env <model>`
- Hook 引擎（post_switch / pre_tool_use / post_tool_use）
- MCP Server 管理
- 终端隔离（TTY Session + PID 验证）
- 并发安全（fcntl flock + 原子写）
- 自定义模型管理
- 图片生成（Gemini API）
- 端到端聊天测试

---

## v1.2.0

### 新增
- `cli-switch env` Agent Mode — 零副作用并发安全模型切换
- ModelRegistry quiet 参数支持

## v1.1.0

### 新增
- 配置验证系统（validator）
- CLI 菜单增强 + 脱敏处理
- Phase 1+2 并发安全与稳健性重构
- Imagen 4 Ultra 图片生成
- 端到端测试

## v1.0.0

### 初始版本
- 支持 Claude Code / Gemini CLI / Codex CLI
- 20+ 内置模型（智谱 GLM + Fucheers + Google + OpenAI）
- MCP Server 管理（ZAI 视觉、web-search、web-reader）
- Hook 引擎
- 终端隔离 Session
- 健康检查
- JSON 输出模式
