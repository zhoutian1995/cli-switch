# Changelog

All notable changes to cli-switch will be documented in this file.

## [0.2.0] - 2025-05-05

### Added
- **Agent orchestration**: `cli-switch run <input>` — smart routing and execution
- **Intent parser**: Rule-based + optional LLM intent analysis (OpenRouter compatible)
- **Smart routing engine**: Automatic agent selection based on task type
- **Process manager**: Subprocess management with timeout/memory protection
- **Agent registry**: TOML-based agent definitions (claude-code, codex, gemini)
- **Fallback mechanism**: Automatic fallback to alternative agents on failure
- **Orchestration modes**: single, orchestrator, handoff, review
- **Concurrency control**: Configurable max concurrent agent processes
- **OpenRouter integration**: LLM-powered intent analysis via OpenRouter API
- **JSON output**: All commands support `--json` for machine consumption
- **Dry-run mode**: `--dry-run` to preview routing decisions without execution
- 20 new tests for agent orchestration (router, dispatcher, intent)

### Changed
- README completely rewritten with agent orchestration documentation
- Version bumped to 0.2.0

## [0.1.0] - 2025-04-10

### Added
- Initial release
- `resolve` command: resolve tool/profile/model into runtime spec
- `env` command: inspect environment and config sources
- `auth status` command: check authentication status
- `doctor` command: run diagnostics
- `list` command: list models/providers/profiles
- Adapter pattern for Claude Code, Codex CLI, Gemini CLI
- TOML-based registry with user overrides
- JSON-first output with structured error model
- TypeScript strict mode, ESM
