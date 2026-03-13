# CLI-Switch 重构技术方案与任务拆解 (Remediation Plan)

**日期**: 2026-03-13
**状态**: Phase 1 & Phase 2 已确认，开始执行

---

## Phase 1: 安全加固（无架构变更）

### 1.1 修复 hook 持久化污染 (P0-3)
- **文件**: `main.py:283-296`
- **变更**: 删除 `add_hook()` 调用，`check_reentrancy=False` 改为 `True`
- **原因**: `--hook` 是一次性临时命令，不应持久化到 hooks.yaml；hook 被执行两次

### 1.2 hooks.py 添加 shlex.quote() 防 shell 注入
- **文件**: `hooks.py:99-102`
- **变更**: context 值替换占位符时加 `shlex.quote()` 转义
- **原因**: model_id 等用户输入直接拼接到 `shell=True` 的命令中

### 1.3 main.py 全局 JSON 兜底
- **文件**: `main.py:122-234`
- **变更**: 提取 `_main_inner(argv, json_output)`，外层 `main()` 做全局 try/except
- **原因**: ConfigError 等异常在 handler 外部发生时，JSON 模式泄漏非 JSON 文本

### 1.4 修复 handle_health_check JSON 模式混合输出
- **文件**: `main.py:1285-1320`
- **变更**: 进度输出包裹在 `if not json_output:` 条件内
- **原因**: JSON 模式下 stdout 混入了 `print()` 进度信息

---

## Phase 2: 并发安全

### 2.1 新增 filelock.py
- **文件**: 新增 `src/cli_switch/filelock.py`
- **设计**: 基于 `fcntl.flock` 的 context manager，非阻塞 + 超时重试
- **锁目录**: `~/.cli-switch/locks/`
- **锁粒度**: claude.lock, gemini.lock, codex.lock, hooks.lock, sessions.lock

### 2.2 switcher.py 加锁 + 原子写入
- **文件**: `switcher.py:60-248`
- **变更**: 三个 `_switch_*()` 方法用 `get_lock()` 包裹读-改-写，写入改为 temp+rename
- **原因**: 当前裸 open("w") 存在 TOCTOU 竞争和写中断截断风险

### 2.3 hooks.yaml 读-改-写加锁
- **文件**: `hooks.py`
- **变更**: 新增 `_modify_hooks_config(modifier_fn)` 统一加锁的 load-modify-save
- **决策**: 整个 load-modify-save 在同一把锁内，不分开加锁

### 2.4 cleanup_stale_sessions 加锁 + 降频
- **文件**: `session.py:223-261`, `switcher.py:270`
- **变更**: 加 sessions.lock；通过 .last_cleanup 文件限流，每 60 秒最多清理一次
- **决策**: 60 秒 throttle，避免多 Agent 并发时的 IO 风暴

### 2.5 is_process_alive 改用 os.kill
- **文件**: `session.py:57-70`
- **变更**: `subprocess.run(["kill", "-0", ...])` → `os.kill(pid, 0)`

### 2.6 Config.save() 备份改用 shutil.copy2()
- **文件**: `config.py:59-68`
- **变更**: `rename` 备份改为 `copy2` 备份 + temp+rename 原子写入

---

## Phase 3: 真正的 TTY 隔离（待确认）

- **方案 C**: 环境变量注入，不碰全局配置
- **前提**: 需验证 Gemini CLI / Codex CLI 的环境变量覆盖支持
- **降级**: 不支持环境变量覆盖的工具，回退为加锁写全局配置
- **用户倾向**: 方案 B ($HOME 重定向) 作为备选
- **状态**: 待明天验证后推进

---

## 文件变更总结

| 文件 | 操作 | Phase |
|------|------|-------|
| `src/cli_switch/filelock.py` | 新增 | 2.1 |
| `src/cli_switch/hooks.py` | 修改 | 1.2 + 2.3 |
| `src/cli_switch/main.py` | 修改 | 1.1 + 1.3 + 1.4 |
| `src/cli_switch/switcher.py` | 修改 | 2.2 |
| `src/cli_switch/session.py` | 修改 | 2.4 + 2.5 |
| `src/cli_switch/config.py` | 修改 | 2.6 |
