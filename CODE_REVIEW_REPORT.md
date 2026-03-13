# CLI-Switch 全局架构审查报告

**审查日期**: 2026-03-13  
**审查范围**: v1.1.0 完整源码审查  
**审查者**: AI 架构师

---

## 执行摘要

本次审查对 cli-switch 项目进行了从宏观架构到核心逻辑的全面排查。项目整体结构设计清晰，模块划分合理，但在**核心机制落地**和**并发安全**方面存在严重的系统性缺陷。

**综合架构健康度评分：51 / 100**

---

## Phase 1: 核心机制落地验证

### 1.1 TTY 级别隔离 — 存在设计缺陷 (P0)

**核心代码**: `src/cli_switch/session.py:27-49`

#### 问题描述

`get_tty()` 正确地为每个终端生成了独立的 session 文件名（如 `_dev_ttys001.json`），但 `src/cli_switch/switcher.py` 的三个切换方法直接写入的是**全局共享的配置文件**：

| 工具 | 配置文件路径 | 代码行 |
|------|-------------|--------|
| Claude Code | `~/.claude/settings.json` | switcher.py:61 |
| Gemini CLI | `~/.gemini/config.json` | switcher.py:91 |
| Codex CLI | `~/.codex/config.toml` | switcher.py:133 |

#### 影响

**TTY 隔离只隔离了 cli-switch 自己的状态文件，并没有隔离底层工具的实际配置。**

场景演示：
```bash
# Terminal 1 (tty: /dev/ttys001)
cli-switch qwen
# → 写入 ~/.claude/settings.json: ANTHROPIC_MODEL=qwen3.5-plus

# Terminal 2 (tty: /dev/ttys002)  
cli-switch glm
# → 写入 ~/.claude/settings.json: ANTHROPIC_MODEL=glm-5
# → Terminal 1 的 Claude Code 现在也变成了 glm-5！
```

#### 结论

README 承诺的"TTY 级别隔离"在底层工具配置层面是**虚假的**。session 文件只记录了"我认为我切到了什么模型"，但底层工具实际读取的是全局配置，不受 TTY 隔离保护。

#### 建议修复方案

**方案 A（推荐）**: 放弃"隔离"承诺，README 改为"快速切换器"，明确说明多终端场景下最后写入者获胜。

**方案 B（彻底修复）**: 引入 per-session 的 config 目录，通过环境变量让底层工具读取不同配置：
```python
# ~/.cli-switch/sessions/dev_ttys001/claude-settings.json
# ~/.cli-switch/sessions/dev_ttys002/claude-settings.json

# Shell hook 导出环境变量
export CLAUDE_CONFIG_DIR=~/.cli-switch/sessions/${TTY_NAME}
```

---

### 1.2 PID 防幽灵状态 — 设计合理，但存在 PID 回绕隐患 (P1)

**核心代码**: `src/cli_switch/session.py:57-70`

```python
def is_process_alive(pid: int) -> bool:
    result = subprocess.run(["kill", "-0", str(pid)], capture_output=True, timeout=1)
    return result.returncode == 0
```

#### 问题

1. **效率问题 (P2)**: 使用 `subprocess.run(["kill", "-0", ...])` 而非 `os.kill(pid, 0)` 增加了不必要的进程开销。

2. **PID 回绕风险 (P1)**: macOS 的 PID 空间是有限的（通常最大 ~99999）。如果原进程死亡后，新进程恰好复用了同一个 PID，幽灵防御会**错误地认为旧 session 仍然有效**。

#### 建议修复

```python
def is_process_alive(pid: int) -> bool:
    """检查进程是否存活（使用 os.kill 更高效）"""
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False
```

---

### 1.3 原子写入 — 基本正确，但存在边界问题 (P1)

**核心代码**: `src/cli_switch/session.py:196-220`

#### 肯定

使用 `temp_file + rename` 模式实现原子写入，在 POSIX 系统上 `rename()` 是原子操作，这个设计是正确的。

#### 问题

**P1-1: JSON + ENV 双文件不原子**

`set_session_state()` 先原子写入 `.json`，再原子写入 `.env`。但**两次写入之间不是原子的**。如果进程在写完 `.json` 之后、写 `.env` 之前被 kill，会出现 `.json` 更新了但 `.env` 还是旧的。

**P1-2: `_switch_claude()` 等方法的写入不是原子的**

`src/cli_switch/switcher.py:65-81` 直接 `open(config_path, "r")` 读取再 `open(config_path, "w")` 写入 `~/.claude/settings.json`，**没有使用 temp+rename 模式**。如果进程在写入过程中被 kill，配置文件会被截断为空或半写状态。

