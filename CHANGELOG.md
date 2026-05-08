# Changelog

All notable changes to cli-switch will be documented in this file.

## [Unreleased]

## [0.3.2] - 2026-05-08

### Added
- Gateway env aliases for self-hosted relays and OpenRouter: `SWITCH_RELAY_API_KEY`, `SWITCH_RELAY_BASE_URL`, `OPENROUTER_API_KEY`, and `OPENROUTER_BASE_URL`.
- `cli-switch env` now reports gateway and relay environment variables with masked values.
- Formal multilingual README covering English, Chinese, Japanese, and Korean.
- GitHub release positioning, use cases, fit guidance, and onboarding curve.

### Changed
- Strategy and fallback execution now resolve model and gateway env per target agent/tier instead of reusing the initial agent runtime.
- `--strategy` now emits an explicit warning because cost profiles are accepted but not yet implemented.
- README now documents current v0.3.x capabilities and roadmap boundaries more precisely.

## [0.3.0] - 2025-05-06

### Added
- **ACP protocol bridge**: JSON-RPC over stdio communication with Agent subprocesses
- **Streaming output**: Real-time display of Agent responses during execution (`--stream`)
- **Interactive selection**: Terminal-based Agent picker with readline (`--interactive` / `-i`)
- **Tech stack auto-detection**: Reads package.json/tsconfig/etc to identify project tech stack
- **Project context injection**: Auto-generates enhanced system prompt with tech stack/branch/entry points
- **Model parameter injection**: Automatically selects sonnet/opus/haiku based on task complexity
- **Agent capability matrix**: 8-dimension quantitative scoring for each Agent (reasoning/codeGen/refactoring/debugging/testing/speed/multimodal/cost)
- **Self-learning router**: Records routing history (JSONL), optimizes Agent selection based on success rate
- **`cli-switch benchmark` command**: Built-in 5-task benchmark suite for cross-Agent performance comparison
- **`cli-switch capabilities` command**: Display Agent capability matrix in text/JSON format
- **Git safety guard**: Branch protection, auto-checkpoint, rollback, secret detection
- **Secret detector**: Regex-based scanning for API keys, tokens, passwords, private keys in diffs
- **Token consumption maximizer**: 6 pipeline stages with optional LLM calls (intent/routing/quality/summarization/review/aggregation)
- **LLM service**: `LLMService` with `chat()` and `chatJSON()`, auto-create from `OPENROUTER_API_KEY`
- **LLM-powered routing**: `routeWithFallback()` — LLM-first with rule-based fallback
- **LLM code quality evaluation**: Score/issues/suggestions for Agent output
- **LLM context summarization**: For handoff mode inter-agent context passing
- **LLM code review**: For review mode automated code review
- **Orchestrator**: Parallel/handoff/review orchestration modes
- **Agent loader**: Parse agents.toml into structured Agent definitions
- **Concurrency control queue**: Configurable max concurrent agent processes
- **Stress test**: `test/stress/concurrent.test.ts` for concurrent agent dispatch
- **Productization**: LICENSE (MIT), CHANGELOG, CONTRIBUTING, GitHub Issue/PR templates, QUICK_START guide

### Changed
- README completely rewritten with comprehensive feature documentation and comparison tables
- Version bumped to 0.3.0

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
