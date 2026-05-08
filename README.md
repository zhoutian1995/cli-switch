# cli-switch

AI Agent Capability Router for coding CLIs.

`cli-switch` is a small orchestration layer that routes a task to the right AI
agent, injects gateway credentials safely, and returns a consistent CLI/JSON
result for scripts, automation, and higher-level agents.

Current release: `0.3.0`

## Status

`cli-switch@0.3.0` is published on npm and is ready for early real-world use.
It is not the full v2.0 product described in `docs/PRD.md` yet.

What is working today:

- Run tasks through Claude Code or Codex CLI.
- Auto-route by intent/capability, or force an agent with `--agent`.
- Use gateway credentials for Claude Code and Codex without changing their
  global config.
- Support self-hosted relay keys and OpenRouter-style environment variables.
- Choose model tiers with `--tier economy|standard|premium`.
- Use execution modes such as `single`, `write_review`, and `write_test_fix`.
- Inspect runtime, environment, auth, diagnostics, models, providers, profiles,
  and capability routing.
- Use JSON output for automation with `--json`.
- Isolate child process environment and scrub parent session variables.

Known limits:

- `--strategy balanced|high_quality|low_cost` is accepted but not implemented
  as a runtime strategy selector yet.
- Gateway injection currently targets Claude Code and Codex. Gemini and other
  agents are registry/adapter extension targets, not primary supported paths.
- Sandbox support is v0.1 scope: process env isolation and gateway HOME
  isolation. Full file policy, patch-only output, worktree isolation, and temp
  project copies are still future work.
- User config override commands such as `config show/set/reset` are not
  implemented yet.

## Install

```bash
npm install -g cli-switch
```

Verify:

```bash
cli-switch --version
cli-switch doctor --json
```

From source:

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install
npm run build
npm link
```

## Quick Start

Dry-run the routing decision:

```bash
cli-switch run "refactor the auth module" --dry-run
```

Run with automatic routing:

```bash
cli-switch run "write tests for the payment parser"
```

Force Codex:

```bash
cli-switch run "fix this TypeScript error" --agent codex
```

Force Claude Code:

```bash
cli-switch run "review this architecture change" --agent claude-code
```

Return JSON for automation:

```bash
cli-switch run "explain this repository" --json
```

Use a tier:

```bash
cli-switch run "debug the failing e2e test" --tier premium
```

Use an execution mode:

```bash
cli-switch run "implement login validation" --execution write_test_fix
```

## Gateway / Relay Configuration

The preferred gateway variables are:

```bash
export SWITCH_API_KEY=your-gateway-key
export SWITCH_BASE_URL=https://your-relay.example.com/v1
export SWITCH_MODEL_STANDARD=your-standard-model
export SWITCH_MODEL_PREMIUM=your-premium-model
export SWITCH_MODEL_ECONOMY=your-economy-model
```

Self-hosted relay aliases are also supported:

```bash
export SWITCH_RELAY_API_KEY=your-relay-key
export SWITCH_RELAY_BASE_URL=https://your-relay.example.com/v1
```

OpenRouter-style variables can be reused:

```bash
export OPENROUTER_API_KEY=sk-or-v1-xxx
export OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Priority order:

```text
SWITCH_* > SWITCH_RELAY_* > OPENROUTER_*
```

When gateway mode is enabled, `cli-switch` maps the gateway credentials into
the agent-native variables needed by each CLI:

| Agent | Injected variables | Model flag |
| --- | --- | --- |
| Claude Code | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | `--model` |
| Codex CLI | `OPENAI_API_KEY`, `OPENAI_BASE_URL` | `-m` |

If no gateway key is configured, the agent uses its normal local auth.

## Commands

```bash
cli-switch resolve       # Resolve tool/profile/model to a runtime spec
cli-switch env           # Inspect environment and config sources
cli-switch auth status   # Check auth status for a tool
cli-switch doctor        # Run diagnostics
cli-switch list          # List models, providers, and profiles
cli-switch run           # Route and run an AI agent
cli-switch capabilities  # Show the capability matrix
cli-switch benchmark     # Run capability simulations across agents
```

Run help:

```bash
cli-switch run --help
```

Current `run` options:

```text
--mode <mode>        single|orchestrator|handoff|review
--agent <agent>      claude-code|codex
--strategy <name>    balanced|high_quality|low_cost (accepted, not implemented)
--execution <mode>   single|write_review|write_test_fix
--tier <tier>        economy|standard|premium
--json               output JSON
--dry-run            show routing decision without executing
--timeout <seconds>  agent timeout, default 120
--reviewer <agent>   reviewer agent for review mode
--no-git             skip Git guard
--rollback           try rollback on failure
--stream             stream output, default true
--no-stream          disable streaming
--interactive        interactive agent selection
--acp                JSON-RPC over stdio bridge
```

## Architecture

At a high level:

```text
task input
  -> intent/capability detection
  -> tier and agent resolution
  -> optional gateway env injection
  -> sandboxed child process execution
  -> text or JSON result
```

Important directories:

```text
cmd/                  CLI command entrypoints
src/core/router/      capability and model routing
src/core/gateway/     gateway config and env injection
src/core/dispatcher/  agent process management
src/core/sandbox/     environment and HOME isolation helpers
src/core/strategy/    execution mode engine
src/registry/         built-in agents, models, providers, profiles
schema/               runtime and config JSON schemas
test/                 unit, contract, e2e, and stress tests
```

## Development

```bash
npm run build
npm test
npm run smoke
npm run lint
```

Current verification baseline:

```text
35 test files
318 tests passing
```

## Product Roadmap

The v2.0 target is documented in `docs/PRD.md`. The short version:

- v0.3.0 is a usable npm baseline for routing, gateway injection, strategy
  execution modes, diagnostics, and sandbox environment isolation.
- Next important work is stricter provider/vendor/transport resolution,
  platform and binary preflight checks, error-code closure, and user config
  overrides.
- Full file sandboxing, patch-only execution, worktree isolation, and richer
  skill DSL support are future milestones.

## License

MIT