同样的问题存在于 `_switch_gemini()` 和 `_switch_codex()`。

#### 建议修复

```python
# switcher.py: _switch_claude() 示例
import tempfile
import shutil

def _switch_claude(self, model: Model) -> Tuple[bool, str]:
    config_path = Path.home() / ".claude" / "settings.json"
    if not config_path.exists():
        return False, f"Claude 配置文件不存在：{config_path}"
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        
        # ... 修改 settings ...
        
        # 原子写入：写入临时文件后 rename
        fd, temp_path = tempfile.mkstemp(suffix=".json", dir=config_path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
            # rename 是原子操作
            shutil.move(temp_path, config_path)
        except:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise
            
    except json.JSONDecodeError as e:
        return False, f"配置文件解析错误：{e}"
    except Exception as e:
        return False, f"切换 Claude 失败：{e}"
```

---

## Phase 2: 并发与多 Agent 协同安全

### 2.1 无任何锁机制 — 致命缺陷 (P0)

**审查结果**: 通读整个代码库，**没有发现任何文件锁（flock/fcntl/lockfile）的使用**。所有对共享配置文件的读写都是裸操作。

#### 极端场景分析

三个 Agent 同一毫秒同时执行：
```bash
Agent 1: cli-switch qwen
Agent 2: cli-switch --tool codex glm
Agent 3: cli-switch --tool gemini gemini-3.1-pro
```

**竞争条件**:
- Agent 1 和 Agent 3 如果都触发了 Claude 配置的写入，会发生**写竞争**
- `_switch_codex()` 中 (`switcher.py:137-243`) 先读 `config.toml`，然后用正则替换内容再写回。这个 read-modify-write 过程完全没有保护，是经典的 **TOCTOU (Time-of-check to time-of-use) 漏洞**

#### 建议修复

```python
# src/cli_switch/switcher.py 添加文件锁
import fcntl

class Switcher:
    def _switch_claude(self, model: Model) -> Tuple[bool, str]:
        config_path = Path.home() / ".claude" / "settings.json"
        lock_path = config_path.with_suffix(".lock")
        
        # 获取排他锁
        lock_fd = open(lock_path, "w")
        try:
            fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)
            # ... 执行读写操作 ...
        finally:
            fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)
            lock_fd.close()
```

或使用第三方库 `filelock`:
```python
from filelock import FileLock

lock = FileLock("~/.claude/settings.json.lock")
with lock:
    # 临界区代码
```

---

### 2.2 `cleanup_stale_sessions()` 的并发隐患 (P2)

**核心代码**: `src/cli_switch/session.py:223-261`

每次 `_save_current_model()` 都会调用 `cleanup_stale_sessions()`（`switcher.py:270`），遍历整个 sessions 目录并删除"死亡"进程的文件。

#### 问题

如果两个 Agent 同时执行清理，可能同时删除同一个文件，第二个可能抛异常（虽然被 try-except 吞掉了）。

#### 建议

- 减少调用频率：改为定期后台清理（如每 5 分钟）
- 或在启动时清理一次，而不是每次切换都清理

---

### 2.3 custom_hook 的副作用竞争 (P0)

**核心代码**: `src/cli_switch/main.py:284-296`

```python
if custom_hook:
    hooks_module.add_hook("post_switch", custom_hook)  # 永久写入配置文件！

success, message = switcher.switch(model, target_tool)

if custom_hook and success:
    hooks_module.execute_hook(custom_hook, context, check_reentrancy=False)
```

#### 问题

1. **`--hook` 参数传入的临时 hook 被永久写入** `~/.cli-switch/hooks.yaml`，但从未被清理。多次运行后，hooks.yaml 会累积大量重复的 hook 命令。

2. **同一个 hook 被执行两次**：`switcher.switch()` 内部 `_save_current_model()` 已经会执行 `execute_post_switch()`，然后 `main.py:296` 又显式执行一次。

#### 建议修复

去掉 `add_hook()` 调用，`--hook` 只应临时执行，不应持久化：

```python
# main.py: handle_switch()
def handle_switch(..., custom_hook: Optional[str] = None):
    # 移除：hooks_module.add_hook("post_switch", custom_hook)
    
    success, message = switcher.switch(model, target_tool)
    
    # 只执行一次，通过 switcher 的内部 hook 机制
    # 或显式执行但不持久化
    if custom_hook and success:
        context = {"model": model.key, "tool": target_tool or model.tool.value, "model_id": model.model_id}
        hooks_module.execute_hook(custom_hook, context, check_reentrancy=False)
```

