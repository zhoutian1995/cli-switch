# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-03-13

### Added
- 7 new Fucheers models: opus4.6, opus4.6-thinking, opus4.5-20251101, opus4.5-20251101-thinking, sonnet4.6, sonnet4.6-thinking, haiku4.5-20251001
- MCP (Model Context Protocol) server management (`cli-switch mcp`)
- Hook engine with re-entrancy protection (`cli-switch hook`)
- TTY-based terminal isolation for multi-session support
- Health check and diagnostics (`cli-switch health-check`)
- Error diagnosis with solution suggestions
- Image generation via Gemini API (`cli-switch image`)
- Shell precmd hook for auto-sourcing environment
- Custom model management (`cli-switch model add/remove`)
- Comprehensive test suite (50 tests)

### Changed
- Upgraded model registry to support multiple API providers (Bailian, Zhipu, Fucheers, Google, OpenAI)
- Improved cross-tool switching (Claude/Gemini/Codex)
- Atomic file writes for crash safety

### Fixed
- Claude settings.json corruption during concurrent switches
- Model count in test assertions after adding new models

## [1.0.0] - 2026-03-10

### Added
- Initial release
- Support for Claude Code, Gemini CLI, Codex CLI
- 15 built-in models (Bailian 8, Zhipu 2, Gemini 4, Codex 1)
- Interactive CLI menu (`cli-menu`)
- YAML-based configuration
- Cross-tool model switching
- Model connectivity testing