---

## Phase 3: 机器交互（Agent API）与健壮性

### 3.1 JSON 契约严谨性 — 不达标 (P1)

#### P1-1: 致命异常时输出非 JSON

**代码**: `src/cli_switch/main.py:136-143`

```python
try:
    config = Config()
    config.load()
except ConfigError as e:
    print(f"配置错误：{e}", file=sys.stderr)
    sys.exit(2)
```

如果配置文件损坏，即使 Agent 传了 `--json` 参数，输出的仍然是中文纯文本错误到 stderr，exit code 为 2。

#### P1-2: `handle_switch` 中 `sys.exit(1)` 可能混合输出

**代码**: `src/cli_switch/main.py:307-309`

```python
print(f"❌ {message}")
if not success:
    sys.exit(1)
```

#### P1-3: `handle_health_check` 混合输出

**代码**: `src/cli_switch/main.py:1285-1320`

在 `json_output=True` 时，先用 `print(f"正在检查...")` 和 `print(f"  检查 {model.key}... ")` 输出了非 JSON 文本到 stdout，然后才在最后 `print(json.dumps(...))`。

#### 建议修复

在 `main()` 最外层包一个 try-except，json 模式下永远输出合法 JSON：

```python
def main(argv: Optional[list] = None):
    parser = create_parser()
    args = parser.parse_args(argv)
    
    json_output = getattr(args, 'json', False)
    
    try:
        # ... 原有逻辑 ...
    except Exception as e:
        if json_output:
            print(json.dumps({"success": False, "error": str(e)}, indent=2))
            sys.exit(1)
        else:
            raise
```

---

### 3.2 Hook 引擎安全性 — 基本合格，但有盲区 (P1/P2)

**核心代码**: `src/cli_switch/hooks.py:72-78, 94-97`

#### P1-1: `check_reentrancy=False` 的滥用

**代码**: `src/cli_switch/main.py:296`

```python
hooks_module.execute_hook(custom_hook, context, check_reentrancy=False)
```

绕过防重入保护。如果用户传入的 hook 命令内部调用了 `cli-switch switch`，会导致**无限递归**。虽然 `subprocess.run` 的 30 秒 timeout 最终会终止，但这意味着最坏情况下要卡 30 秒才能 fail。

#### P2-1: Hook 命令的 shell 注入风险

**代码**: `src/cli_switch/hooks.py:100-111`

```python
# 替换占位符
for key, value in context.items():
    command = command.replace(f"{{{key}}}", str(value))

# 执行命令
result = subprocess.run(command, shell=True, env=env, ...)
```

上下文变量（如 model_id）直接拼接到 shell 命令并以 `shell=True` 执行。如果自定义模型的 model_id 包含 shell 特殊字符（如 `; rm -rf /`），会导致**命令注入**。

#### 建议修复

```python
import shlex

def execute_hook(command: str, context: Optional[Dict[str, str]] = None, ...) -> bool:
    # 替换占位符
    if context:
        for key, value in context.items():
            # 对值进行 shell 转义
            safe_value = shlex.quote(str(value))
            command = command.replace(f"{{{key}}}", safe_value)
    
    # ... 其余代码 ...
```

---

### 3.3 `_switch_codex()` 的 TOML 处理 — 脆弱 (P1)

**核心代码**: `src/cli_switch/switcher.py:126-248`

整个 Codex 配置的读写使用手工正则表达式替换 TOML 内容，而不是使用 TOML 解析库。

#### 问题

- `re.sub(r"^model\s*=\s*\".*\"", ...)` 只能处理双引号包围的值
- `re.sub(r"\[model_providers\.\w+\].*?(?=\n\[|\Z)", ...)` 使用贪婪匹配，如果 TOML 文件中有注释行以 `[` 开头，会导致误匹配

#### 建议修复

使用 `tomli`/`tomli_w` 库正确解析和生成 TOML：

```python
import tomli
import tomli_w

def _switch_codex(self, model: Model) -> Tuple[bool, str]:
    config_path = Path.home() / ".codex" / "config.toml"
    
    # 正确解析 TOML
    with open(config_path, "rb") as f:
        config = tomli.load(f)
    
    # 修改配置
    config["model"] = model_id
    config["model_provider"] = provider_name
    
    # 原子写入
    with open(config_path, "wb") as f:
        tomli_w.dump(config, f)
```

---

## Phase 4: 架构重构建议与评分

### Action Items 清单

#### P0 — 致命的并发/隔离漏洞（必须立即修复）

| # | 问题 | 文件:行 | 建议 |
|---|------|---------|------|
| P0-1 | TTY 隔离是假隔离，底层工具配置是全局共享的 | switcher.py:61,91,133 | 方案 A: 放弃"隔离"承诺；方案 B: 引入 per-session 的 config 目录 |
| P0-2 | 完全没有文件锁，read-modify-write 存在 TOCTOU 竞争 | switcher.py:65-81,95-117,137-243 | 使用 `fcntl.flock()` 或 `filelock` 库 |
| P0-3 | `--hook` 参数被永久写入且 hook 会被执行两次 | main.py:284-296 | 去掉 `add_hook()` 调用 |

#### P1 — Agent 交互/JSON 解析崩溃风险（应尽快修复）

| # | 问题 | 文件:行 | 建议 |
|---|------|---------|------|
| P1-1 | PID 回绕导致幽灵态误判 | session.py:57-70 | 使用 `os.kill(pid, 0)`；增加进程创建时间验证 |
| P1-2 | .json 和 .env 双文件写入不原子 | session.py:196-220 | 合并为单文件或目录级 rename |
| P1-3 | 底层工具配置写入不是原子的 | switcher.py:65-81,95-117 | 统一使用 temp+rename 模式 |
| P1-4 | 致命异常时 `--json` 模式输出非 JSON | main.py:136-143 | 在 `main()` 最外层包 try-except |
| P1-5 | `handle_health_check` JSON 模式混合输出 | main.py:1285-1320 | JSON 模式下禁止 print 进度信息到 stdout |
| P1-6 | Codex TOML 用正则处理，容易误匹配 | switcher.py:126-248 | 使用 `tomli`/`tomli_w` 库 |
| P1-7 | `check_reentrancy=False` 绕过防重入 | main.py:296 | 移除该参数或加递归深度计数器 |

#### P2 — 代码扩展性优化（建议改进）

| # | 问题 | 文件:行 | 建议 |
|---|------|---------|------|
| P2-1 | `is_process_alive` 使用 subprocess 效率低 | session.py:57-70 | 改用 `os.kill(pid, 0)` |
| P2-2 | Hook 命令存在 shell 注入风险 | hooks.py:100-111 | 对上下文变量做 `shlex.quote()` 转义 |
| P2-3 | `main.py` 过长（1452 行），职责不清 | main.py 全文 | 拆分为 cli.py + commands/ |
| P2-4 | `Config.save()` 用 rename 做备份导致原文件消失 | config.py:61-63 | 改用 `shutil.copy2()` 做备份 |
| P2-5 | `ModelRegistry` 是类但大量方法是 `@classmethod` | models.py:254-301 | 统一使用实例方法或拆分模块 |
| P2-6 | 缺少日志系统 | 全项目 | 引入 `logging` 模块 |

---

## 综合架构健康度评分

| 维度 | 满分 | 得分 | 说明 |
|------|------|------|------|
| 核心功能正确性 | 25 | 12 | TTY 隔离名不副实，底层配置写入互相覆盖 |
| 并发安全 | 25 | 8 | 完全没有锁机制，read-modify-write 全裸操作 |
| Agent API 健壮性 | 20 | 12 | JSON 模式存在多处非 JSON 泄漏，但基本路径可用 |
| 代码质量/可维护性 | 15 | 10 | 结构清晰、模块化合理，但 main.py 过大，正则处理 TOML 脆弱 |
| 安全性 | 15 | 9 | Hook shell 注入风险，缺少输入验证 |

### **总分：51 / 100**

---

## 总结

cli-switch 的**设计意图是好的** — 模块划分清晰（session/hooks/switcher/models/config），YAML 外部化配置、原子写入的意识也体现了工程素养。但在最核心的两个承诺上存在系统性缺陷：

### 1. "TTY 隔离"是自欺欺人的

只隔离了自己的 session 文件，没有隔离底层工具的全局配置。

### 2. "并发安全"完全缺失

没有任何文件锁，三 Agent 同时切换一定会互相覆盖。

### 建议优先级

1. **立即修复 P0 问题**（尤其是文件锁和 TTY 隔离的真实落地）
2. **尽快修复 P1 问题**（JSON 契约稳定性、原子写入完整性）
3. **迭代改进 P2 问题**（代码重构、日志系统）

这两个 P0 级问题如果不解决，在真实的多 Agent 协作场景下会产生难以复现的诡异 bug（模型切换看似成功，但实际运行的是另一个模型）。建议优先解决 P0 问题后再进入功能扩展阶段。

---

**审查完成时间**: 2026-03-13  
**审查工具**: 全源码静态分析  
**审查深度**: 宏观架构 + 核心逻辑逐行审查
